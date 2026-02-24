import { __testables } from '../setupDetector';

describe('spx/vwap setup detection', () => {
  it('detects bullish VWAP reclaim on close crossing above VWAP within 1SD band', () => {
    const detected = __testables.detectVWAPReclaim({
      currentPrice: 100.2,
      previousBarClose: 99.8,
      vwap: 100,
      direction: 'bullish',
      vwapBand1SD: { upper: 101, lower: 99 },
    });

    expect(detected).toBe(true);
  });

  it('detects bearish VWAP reclaim on close crossing below VWAP within 1SD band', () => {
    const detected = __testables.detectVWAPReclaim({
      currentPrice: 99.8,
      previousBarClose: 100.3,
      vwap: 100,
      direction: 'bearish',
      vwapBand1SD: { upper: 101, lower: 99 },
    });

    expect(detected).toBe(true);
  });

  it('detects VWAP fade at upper 1.5-2SD extension band', () => {
    const result = __testables.detectVWAPFade({
      currentPrice: 102.2,
      vwapBand15SD: { upper: 102, lower: 98 },
      vwapBand2SD: { upper: 103, lower: 97 },
    });

    expect(result).toEqual({ detected: true, direction: 'bearish' });
  });

  it('detects VWAP fade at lower 1.5-2SD extension band', () => {
    const result = __testables.detectVWAPFade({
      currentPrice: 97.8,
      vwapBand15SD: { upper: 102, lower: 98 },
      vwapBand2SD: { upper: 103, lower: 97 },
    });

    expect(result).toEqual({ detected: true, direction: 'bullish' });
  });

  it('returns no VWAP fade outside extension bands', () => {
    const result = __testables.detectVWAPFade({
      currentPrice: 103.8,
      vwapBand15SD: { upper: 102, lower: 98 },
      vwapBand2SD: { upper: 103, lower: 97 },
    });

    expect(result.detected).toBe(false);
  });

  it('builds VWAP-specific entry, stop, and targets for reclaim/fade setups', () => {
    const indicatorContext = {
      vwapPrice: 100,
      vwapBand1SD: { upper: 101, lower: 99 },
      vwapBand15SD: { upper: 102, lower: 98 },
      vwapBand2SD: { upper: 103, lower: 97 },
    } as any;

    const reclaimBullish = __testables.buildVWAPSetupGeometry({
      setupType: 'vwap_reclaim',
      direction: 'bullish',
      indicatorContext,
    });
    expect(reclaimBullish).toMatchObject({
      entryLow: 99.5,
      entryHigh: 100.5,
      stop: 98,
      target1: 101,
      target2: 102,
    });

    const fadeBearish = __testables.buildVWAPSetupGeometry({
      setupType: 'vwap_fade_at_band',
      direction: 'bearish',
      indicatorContext,
    });
    expect(fadeBearish).toMatchObject({
      entryLow: 101,
      entryHigh: 103,
      stop: 105,
      target1: 100,
      target2: 99.5,
    });
  });
});
