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

    const second = ingestTickMicrobars({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6001,
      size: 3,
      timestamp: 1700000000400,
      sequence: 2,
    });

    expect(second).toHaveLength(2);
    const current1s = second.find((bar) => bar.interval === '1s');
    expect(current1s?.open).toBe(6000);
    expect(current1s?.high).toBe(6001);
    expect(current1s?.low).toBe(6000);
    expect(current1s?.close).toBe(6001);
    expect(current1s?.volume).toBe(5);
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
});
