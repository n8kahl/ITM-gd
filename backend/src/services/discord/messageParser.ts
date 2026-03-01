import { z } from 'zod';
import { CHAT_MODEL, openaiClient } from '../../config/openai';
import { openaiCircuit } from '../../lib/circuitBreaker';
import { logger } from '../../lib/logger';
import type { DiscordBotMessagePayload } from './discordBot';

export type DiscordSignalType =
  | 'prep'
  | 'ptf'
  | 'filled_avg'
  | 'trim'
  | 'stops'
  | 'breakeven'
  | 'trail'
  | 'exit_above'
  | 'exit_below'
  | 'fully_out'
  | 'commentary';

export type DiscordOptionType = 'call' | 'put';
export type DiscordTradeState = 'IDLE' | 'STAGED' | 'ACTIVE' | 'CLOSED';

const DISCORD_SIGNAL_TYPES = [
  'prep',
  'ptf',
  'filled_avg',
  'trim',
  'stops',
  'breakeven',
  'trail',
  'exit_above',
  'exit_below',
  'fully_out',
  'commentary',
] as const;

const DISCORD_FALLBACK_MODEL = process.env.DISCORD_MESSAGE_PARSER_MODEL || CHAT_MODEL;
const DISCORD_FALLBACK_TEMPERATURE = 0;
const DISCORD_FALLBACK_MAX_TOKENS = 220;

const DISCORD_LLM_FALLBACK_SYSTEM_PROMPT = [
  'You are a strict parser for single Discord SPX options trade messages.',
  'Map one message into a JSON object with shape:',
  '{"signalType":"prep|ptf|filled_avg|trim|stops|breakeven|trail|exit_above|exit_below|fully_out|commentary","fields":{"symbol":string|null,"strike":number|string|null,"optionType":"call"|"put"|string|null,"price":number|string|null,"percent":number|string|null,"level":number|string|null}}',
  'Use commentary when intent is unclear.',
  'Return JSON only. No markdown.',
].join('\n');

export interface ParsedSignalFields {
  symbol: string | null;
  strike: number | null;
  optionType: DiscordOptionType | null;
  price: number | null;
  percent: number | null;
  level: number | null;
}

export interface ParsedDiscordSignal extends DiscordBotMessagePayload {
  signalType: DiscordSignalType;
  fields: ParsedSignalFields;
}

export type StateMachineTransition =
  | 'ignored'
  | 'staged'
  | 'activated'
  | 'mutated'
  | 'closed'
  | 'implicit_close_and_staged';

export interface StateMachineResult {
  previousState: DiscordTradeState;
  nextState: DiscordTradeState;
  transition: StateMachineTransition;
  implicitlyClosedTrade: boolean;
}

interface DiscordParserLogger {
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

interface LlmFallbackInput {
  payload: DiscordBotMessagePayload;
  deterministic: ParsedDiscordSignal;
}

interface LlmFallbackDependencies {
  logger: DiscordParserLogger;
  runFallback: (input: LlmFallbackInput) => Promise<unknown>;
}

interface SymbolExtractionInput {
  normalizedContent: string;
}

const PATTERN_MAP: Array<{ type: DiscordSignalType; regex: RegExp }> = [
  { type: 'fully_out', regex: /\bfully\s+(?:out|sold)\b/i },
  { type: 'exit_above', regex: /\bexit\s+above\b/i },
  { type: 'exit_below', regex: /\bexit\s+below\b/i },
  { type: 'filled_avg', regex: /\bfilled\s+avg\b/i },
  { type: 'ptf', regex: /\b(?:ptf|pft)\b/i },
  { type: 'prep', regex: /\bprep\b/i },
  { type: 'trim', regex: /\btrim\b/i },
  { type: 'stops', regex: /\bstops?\b/i },
  { type: 'breakeven', regex: /\b(?:b\/e|breakeven|b[\s-]?e)\b/i },
  { type: 'trail', regex: /\btrail(?:ing)?\b/i },
];

const rawLlmFallbackSchema = z.object({
  signalType: z.string(),
  fields: z.object({
    symbol: z.string().nullable().optional(),
    strike: z.union([z.number(), z.string(), z.null()]).optional(),
    optionType: z.union([z.string(), z.null()]).optional(),
    price: z.union([z.number(), z.string(), z.null()]).optional(),
    percent: z.union([z.number(), z.string(), z.null()]).optional(),
    level: z.union([z.number(), z.string(), z.null()]).optional(),
  }).strict(),
}).strict();

const SYMBOL_STOP_WORDS = new Set([
  'PREP',
  'PTF',
  'PFT',
  'FILLED',
  'AVG',
  'TRIM',
  'STOPS',
  'STOP',
  'TRAIL',
  'EXIT',
  'ABOVE',
  'BELOW',
  'FULLY',
  'OUT',
  'SOLD',
  'BE',
  'BREAKEVEN',
  'AT',
]);

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function toNumberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return toNumber(value.replace('%', '').trim());
  return null;
}

function coerceSignalType(value: string): DiscordSignalType {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z_]/g, '');

  switch (normalized) {
    case 'prep':
      return 'prep';
    case 'ptf':
    case 'pft':
      return 'ptf';
    case 'filled_avg':
    case 'filledavg':
      return 'filled_avg';
    case 'trim':
      return 'trim';
    case 'stop':
    case 'stops':
      return 'stops';
    case 'breakeven':
    case 'be':
    case 'b_e':
      return 'breakeven';
    case 'trail':
    case 'trailing':
      return 'trail';
    case 'exit_above':
      return 'exit_above';
    case 'exit_below':
      return 'exit_below';
    case 'fully_out':
    case 'fully_sold':
      return 'fully_out';
    default:
      return 'commentary';
  }
}

function coerceOptionType(value: unknown): DiscordOptionType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'call' || normalized === 'c') return 'call';
  if (normalized === 'put' || normalized === 'p') return 'put';
  return null;
}

function coerceSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{1,6}$/.test(normalized)) return null;
  return normalized;
}

function coerceFields(value: z.infer<typeof rawLlmFallbackSchema>['fields']): ParsedSignalFields {
  return {
    symbol: coerceSymbol(value.symbol),
    strike: toNumberFromUnknown(value.strike),
    optionType: coerceOptionType(value.optionType),
    price: toNumberFromUnknown(value.price),
    percent: toNumberFromUnknown(value.percent),
    level: toNumberFromUnknown(value.level),
  };
}

function extractOptionContract(input: string): {
  symbol: string | null;
  strike: number | null;
  optionType: DiscordOptionType | null;
} {
  const contractMatch = input.match(/\b([A-Z]{1,6})\s*(\d{2,5}(?:\.\d+)?)\s*([cCpP])\b/);
  if (!contractMatch) {
    return {
      symbol: null,
      strike: null,
      optionType: null,
    };
  }

  return {
    symbol: contractMatch[1] ?? null,
    strike: toNumber(contractMatch[2]),
    optionType: contractMatch[3]?.toLowerCase() === 'c' ? 'call' : 'put',
  };
}

function extractSymbol(input: SymbolExtractionInput): string | null {
  const fromContract = extractOptionContract(input.normalizedContent).symbol;
  if (fromContract) return fromContract;

  const prefixedMatch = input.normalizedContent.match(/\$([A-Z]{1,6})\b/);
  if (prefixedMatch?.[1]) return prefixedMatch[1];

  const tokenMatch = input.normalizedContent.match(/\b([A-Z]{2,6})\b/g);
  if (!tokenMatch) return null;

  for (const token of tokenMatch) {
    if (!SYMBOL_STOP_WORDS.has(token)) {
      return token;
    }
  }

  return null;
}

function extractPrice(content: string): number | null {
  const preferred = content.match(/@\s*\$?(\d+(?:\.\d+)?)/i);
  if (preferred?.[1]) return toNumber(preferred[1]);

  const avg = content.match(/\bavg\b[^0-9]*(\d+(?:\.\d+)?)/i);
  if (avg?.[1]) return toNumber(avg[1]);

  const at = content.match(/\bat\b[^0-9]*(\d+(?:\.\d+)?)/i);
  if (at?.[1]) return toNumber(at[1]);

  return null;
}

function extractPercent(content: string): number | null {
  const match = content.match(/(\d+(?:\.\d+)?)\s*%/);
  return toNumber(match?.[1]);
}

function extractLevel(content: string, signalType: DiscordSignalType): number | null {
  if (signalType === 'exit_above') {
    const match = content.match(/\bexit\s+above\b[^0-9]*(\d+(?:\.\d+)?)/i);
    return toNumber(match?.[1]);
  }

  if (signalType === 'exit_below') {
    const match = content.match(/\bexit\s+below\b[^0-9]*(\d+(?:\.\d+)?)/i);
    return toNumber(match?.[1]);
  }

  if (signalType === 'stops') {
    const match = content.match(/\bstops?\b[^0-9]*(\d+(?:\.\d+)?)/i);
    return toNumber(match?.[1]);
  }

  if (signalType === 'breakeven') {
    const match = content.match(/\b(?:b\/e|breakeven|b[\s-]?e)\b[^0-9]*(\d+(?:\.\d+)?)/i);
    return toNumber(match?.[1]);
  }

  if (signalType === 'trail') {
    const match = content.match(/\btrail(?:ing)?\b[^0-9]*(\d+(?:\.\d+)?)/i);
    return toNumber(match?.[1]);
  }

  return null;
}

export function classifyDiscordMessage(content: string): DiscordSignalType {
  const safeContent = typeof content === 'string' ? content : '';
  for (const candidate of PATTERN_MAP) {
    if (candidate.regex.test(safeContent)) {
      return candidate.type;
    }
  }
  return 'commentary';
}

export function parseDiscordMessage(payload: DiscordBotMessagePayload): ParsedDiscordSignal {
  const content = typeof payload.content === 'string' ? payload.content : '';
  const normalizedContent = content.toUpperCase();
  const signalType = classifyDiscordMessage(content);
  const optionContract = extractOptionContract(normalizedContent);
  const symbol = extractSymbol({ normalizedContent });

  return {
    ...payload,
    signalType,
    fields: {
      symbol,
      strike: optionContract.strike,
      optionType: optionContract.optionType,
      price: extractPrice(content),
      percent: extractPercent(content),
      level: extractLevel(content, signalType),
    },
  };
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
      throw new Error('fallback_json_missing_object');
    }

    return JSON.parse(withoutCodeFence.slice(start, end + 1));
  }
}

function buildFallbackUserPrompt(input: LlmFallbackInput): string {
  return [
    `Message content: ${input.payload.content}`,
    `Deterministic first-pass signal: ${input.deterministic.signalType}`,
    `Deterministic extracted fields: ${JSON.stringify(input.deterministic.fields)}`,
    `Allowed signalType values: ${DISCORD_SIGNAL_TYPES.join(', ')}`,
    'Return JSON only.',
  ].join('\n');
}

async function runOpenAILlmFallback(input: LlmFallbackInput): Promise<unknown> {
  const completion = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
    model: DISCORD_FALLBACK_MODEL,
    temperature: DISCORD_FALLBACK_TEMPERATURE,
    max_tokens: DISCORD_FALLBACK_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: DISCORD_LLM_FALLBACK_SYSTEM_PROMPT },
      { role: 'user', content: buildFallbackUserPrompt(input) },
    ],
  }));

  const content = completion.choices[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('fallback_empty_response');
  }

  return parseModelJson(content);
}

function resolveLlmFallbackDependencies(
  dependencies?: Partial<LlmFallbackDependencies>,
): LlmFallbackDependencies {
  return {
    logger: dependencies?.logger ?? logger,
    runFallback: dependencies?.runFallback ?? runOpenAILlmFallback,
  };
}

export async function parseDiscordMessageWithFallback(
  payload: DiscordBotMessagePayload,
  dependencies?: Partial<LlmFallbackDependencies>,
): Promise<ParsedDiscordSignal> {
  const deterministic = parseDiscordMessage(payload);
  if (deterministic.signalType !== 'commentary') {
    return deterministic;
  }

  const resolved = resolveLlmFallbackDependencies(dependencies);
  try {
    const llmRaw = await resolved.runFallback({ payload, deterministic });
    const schemaResult = rawLlmFallbackSchema.safeParse(llmRaw);
    if (!schemaResult.success) {
      resolved.logger.warn('Discord message parser LLM fallback schema mismatch; using deterministic output', {
        issues: schemaResult.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return deterministic;
    }

    const normalizedSignalType = coerceSignalType(schemaResult.data.signalType);
    return {
      ...deterministic,
      signalType: normalizedSignalType,
      fields: coerceFields(schemaResult.data.fields),
    };
  } catch (error) {
    resolved.logger.warn('Discord message parser LLM fallback failed; using deterministic output', {
      error: error instanceof Error ? error.message : String(error),
    });
    return deterministic;
  }
}

export class DiscordTradeStateMachine {
  private state: DiscordTradeState = 'IDLE';

  getState(): DiscordTradeState {
    return this.state;
  }

  ingest(signal: ParsedDiscordSignal): StateMachineResult {
    const previousState = this.state;
    let nextState = this.state;
    let transition: StateMachineTransition = 'ignored';
    let implicitlyClosedTrade = false;

    switch (signal.signalType) {
      case 'prep':
        if (this.state === 'ACTIVE') {
          nextState = 'STAGED';
          transition = 'implicit_close_and_staged';
          implicitlyClosedTrade = true;
          break;
        }
        nextState = 'STAGED';
        transition = 'staged';
        break;
      case 'ptf':
      case 'filled_avg':
        if (this.state === 'STAGED') {
          nextState = 'ACTIVE';
          transition = 'activated';
          break;
        }
        if (this.state === 'ACTIVE') {
          nextState = 'ACTIVE';
          transition = 'mutated';
          break;
        }
        break;
      case 'trim':
      case 'stops':
      case 'breakeven':
      case 'trail':
        if (this.state === 'ACTIVE') {
          nextState = 'ACTIVE';
          transition = 'mutated';
        }
        break;
      case 'exit_above':
      case 'exit_below':
      case 'fully_out':
        if (this.state === 'ACTIVE' || this.state === 'STAGED') {
          nextState = 'CLOSED';
          transition = 'closed';
        }
        break;
      case 'commentary':
      default:
        break;
    }

    this.state = nextState;

    return {
      previousState,
      nextState: this.state,
      transition,
      implicitlyClosedTrade,
    };
  }
}
