import { detectConfluence, formatConfluenceForAI } from '../confluenceDetector';
import type { LevelsResponse } from '../index';

function buildLevelsResponse(): LevelsResponse {
  return {
    symbol: 'SPX',
    timestamp: '2026-02-10T18:00:00.000Z',
    currentPrice: 5950,
    levels: {
      resistance: [
        {
          type: 'PDH',
          price: 5960,
          distance: 10,
          distancePct: 0.17,
          distanceATR: 0.2,
          strength: 'critical',
          description: 'Previous Day High',
          side: 'resistance',
        },
        {
          type: 'R1',
          price: 5961,
          distance: 11,
          distancePct: 0.18,
          distanceATR: 0.22,
          strength: 'strong',
          description: 'Resistance 1',
          side: 'resistance',
        },
      ],
      support: [
        {
          type: 'VWAP',
          price: 5938,
          distance: -12,
          distancePct: -0.2,
          distanceATR: -0.24,
          strength: 'dynamic',
          description: 'VWAP',
          side: 'support',
        },
      ],
      pivots: {
        standard: {},
        camarilla: {},
        fibonacci: {},
      },
      indicators: {
        vwap: 5938,
        atr14: 48,
      },
    },
    marketContext: {
      marketStatus: 'open',
      sessionType: 'regular',
      timeSinceOpen: '2h 30m',
    },
    cached: false,
    cacheExpiresAt: null,
  };
}

describe('confluenceDetector', () => {
  it('detects clustered key levels + Fibonacci levels', () => {
    const levels = buildLevelsResponse();
    const fib = {
      symbol: 'SPX',
      swingHigh: 6000,
      swingHighIndex: 10,
      swingLow: 5900,
      swingLowIndex: 2,
      timeframe: 'daily',
      lookbackBars: 20,
      direction: 'retracement' as const,
      levels: {
        level_0: 6000,
        level_236: 5976.4,
        level_382: 5961.8,
        level_500: 5950,
        level_618: 5938.2,
        level_786: 5921.4,
        level_100: 5900,
      },
      calculatedAt: '2026-02-10T18:00:00.000Z',
    };

    const zones = detectConfluence(
      levels,
      fib,
      { flipPoint: 5939, maxGEXStrike: 5960.4 },
      levels.currentPrice,
    );

    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0].levelsInZone.length).toBeGreaterThanOrEqual(2);
  });

  it('formats confluence output for AI', () => {
    const output = formatConfluenceForAI([
      {
        priceCenter: 5960.5,
        priceRangeLow: 5960,
        priceRangeHigh: 5961,
        levelsInZone: [
          { type: 'PDH', price: 5960, source: 'key_levels' },
          { type: 'Fib 38.2%', price: 5961, source: 'fibonacci' },
        ],
        strength: 'moderate',
        side: 'resistance',
        description: '2-way confluence near 5960.5',
      },
    ]);

    expect(output).toContain('CONFLUENCE ZONES');
    expect(output).toContain('Fib 38.2%');
  });

  it('returns explicit no-confluence text for empty input', () => {
    expect(formatConfluenceForAI([])).toBe('No significant confluence zones detected.');
  });
});

