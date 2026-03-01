const mockCreate = jest.fn();
const mockCircuitExecute = jest.fn();
const mockValidateParsedTrades = jest.fn();
const mockLoggerWarn = jest.fn();
class MockTradeValidationError extends Error {
  readonly issues: Array<{ path: string; message: string }>;

  constructor(message: string, issues: Array<{ path: string; message: string }>) {
    super(message);
    this.name = 'TradeValidationError';
    this.issues = issues;
  }
}

jest.mock('../../../config/openai', () => ({
  openaiClient: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
  CHAT_MODEL: 'gpt-4o',
}));

jest.mock('../../../lib/circuitBreaker', () => ({
  openaiCircuit: {
    execute: (...args: unknown[]) => mockCircuitExecute(...args),
  },
}));

jest.mock('../trade-validator', () => ({
  validateParsedTrades: (...args: unknown[]) => mockValidateParsedTrades(...args),
  TradeValidationError: MockTradeValidationError,
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { parseTranscriptToTrades, TranscriptParserError } from '../transcript-parser';
import { TradeValidationError } from '../trade-validator';

function completionWithContent(content: string): { choices: Array<{ message: { content: string } }> } {
  return {
    choices: [
      {
        message: { content },
      },
    ],
  };
}

async function expectTranscriptParserError(promise: Promise<unknown>): Promise<TranscriptParserError> {
  try {
    await promise;
    throw new Error('Expected parseTranscriptToTrades to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(TranscriptParserError);
    return error as TranscriptParserError;
  }
}

describe('trade-day-replay/transcript-parser retry behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCircuitExecute.mockImplementation(async (operation: () => Promise<unknown>) => operation());
  });

  it('throws INVALID_INPUT for blank transcript and does not call OpenAI', async () => {
    const error = await expectTranscriptParserError(parseTranscriptToTrades({ transcript: '   ' }));

    expect(error.code).toBe('INVALID_INPUT');
    expect(mockCircuitExecute).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('retries once on empty response and succeeds on second attempt', async () => {
    const parsedTrades = [{ tradeIndex: 1 }];

    mockCreate
      .mockResolvedValueOnce(completionWithContent(''))
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1}]}'));
    mockValidateParsedTrades.mockReturnValueOnce(parsedTrades);

    const result = await parseTranscriptToTrades({ transcript: 'PREP 5400C ...' });

    expect(result).toEqual(parsedTrades);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Trade transcript parser retrying after parser/validation failure.',
      expect.objectContaining({ code: 'OPENAI_EMPTY_RESPONSE', attempt: 1, nextAttempt: 2 }),
    );
  });

  it('retries once on schema mismatch and succeeds on second attempt', async () => {
    const parsedTrades = [{ tradeIndex: 1 }, { tradeIndex: 2 }];

    mockCreate
      .mockResolvedValueOnce(completionWithContent('{}'))
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1},{"tradeIndex":2}]}'));
    mockValidateParsedTrades.mockReturnValueOnce(parsedTrades);

    const result = await parseTranscriptToTrades({ transcript: 'Filled ... Fully out ...' });

    expect(result).toEqual(parsedTrades);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Trade transcript parser retrying after parser/validation failure.',
      expect.objectContaining({ code: 'OPENAI_SCHEMA_MISMATCH', attempt: 1, nextAttempt: 2 }),
    );
  });

  it('does not retry non-retryable failures and throws OPENAI_REQUEST_FAILED', async () => {
    mockCreate.mockRejectedValueOnce(new Error('network timeout'));

    const error = await expectTranscriptParserError(parseTranscriptToTrades({ transcript: 'Filled 1.20' }));

    expect(error.code).toBe('OPENAI_REQUEST_FAILED');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('includes attempts count when retryable parse errors exhaust retries', async () => {
    mockCreate
      .mockResolvedValueOnce(completionWithContent('not-json'))
      .mockResolvedValueOnce(completionWithContent('not-json'));

    const error = await expectTranscriptParserError(parseTranscriptToTrades({ transcript: 'Filled ...' }));

    expect(error.code).toBe('OPENAI_JSON_PARSE_ERROR');
    expect(error.details).toEqual(expect.objectContaining({ attempts: 2 }));
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('retries once on trade validation failure and succeeds on second attempt', async () => {
    const issues = [
      { path: 'trades[0].entryTimestamp', message: 'Entry timestamp must be ISO-8601 with timezone offset.' },
    ];
    const parsedTrades = [{ tradeIndex: 1 }];

    mockCreate
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1}]}'))
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1}]}'));
    mockValidateParsedTrades
      .mockImplementationOnce(() => {
        throw new TradeValidationError('Parsed trades failed replay validation checks.', issues);
      })
      .mockReturnValueOnce(parsedTrades);

    const result = await parseTranscriptToTrades({ transcript: 'Filled 1.20' });

    expect(result).toEqual(parsedTrades);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Trade transcript parser retrying after parser/validation failure.',
      expect.objectContaining({
        code: 'TRADE_VALIDATION_FAILED',
        attempt: 1,
        nextAttempt: 2,
        nextInputTimezone: 'America/New_York',
      }),
    );
  });

  it('switches retry input timezone to New York when validation fails on market hours', async () => {
    const issues = [
      { path: 'trades[0].entryTimestamp', message: 'Entry timestamp must be within regular market hours (09:30-16:00 ET).' },
    ];
    const parsedTrades = [{ tradeIndex: 1 }];

    mockCreate
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1}]}'))
      .mockResolvedValueOnce(completionWithContent('{"trades":[{"tradeIndex":1}]}'));
    mockValidateParsedTrades
      .mockImplementationOnce(() => {
        throw new TradeValidationError('Parsed trades failed replay validation checks.', issues);
      })
      .mockReturnValueOnce(parsedTrades);

    const result = await parseTranscriptToTrades({
      transcript: 'Filled 1.20',
      inputTimezone: 'America/Chicago',
    });

    expect(result).toEqual(parsedTrades);
    expect(mockCreate).toHaveBeenCalledTimes(2);

    const firstCall = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ content: string }> };
    const secondCall = mockCreate.mock.calls[1]?.[0] as { messages: Array<{ content: string }> };
    const firstUserPrompt = firstCall.messages[1]?.content ?? '';
    const secondUserPrompt = secondCall.messages[1]?.content ?? '';

    expect(firstUserPrompt).toContain('Input timezone: America/Chicago');
    expect(secondUserPrompt).toContain('Input timezone: America/New_York');
    expect(secondUserPrompt).toContain('Timezone correction: previous parse likely misread source timezone.');
  });
});
