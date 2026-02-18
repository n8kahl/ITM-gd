import {
  configureTickCache,
  getLatestTick,
  getRecentTicks,
  ingestTick,
  normalizeTickSymbol,
  resetTickCache,
} from '../tickCache';

describe('tickCache', () => {
  beforeEach(() => {
    resetTickCache();
  });

  it('normalizes index symbols consistently', () => {
    expect(normalizeTickSymbol('I:SPX')).toBe('SPX');
    expect(normalizeTickSymbol(' spy ')).toBe('SPY');
  });

  it('ingests and returns latest tick', () => {
    const accepted = ingestTick({
      symbol: 'I:SPX',
      rawSymbol: 'I:SPX',
      price: 6025.5,
      size: 20,
      timestamp: 1700000000000,
      sequence: 10,
    });

    expect(accepted).toBe(true);
    expect(getLatestTick('SPX')).toEqual({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6025.5,
      size: 20,
      timestamp: 1700000000000,
      sequence: 10,
    });
  });

  it('drops duplicate and out-of-order sequence ticks', () => {
    expect(ingestTick({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6026,
      size: 5,
      timestamp: 1700000000100,
      sequence: 11,
    })).toBe(true);

    // Duplicate
    expect(ingestTick({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6026,
      size: 5,
      timestamp: 1700000000100,
      sequence: 11,
    })).toBe(false);

    // Out of order sequence
    expect(ingestTick({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6026.25,
      size: 4,
      timestamp: 1700000000200,
      sequence: 10,
    })).toBe(false);
  });

  it('drops out-of-order timestamp when no sequence is provided', () => {
    expect(ingestTick({
      symbol: 'SPY',
      rawSymbol: 'I:SPY',
      price: 604.1,
      size: 6,
      timestamp: 1700000005000,
      sequence: null,
    })).toBe(true);

    expect(ingestTick({
      symbol: 'SPY',
      rawSymbol: 'I:SPY',
      price: 604.2,
      size: 6,
      timestamp: 1700000004000,
      sequence: null,
    })).toBe(false);
  });

  it('trims rolling buffer to configured max size', () => {
    configureTickCache({ maxTicksPerSymbol: 3 });
    ingestTick({ symbol: 'SPX', rawSymbol: 'I:SPX', price: 6000, size: 1, timestamp: 1, sequence: 1 });
    ingestTick({ symbol: 'SPX', rawSymbol: 'I:SPX', price: 6001, size: 1, timestamp: 2, sequence: 2 });
    ingestTick({ symbol: 'SPX', rawSymbol: 'I:SPX', price: 6002, size: 1, timestamp: 3, sequence: 3 });
    ingestTick({ symbol: 'SPX', rawSymbol: 'I:SPX', price: 6003, size: 1, timestamp: 4, sequence: 4 });

    const ticks = getRecentTicks('SPX', 10);
    expect(ticks).toHaveLength(3);
    expect(ticks[0].price).toBe(6001);
    expect(ticks[2].price).toBe(6003);
  });
});

