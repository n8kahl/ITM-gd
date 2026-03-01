import { toEasternTime } from '../../marketHours';
import { TradeValidationError, validateParsedTrades } from '../trade-validator';

interface TradeOverrides {
  entryTimestamp?: string;
  exitEvents?: Array<{
    type: 'trim' | 'stop' | 'trail_stop' | 'breakeven_stop' | 'full_exit';
    percentage?: number;
    timestamp: string;
  }>;
  stopLevels?: Array<{ spxLevel: number; timestamp: string }>;
}

function createParsedTrade(overrides: TradeOverrides = {}) {
  return {
    tradeIndex: 1,
    contract: {
      symbol: 'SPX' as const,
      strike: 6200,
      type: 'call' as const,
      expiry: '2026-03-06',
    },
    direction: 'long' as const,
    entryPrice: 2.15,
    entryTimestamp: overrides.entryTimestamp ?? '2026-03-02T09:35:00-05:00',
    exitEvents: overrides.exitEvents ?? [
      {
        type: 'trim' as const,
        percentage: 50,
        timestamp: '2026-03-02T09:50:00-05:00',
      },
      {
        type: 'full_exit' as const,
        timestamp: '2026-03-02T10:15:00-05:00',
      },
    ],
    stopLevels: overrides.stopLevels ?? [
      { spxLevel: 6188.25, timestamp: '2026-03-02T09:40:00-05:00' },
    ],
    spxReferences: [6200, 6210],
    sizing: 'normal' as const,
    rawMessages: ['PREP', 'Filled', 'Trim', 'Fully out'],
  };
}

describe('trade-day-replay/trade-validator timezone drift repair', () => {
  it('accepts a valid in-session trade without modification', () => {
    const input = [createParsedTrade()];
    const result = validateParsedTrades(input);

    expect(result).toHaveLength(1);
    expect(result[0].entryTimestamp).toBe('2026-03-02T09:35:00-05:00');
  });

  it('auto-repairs one-hour early timestamps when all trade timestamps are outside regular session', () => {
    const input = [createParsedTrade({
      entryTimestamp: '2026-03-02T08:35:00-05:00',
      exitEvents: [
        {
          type: 'trim',
          percentage: 50,
          timestamp: '2026-03-02T08:50:00-05:00',
        },
        {
          type: 'full_exit',
          timestamp: '2026-03-02T09:05:00-05:00',
        },
      ],
      stopLevels: [{ spxLevel: 6188.25, timestamp: '2026-03-02T08:40:00-05:00' }],
    })];

    const result = validateParsedTrades(input);
    expect(result).toHaveLength(1);

    const entryDate = new Date(result[0].entryTimestamp);
    const entryEt = toEasternTime(entryDate);
    expect(entryEt.hour).toBe(9);
    expect(entryEt.minute).toBe(35);
  });

  it('does not auto-repair mixed valid/invalid timestamps and still reports regular-hours validation errors', () => {
    const input = [createParsedTrade({
      entryTimestamp: '2026-03-02T09:35:00-05:00',
      exitEvents: [
        {
          type: 'trim',
          percentage: 50,
          timestamp: '2026-03-02T09:50:00-05:00',
        },
        {
          type: 'full_exit',
          timestamp: '2026-03-02T18:10:00-05:00',
        },
      ],
    })];

    try {
      validateParsedTrades(input);
      throw new Error('Expected validateParsedTrades to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(TradeValidationError);
      const validationError = error as TradeValidationError;
      expect(validationError.issues.some((issue) => issue.path.includes('exitEvents[1].timestamp'))).toBe(true);
      expect(validationError.issues.some((issue) => issue.message.includes('regular market hours'))).toBe(true);
    }
  });
});
