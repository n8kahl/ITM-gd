import { z } from 'zod';
import { CHAT_MODEL, openaiClient } from '../../config/openai';
import { openaiCircuit } from '../../lib/circuitBreaker';
import { logger } from '../../lib/logger';
import type { ParsedTrade } from './types';
import { TradeValidationError, validateParsedTrades } from './trade-validator';

const TRADE_REPLAY_PARSER_MODEL = process.env.TRADE_REPLAY_PARSER_MODEL || CHAT_MODEL;
const PARSER_TEMPERATURE = 0;
const PARSER_MAX_TOKENS = 2400;
const PARSER_MAX_RETRIES = 1;
const DEFAULT_INPUT_TIMEZONE = 'America/Chicago';

const SYSTEM_PROMPT = [
  'You are a strict parser for SPX options day-trading Discord transcripts.',
  'Extract only actionable trade activity and return JSON.',
  'Ignore pure commentary, educational text, or hypothetical statements with no fill.',
  'A trade starts at PREP/PTF/Filled context and ends at Fully out / Fully sold.',
  'Output timezone must be America/New_York with explicit ISO-8601 offsets in every timestamp.',
  'Use this JSON object shape exactly: {"trades":[ParsedTrade...]}.',
  'ParsedTrade fields:',
  '- tradeIndex: integer starting at 1',
  '- contract: { symbol: "SPX", strike: number, type: "call" | "put", expiry: "YYYY-MM-DD" }',
  '- direction: always "long"',
  '- entryPrice: number (average fill)',
  '- entryTimestamp: ISO-8601 with timezone offset',
  '- exitEvents: [{ type: "trim" | "stop" | "trail_stop" | "breakeven_stop" | "full_exit", percentage?: number, timestamp: ISO-8601 with timezone offset }]',
  '- stopLevels: [{ spxLevel: number, timestamp: ISO-8601 with timezone offset }]',
  '- spxReferences: number[] of SPX levels mentioned',
  '- sizing: "normal" | "light" | null',
  '- rawMessages: string[] with original source lines for that trade',
  'If data is missing, infer conservatively and keep fields valid.',
  'Return JSON only. No markdown. No commentary.',
].join('\n');

const parserOutputSchema = z.object({
  trades: z.array(z.unknown()),
}).strict();

export interface ParseTranscriptParams {
  transcript: string;
  inputTimezone?: string;
  dateHint?: string;
}

export type TranscriptParserErrorCode =
  | 'INVALID_INPUT'
  | 'OPENAI_REQUEST_FAILED'
  | 'OPENAI_EMPTY_RESPONSE'
  | 'OPENAI_JSON_PARSE_ERROR'
  | 'OPENAI_SCHEMA_MISMATCH'
  | 'TRADE_VALIDATION_FAILED';

const RETRYABLE_PARSER_ERROR_CODES = new Set<TranscriptParserErrorCode>([
  'OPENAI_EMPTY_RESPONSE',
  'OPENAI_JSON_PARSE_ERROR',
  'OPENAI_SCHEMA_MISMATCH',
]);

export class TranscriptParserError extends Error {
  readonly code: TranscriptParserErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: TranscriptParserErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'TranscriptParserError';
    this.code = code;
    this.details = details;
  }
}

function buildUserPrompt(params: ParseTranscriptParams): string {
  const inputTimezone = (params.inputTimezone || DEFAULT_INPUT_TIMEZONE).trim();
  const dateHint = params.dateHint?.trim();
  const hintLine = dateHint ? `Date hint: ${dateHint}` : 'Date hint: not provided';

  return [
    `Input timezone: ${inputTimezone}`,
    'Output timezone: America/New_York',
    hintLine,
    'Transcript:',
    params.transcript,
  ].join('\n\n');
}

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const withoutCodeFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutCodeFence);
  } catch {
    const start = withoutCodeFence.indexOf('{');
    const end = withoutCodeFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new TranscriptParserError(
        'OPENAI_JSON_PARSE_ERROR',
        'OpenAI response did not include a valid JSON object.',
        { preview: withoutCodeFence.slice(0, 500) }
      );
    }

    const jsonSlice = withoutCodeFence.slice(start, end + 1);
    try {
      return JSON.parse(jsonSlice);
    } catch {
      throw new TranscriptParserError(
        'OPENAI_JSON_PARSE_ERROR',
        'Failed to parse OpenAI structured output JSON.',
        { preview: jsonSlice.slice(0, 500) }
      );
    }
  }
}

function summarizeTradeValidationIssues(
  issues: Array<{ path: string; message: string }>,
): string {
  if (!issues.length) {
    return 'Parsed trades failed replay validation checks.'
  }

  const previewLimit = 3
  const preview = issues
    .slice(0, previewLimit)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join(' | ')
  const remaining = issues.length - previewLimit
  const remainingSuffix = remaining > 0 ? ` (+${remaining} more)` : ''

  return `Parsed trades failed replay validation checks. ${preview}${remainingSuffix}`
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const withStatus = error as Error & { status?: number; code?: string; type?: string };
  return {
    message: withStatus.message,
    name: withStatus.name,
    status: withStatus.status,
    code: withStatus.code,
    type: withStatus.type,
  };
}

function withAttemptCount(error: TranscriptParserError, attempts: number): TranscriptParserError {
  return new TranscriptParserError(
    error.code,
    error.message,
    {
      ...(error.details || {}),
      attempts,
    }
  );
}

export async function parseTranscriptToTrades(params: ParseTranscriptParams): Promise<ParsedTrade[]> {
  const transcript = params.transcript.trim();
  if (!transcript) {
    throw new TranscriptParserError('INVALID_INPUT', 'Transcript is required.', { attempts: 1 });
  }

  const maxAttempts = PARSER_MAX_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const completion = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
        model: TRADE_REPLAY_PARSER_MODEL,
        temperature: PARSER_TEMPERATURE,
        max_tokens: PARSER_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt({ ...params, transcript }) },
        ],
      }));

      const content = completion.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new TranscriptParserError(
          'OPENAI_EMPTY_RESPONSE',
          'OpenAI returned an empty parser response.',
          { model: TRADE_REPLAY_PARSER_MODEL }
        );
      }

      const parsedPayload = parseModelJson(content);
      const schemaResult = parserOutputSchema.safeParse(parsedPayload);
      if (!schemaResult.success) {
        throw new TranscriptParserError(
          'OPENAI_SCHEMA_MISMATCH',
          'OpenAI response did not match expected parser envelope.',
          {
            issues: schemaResult.error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          }
        );
      }

      try {
        return validateParsedTrades(schemaResult.data.trades);
      } catch (error) {
        if (error instanceof TradeValidationError) {
          throw new TranscriptParserError(
            'TRADE_VALIDATION_FAILED',
            summarizeTradeValidationIssues(error.issues),
            { issues: error.issues }
          );
        }
        throw error;
      }
    } catch (error) {
      const parserError = error instanceof TranscriptParserError
        ? error
        : new TranscriptParserError(
          'OPENAI_REQUEST_FAILED',
          'Trade transcript parsing request failed.',
          errorDetails(error)
        );

      const shouldRetry = RETRYABLE_PARSER_ERROR_CODES.has(parserError.code) && attempt <= PARSER_MAX_RETRIES;
      if (shouldRetry) {
        logger.warn('Trade transcript parser retrying after malformed/empty structured output.', {
          code: parserError.code,
          attempt,
          nextAttempt: attempt + 1,
        });
        continue;
      }

      throw withAttemptCount(parserError, attempt);
    }
  }

  throw new TranscriptParserError(
    'OPENAI_REQUEST_FAILED',
    'Trade transcript parsing request failed.',
    { attempts: maxAttempts }
  );
}
