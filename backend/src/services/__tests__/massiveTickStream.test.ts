import { __testables } from '../massiveTickStream';

describe('massiveTickStream helpers', () => {
  const previousL2Flag = process.env.ENABLE_L2_MICROSTRUCTURE;

  afterEach(() => {
    if (previousL2Flag == null) {
      delete process.env.ENABLE_L2_MICROSTRUCTURE;
      return;
    }
    process.env.ENABLE_L2_MICROSTRUCTURE = previousL2Flag;
  });

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
    process.env.ENABLE_L2_MICROSTRUCTURE = 'true';
    const parsed = __testables.parseTickPayload({
      sym: 'I:SPX',
      val: 6032.75,
      s: 13,
      t: 1700000000123,
      q: 91,
      bid: 6032.5,
      ask: 6032.75,
      bid_size: 42,
      ask_size: 28,
    });

    expect(parsed).toEqual({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6032.75,
      size: 13,
      timestamp: 1700000000123,
      sequence: 91,
      bid: 6032.5,
      ask: 6032.75,
      bidSize: 42,
      askSize: 28,
      aggressorSide: 'buyer',
    });
  });

  it('disables quote microstructure fields when feature flag is off', () => {
    process.env.ENABLE_L2_MICROSTRUCTURE = 'false';
    const parsed = __testables.parseTickPayload({
      sym: 'I:SPX',
      val: 6032.5,
      s: 5,
      t: 1700000000222,
      q: 92,
      bid: 6032.25,
      ask: 6032.5,
      bid_size: 12,
      ask_size: 10,
    });

    expect(parsed).toEqual({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6032.5,
      size: 5,
      timestamp: 1700000000222,
      sequence: 92,
      bid: null,
      ask: null,
      bidSize: null,
      askSize: null,
      aggressorSide: 'neutral',
    });
  });

  it('returns null for non-price payloads', () => {
    const parsed = __testables.parseTickPayload({
      ev: 'status',
      status: 'connected',
    });
    expect(parsed).toBeNull();
  });

  it('auth timeout control path transitions to error and requests reconnect', () => {
    const timeout = __testables.evaluateAuthTimeout('authenticating');
    expect(timeout.nextState).toBe('error');
    expect(timeout.action).toBe('reconnect');
  });

  it('auth failure status transitions to error and requests reconnect', () => {
    const statusEvent = __testables.parseStatusEvent({
      ev: 'status',
      status: 'auth_failed',
      message: 'authentication failed',
    });
    expect(statusEvent).not.toBeNull();

    const next = __testables.evaluateAuthControlEvent('authenticating', statusEvent!);
    expect(next.nextState).toBe('error');
    expect(next.action).toBe('reconnect');
  });

  it('requests subscriptions only after auth success while authenticating', () => {
    const authSuccess = __testables.parseStatusEvent({
      ev: 'status',
      status: 'auth_success',
      message: 'authenticated',
    });
    expect(authSuccess).not.toBeNull();

    const inAuth = __testables.evaluateAuthControlEvent('authenticating', authSuccess!);
    expect(inAuth.nextState).toBe('authenticated');
    expect(inAuth.action).toBe('send_subscriptions');

    const inConnecting = __testables.evaluateAuthControlEvent('connecting', authSuccess!);
    expect(inConnecting.action).toBe('none');
  });

  it('only processes tick payloads while stream state is active', () => {
    expect(__testables.shouldProcessTickEvent('active')).toBe(true);
    expect(__testables.shouldProcessTickEvent('authenticating')).toBe(false);
    expect(__testables.shouldProcessTickEvent('subscribing')).toBe(false);
  });
});
