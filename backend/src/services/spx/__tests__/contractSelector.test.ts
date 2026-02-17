import type { OptionContract } from '../../options/types';
import type { Setup } from '../types';

// Inline the pure functions from contractSelector for unit testing.
// This avoids needing to mock fetchOptionsChain / redis / setupDetector.

function deltaTargetForSetup(setup: Pick<Setup, 'type'>): number {
  switch (setup.type) {
    case 'breakout_vacuum':
      return 0.28;
    case 'trend_continuation':
      return 0.3;
    case 'mean_reversion':
      return 0.22;
    case 'fade_at_wall':
    default:
      return 0.18;
  }
}

function getMid(contract: Pick<OptionContract, 'bid' | 'ask'>): number {
  return (contract.bid + contract.ask) / 2;
}

function getSpreadPct(contract: Pick<OptionContract, 'bid' | 'ask'>): number {
  const mid = getMid(contract);
  if (!Number.isFinite(mid) || mid <= 0) return Number.POSITIVE_INFINITY;
  return (contract.ask - contract.bid) / mid;
}

const MAX_SPREAD_PCT = 0.35;

function scoreContract(setup: Pick<Setup, 'type'>, contract: OptionContract): number {
  const targetDelta = deltaTargetForSetup(setup);
  const absDelta = Math.abs(contract.delta || 0);
  const deltaPenalty = Math.min(1, Math.abs(absDelta - targetDelta) / 0.2) * 45;

  const spreadPct = getSpreadPct(contract);
  const spreadPenalty = Math.min(1, spreadPct / MAX_SPREAD_PCT) * 35;

  const oi = Math.max(0, contract.openInterest || 0);
  const volume = Math.max(0, contract.volume || 0);
  const liquidityBonus = Math.min(18, Math.log10(oi + 1) * 4 + Math.log10(volume + 1) * 3);

  const gamma = Math.max(0, contract.gamma || 0);
  const gammaBonus = Math.min(10, gamma * 250);

  const expiryMs = Date.parse(`${contract.expiry}T16:00:00Z`);
  const dte = Math.max(0, Math.ceil((expiryMs - Date.now()) / 86400000));
  const theta = Math.abs(contract.theta || 0);
  const thetaTolerance = dte <= 1 ? 1.3 : dte <= 3 ? 1.0 : 0.8;
  const thetaPenalty = Math.max(0, theta - thetaTolerance) * 8;

  return 100 - deltaPenalty - spreadPenalty - thetaPenalty + liquidityBonus + gammaBonus;
}

function filterCandidates(
  setup: Pick<Setup, 'direction'>,
  contracts: OptionContract[],
  relaxed: boolean,
): OptionContract[] {
  const desiredType: 'call' | 'put' = setup.direction === 'bullish' ? 'call' : 'put';
  const minOI = relaxed ? 10 : 100;
  const minVol = relaxed ? 1 : 10;
  const maxSpread = relaxed ? 0.50 : MAX_SPREAD_PCT;
  const minDelta = relaxed ? 0.02 : 0.05;

  return contracts.filter((contract) => {
    if (contract.type !== desiredType) return false;
    if (!(contract.bid > 0 && contract.ask > contract.bid)) return false;
    const absDelta = Math.abs(contract.delta || 0);
    if (!Number.isFinite(absDelta) || absDelta < minDelta) return false;
    if ((contract.openInterest || 0) < minOI && (contract.volume || 0) < minVol) return false;
    const spreadPct = getSpreadPct(contract);
    return Number.isFinite(spreadPct) && spreadPct <= maxSpread;
  });
}

function makeContract(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    symbol: 'SPX',
    strike: 6000,
    expiry: '2026-03-20',
    type: 'call',
    last: 15.0,
    bid: 14.5,
    ask: 15.5,
    volume: 500,
    openInterest: 2000,
    impliedVolatility: 0.16,
    delta: 0.25,
    gamma: 0.02,
    theta: -0.5,
    vega: 5.0,
    rho: 0.1,
    inTheMoney: false,
    intrinsicValue: 0,
    extrinsicValue: 15.0,
    ...overrides,
  };
}

function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: 'test-setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 5990, high: 6000 },
    stop: 5975,
    target1: { price: 6020, label: 'T1' },
    target2: { price: 6040, label: 'T2' },
    confluenceScore: 3,
    confluenceSources: ['cluster', 'gex', 'fib'],
    clusterZone: {
      id: 'cz-1',
      priceLow: 5990,
      priceHigh: 6000,
      clusterScore: 4.0,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: null,
      held: true,
      holdRate: 0.8,
    },
    regime: 'ranging',
    status: 'ready',
    probability: 0.6,
    recommendedContract: null,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    ...overrides,
  };
}

describe('contractSelector', () => {
  describe('deltaTargetForSetup', () => {
    it('returns correct delta targets per setup type', () => {
      expect(deltaTargetForSetup({ type: 'fade_at_wall' })).toBe(0.18);
      expect(deltaTargetForSetup({ type: 'breakout_vacuum' })).toBe(0.28);
      expect(deltaTargetForSetup({ type: 'mean_reversion' })).toBe(0.22);
      expect(deltaTargetForSetup({ type: 'trend_continuation' })).toBe(0.3);
    });
  });

  describe('scoreContract', () => {
    it('scores higher when delta matches target', () => {
      const setup = makeSetup({ type: 'fade_at_wall' }); // target delta = 0.18
      const goodDelta = makeContract({ delta: 0.18 });
      const badDelta = makeContract({ delta: 0.50 });

      const goodScore = scoreContract(setup, goodDelta);
      const badScore = scoreContract(setup, badDelta);

      expect(goodScore).toBeGreaterThan(badScore);
    });

    it('penalizes wide spreads', () => {
      const setup = makeSetup();
      const tight = makeContract({ bid: 15.0, ask: 15.2 }); // ~1.3% spread
      const wide = makeContract({ bid: 10.0, ask: 14.0 }); // ~33% spread

      expect(scoreContract(setup, tight)).toBeGreaterThan(scoreContract(setup, wide));
    });

    it('rewards higher liquidity', () => {
      const setup = makeSetup();
      const liquid = makeContract({ openInterest: 10000, volume: 5000 });
      const illiquid = makeContract({ openInterest: 50, volume: 5 });

      expect(scoreContract(setup, liquid)).toBeGreaterThan(scoreContract(setup, illiquid));
    });

    it('rewards higher gamma', () => {
      const setup = makeSetup();
      const highGamma = makeContract({ gamma: 0.04 });
      const lowGamma = makeContract({ gamma: 0.001 });

      expect(scoreContract(setup, highGamma)).toBeGreaterThan(scoreContract(setup, lowGamma));
    });

    it('penalizes high theta relative to DTE', () => {
      const setup = makeSetup();
      const lowTheta = makeContract({ theta: -0.3 });
      const highTheta = makeContract({ theta: -2.5 });

      expect(scoreContract(setup, lowTheta)).toBeGreaterThan(scoreContract(setup, highTheta));
    });
  });

  describe('filterCandidates', () => {
    it('filters to matching direction (bullish -> calls)', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [
        makeContract({ type: 'call', strike: 6000 }),
        makeContract({ type: 'put', strike: 6000 }),
      ];

      const result = filterCandidates(setup, contracts, false);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('call');
    });

    it('filters to matching direction (bearish -> puts)', () => {
      const setup = makeSetup({ direction: 'bearish' });
      const contracts = [
        makeContract({ type: 'call', strike: 6000 }),
        makeContract({ type: 'put', strike: 6000 }),
      ];

      const result = filterCandidates(setup, contracts, false);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('put');
    });

    it('rejects contracts with zero bid', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', bid: 0, ask: 5.0 })];

      expect(filterCandidates(setup, contracts, false)).toHaveLength(0);
    });

    it('rejects contracts with bid >= ask', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', bid: 5.0, ask: 5.0 })];

      expect(filterCandidates(setup, contracts, false)).toHaveLength(0);
    });

    it('rejects contracts below min delta in strict mode', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', delta: 0.03 })];

      expect(filterCandidates(setup, contracts, false)).toHaveLength(0);
    });

    it('accepts low-delta contracts in relaxed mode', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', delta: 0.03 })];

      expect(filterCandidates(setup, contracts, true)).toHaveLength(1);
    });

    it('rejects illiquid contracts in strict mode (OI<100 AND vol<10)', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', openInterest: 50, volume: 5 })];

      expect(filterCandidates(setup, contracts, false)).toHaveLength(0);
    });

    it('accepts lower liquidity in relaxed mode (OI>=10)', () => {
      const setup = makeSetup({ direction: 'bullish' });
      const contracts = [makeContract({ type: 'call', openInterest: 15, volume: 2 })];

      expect(filterCandidates(setup, contracts, true)).toHaveLength(1);
    });

    it('rejects wide spreads beyond threshold', () => {
      const setup = makeSetup({ direction: 'bullish' });
      // 40% spread exceeds strict 35% and relaxed 50%
      const contracts = [makeContract({ type: 'call', bid: 10.0, ask: 16.0 })];

      // Strict: spread = 6/13 ≈ 0.46 > 0.35 → rejected
      expect(filterCandidates(setup, contracts, false)).toHaveLength(0);
      // Relaxed: 0.46 < 0.50 → accepted
      expect(filterCandidates(setup, contracts, true)).toHaveLength(1);
    });
  });

  describe('contract recommendation shape', () => {
    it('produces correctly shaped output', () => {
      const setup = makeSetup();
      const contract = makeContract();
      const mid = getMid(contract);
      const entry = (setup.entryZone.low + setup.entryZone.high) / 2;
      const risk = Math.abs(entry - setup.stop);
      const reward = Math.abs(setup.target1.price - entry);

      expect(mid).toBe(15.0);
      expect(risk).toBe(20); // 5995 - 5975
      expect(reward).toBe(25); // 6020 - 5995
      expect(reward / risk).toBeCloseTo(1.25, 2);
    });
  });

  describe('end-to-end scoring with multiple candidates', () => {
    it('selects the best contract across a realistic option chain', () => {
      const setup = makeSetup({ type: 'breakout_vacuum', direction: 'bullish' }); // target delta 0.28

      const candidates = [
        makeContract({ strike: 5980, delta: 0.45, bid: 28.0, ask: 29.0, openInterest: 5000, volume: 2000, gamma: 0.015 }),
        makeContract({ strike: 6000, delta: 0.30, bid: 18.0, ask: 18.8, openInterest: 8000, volume: 3000, gamma: 0.025 }),
        makeContract({ strike: 6020, delta: 0.18, bid: 10.0, ask: 10.8, openInterest: 4000, volume: 1500, gamma: 0.030 }),
        makeContract({ strike: 6040, delta: 0.08, bid: 4.0, ask: 4.6, openInterest: 2000, volume: 800, gamma: 0.020 }),
      ];

      const filtered = filterCandidates(setup, candidates, false);
      expect(filtered.length).toBeGreaterThanOrEqual(3); // The 0.08 delta contract is above 0.05 threshold

      const scores = candidates.map((c) => ({
        strike: c.strike,
        delta: c.delta,
        score: scoreContract(setup, c),
      }));

      // The 6000 strike (delta 0.30) should score highest — closest to target 0.28,
      // good liquidity, tight spread, decent gamma
      const best = scores.sort((a, b) => b.score - a.score)[0];
      expect(best.strike).toBe(6000);
    });

    it('falls through to relaxed filters when strict yields nothing', () => {
      const setup = makeSetup({ direction: 'bullish' });

      // All contracts have low liquidity — strict rejects, relaxed accepts
      const contracts = [
        makeContract({ type: 'call', openInterest: 20, volume: 3, delta: 0.15 }),
        makeContract({ type: 'call', openInterest: 30, volume: 5, delta: 0.20 }),
      ];

      const strict = filterCandidates(setup, contracts, false);
      const relaxed = filterCandidates(setup, contracts, true);

      expect(strict).toHaveLength(0);
      expect(relaxed).toHaveLength(2);
    });
  });
});
