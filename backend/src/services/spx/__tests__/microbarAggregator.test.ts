import {
  getWorkingMicrobar,
  ingestTickMicrobars,
  resetMicrobarAggregator,
} from '../microbarAggregator';

describe('spx/microbarAggregator', () => {
  beforeEach(() => {
    resetMicrobarAggregator();
  });

  it('builds 1s and 5s bars from tick stream', () => {
    const first = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000,
      size: 2,
      timestamp: 1700000000000,
      sequence: 1,
    });

    expect(first).toHaveLength(2);
    expect(first[0].interval).toBe('1s');
    expect(first[1].interval).toBe('5s');
    expect(first.every((bar) => bar.finalized === false)).toBe(true);
    expect(first[0]?.neutralVolume).toBe(2);
    expect(first[0]?.buyVolume).toBe(0);
    expect(first[0]?.sellVolume).toBe(0);
    expect(first[0]?.deltaVolume).toBe(0);
    expect(first[0]?.bidAskImbalance).toBeNull();

    const second = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6001,
      size: 3,
      timestamp: 1700000000400,
      sequence: 2,
      bid: 6000.75,
      ask: 6001,
      bidSize: 10,
      askSize: 6,
    });

    expect(second).toHaveLength(2);
    const current1s = second.find((bar) => bar.interval === '1s');
    expect(current1s?.open).toBe(6000);
    expect(current1s?.high).toBe(6001);
    expect(current1s?.low).toBe(6000);
    expect(current1s?.close).toBe(6001);
    expect(current1s?.volume).toBe(5);
    expect(current1s?.neutralVolume).toBe(2);
    expect(current1s?.buyVolume).toBe(3);
    expect(current1s?.sellVolume).toBe(0);
    expect(current1s?.deltaVolume).toBe(3);
    expect(current1s?.bidSize).toBe(10);
    expect(current1s?.askSize).toBe(6);
    expect(current1s?.bidAskImbalance).toBe(0.25);
    expect(current1s?.bidSizeAtClose).toBe(10);
    expect(current1s?.askSizeAtClose).toBe(6);
    expect(current1s?.askBidSizeRatio).toBe(0.6);
    expect(current1s?.quoteCoveragePct).toBe(0.5);
    expect(current1s?.avgSpreadBps).toBeCloseTo(0.4166, 4);
  });

  it('finalizes previous bar when bucket rolls', () => {
    ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000,
      size: 1,
      timestamp: 1700000000000,
      sequence: 1,
    });

    const rolled = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6002,
      size: 1,
      timestamp: 1700000001200,
      sequence: 2,
    });

    const finalized1s = rolled.find((bar) => bar.interval === '1s' && bar.finalized);
    const new1s = rolled.find((bar) => bar.interval === '1s' && !bar.finalized);
    expect(finalized1s).toBeTruthy();
    expect(new1s).toBeTruthy();
    expect(finalized1s?.close).toBe(6000);
    expect(new1s?.open).toBe(6002);
  });

  it('ignores out-of-order bucket updates', () => {
    ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6001,
      size: 1,
      timestamp: 1700000002000,
      sequence: 3,
    });

    const outOfOrder = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 5999,
      size: 1,
      timestamp: 1700000001500,
      sequence: 2,
    });

    expect(outOfOrder.some((bar) => bar.interval === '1s')).toBe(false);
    expect(outOfOrder.some((bar) => bar.interval === '5s')).toBe(true);
    expect(getWorkingMicrobar('SPX', '1s')?.close).toBe(6001);
  });

  it('aggregates buy and sell pressure into delta volume', () => {
    ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000.5,
      size: 4,
      timestamp: 1700000000000,
      sequence: 1,
      bid: 6000.25,
      ask: 6000.5,
      bidSize: 18,
      askSize: 12,
    });

    const updates = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6000.25,
      size: 3,
      timestamp: 1700000000300,
      sequence: 2,
      bid: 6000.25,
      ask: 6000.75,
      bidSize: 20,
      askSize: 15,
    });

    const bar = updates.find((item) => item.interval === '1s');
    expect(bar?.buyVolume).toBe(4);
    expect(bar?.sellVolume).toBe(3);
    expect(bar?.neutralVolume).toBe(0);
    expect(bar?.deltaVolume).toBe(1);
    expect(bar?.bidSize).toBe(19);
    expect(bar?.askSize).toBe(13.5);
    expect(bar?.bidAskImbalance).toBeCloseTo(0.1692, 4);
    expect(bar?.bidSizeAtClose).toBe(20);
    expect(bar?.askSizeAtClose).toBe(15);
    expect(bar?.askBidSizeRatio).toBe(0.75);
    expect(bar?.quoteCoveragePct).toBe(1);
    expect(bar?.avgSpreadBps).toBeCloseTo(0.625, 3);
  });
});
