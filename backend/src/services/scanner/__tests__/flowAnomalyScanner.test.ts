import { detectFlowAnomaly, FLOW_ANOMALY_THRESHOLD } from '../flowAnomalyScanner';
import type { OptionsChainResponse } from '../../options/types';

function buildChain(overrides?: Partial<OptionsChainResponse>): OptionsChainResponse {
  return {
    symbol: 'SPX',
    currentPrice: 6000,
    expiry: '2026-03-20',
    daysToExpiry: 20,
    options: {
      calls: [
        {
          symbol: 'SPX',
          strike: 6020,
          expiry: '2026-03-20',
          type: 'call',
          last: 25,
          bid: 24.8,
          ask: 25.2,
          volume: 18000,
          openInterest: 1800,
          impliedVolatility: 0.26,
          delta: 0.35,
          gamma: 0.01,
          theta: -0.4,
          vega: 0.2,
          rho: 0.1,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 25,
        },
      ],
      puts: [
        {
          symbol: 'SPX',
          strike: 5980,
          expiry: '2026-03-20',
          type: 'put',
          last: 22,
          bid: 21.5,
          ask: 22.5,
          volume: 1400,
          openInterest: 6000,
          impliedVolatility: 0.24,
          delta: -0.3,
          gamma: 0.008,
          theta: -0.35,
          vega: 0.18,
          rho: -0.08,
          inTheMoney: false,
          intrinsicValue: 0,
          extrinsicValue: 22,
        },
      ],
    },
    ...overrides,
  };
}

describe('flow anomaly scanner', () => {
  it('detects high-intensity flow anomalies', () => {
    const anomaly = detectFlowAnomaly(buildChain(), Date.parse('2026-02-24T15:35:00.000Z'));
    expect(anomaly).not.toBeNull();
    expect((anomaly as NonNullable<typeof anomaly>).anomalyScore).toBeGreaterThanOrEqual(FLOW_ANOMALY_THRESHOLD);
    expect((anomaly as NonNullable<typeof anomaly>).averagePathLength).toBeLessThan(5);
    expect((anomaly as NonNullable<typeof anomaly>).direction).toBe('bullish');
  });

  it('ignores low-signal contracts that resemble baseline flow', () => {
    const chain = buildChain({
      options: {
        calls: [
          {
            symbol: 'SPX',
            strike: 6005,
            expiry: '2026-03-20',
            type: 'call',
            last: 18,
            bid: 17.6,
            ask: 18.4,
            volume: 2200,
            openInterest: 2600,
            impliedVolatility: 0.22,
            delta: 0.45,
            gamma: 0.01,
            theta: -0.3,
            vega: 0.15,
            rho: 0.05,
            inTheMoney: false,
            intrinsicValue: 0,
            extrinsicValue: 18,
          },
        ],
        puts: [
          {
            symbol: 'SPX',
            strike: 5995,
            expiry: '2026-03-20',
            type: 'put',
            last: 17,
            bid: 16.6,
            ask: 17.4,
            volume: 2100,
            openInterest: 2500,
            impliedVolatility: 0.23,
            delta: -0.45,
            gamma: 0.01,
            theta: -0.3,
            vega: 0.15,
            rho: -0.05,
            inTheMoney: false,
            intrinsicValue: 0,
            extrinsicValue: 17,
          },
        ],
      },
    });

    const anomaly = detectFlowAnomaly(chain, Date.parse('2026-02-24T18:00:00.000Z'));
    expect(anomaly).toBeNull();
  });

  it('isolates anomalous contracts in fewer tree steps than baseline candidates', () => {
    const highSignal = detectFlowAnomaly(buildChain(), Date.parse('2026-02-24T15:35:00.000Z'));
    const baselineChain = buildChain({
      options: {
        calls: [
          {
            symbol: 'SPX',
            strike: 6005,
            expiry: '2026-03-20',
            type: 'call',
            last: 18,
            bid: 17.6,
            ask: 18.4,
            volume: 2200,
            openInterest: 2600,
            impliedVolatility: 0.22,
            delta: 0.45,
            gamma: 0.01,
            theta: -0.3,
            vega: 0.15,
            rho: 0.05,
            inTheMoney: false,
            intrinsicValue: 0,
            extrinsicValue: 18,
          },
        ],
        puts: [],
      },
    });
    const baseline = detectFlowAnomaly(baselineChain, Date.parse('2026-02-24T18:00:00.000Z'));

    expect(highSignal).not.toBeNull();
    expect(baseline).toBeNull();
    expect((highSignal as NonNullable<typeof highSignal>).averagePathLength).toBeLessThan(6);
  });
});
