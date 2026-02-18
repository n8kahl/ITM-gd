import { __testables } from '../massiveTickStream';

describe('massiveTickStream helpers', () => {
  it('parses configured symbol lists', () => {
    expect(__testables.parseSymbols('SPX,SPY, I:SPX')).toEqual(['SPX', 'SPY']);
  });

  it('builds subscription params with event prefix', () => {
    const params = __testables.toSubscriptionParams(['SPX', 'SPY'], 'V.');
    expect(params).toBe('V.I:SPX,V.SPY');
  });

  it('normalizes nanosecond timestamps to milliseconds', () => {
    expect(__testables.normalizeTimestamp(1700000000000000000)).toBe(1700000000000);
  });

  it('extracts tick payload from provider events', () => {
    const parsed = __testables.parseTickPayload({
      sym: 'I:SPX',
      val: 6032.75,
      s: 13,
      t: 1700000000123,
      q: 91,
    });

    expect(parsed).toEqual({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6032.75,
      size: 13,
      timestamp: 1700000000123,
      sequence: 91,
    });
  });

  it('returns null for non-price payloads', () => {
    const parsed = __testables.parseTickPayload({
      ev: 'status',
      status: 'connected',
    });
    expect(parsed).toBeNull();
  });
});
