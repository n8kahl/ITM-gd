import WebSocket from 'ws';
import { getEnv } from '../../config/env';
import { redisClient } from '../../config/redis';
import { logger } from '../../lib/logger';
import { __testables, startMassiveTickStream, stopMassiveTickStream } from '../massiveTickStream';

jest.mock('ws', () => {
  type Handler = (...args: any[]) => void;

  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    private readonly handlers: Record<string, Handler[]> = {};

    constructor(public readonly url: string) {}

    on(event: string, handler: Handler): this {
      (this.handlers[event] ||= []).push(handler);
      return this;
    }

    send = jest.fn();
    ping = jest.fn();

    close = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', 1000, Buffer.from('client_close'));
    });

    terminate = jest.fn(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', 1006, Buffer.from('terminated'));
    });

    emit(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers[event] || []) {
        handler(...args);
      }
    }
  }

  const ctor = jest.fn((url: string) => new MockWebSocket(url));
  Object.assign(ctor, {
    CONNECTING: MockWebSocket.CONNECTING,
    OPEN: MockWebSocket.OPEN,
    CLOSING: MockWebSocket.CLOSING,
    CLOSED: MockWebSocket.CLOSED,
    RawData: undefined,
  });

  return ctor;
});

jest.mock('../../config/env', () => ({
  getEnv: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  redisClient: {
    isOpen: true,
    set: jest.fn(),
    get: jest.fn(),
    eval: jest.fn(),
  },
}));

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const websocketConstructor = WebSocket as unknown as jest.Mock;
const mockGetEnv = getEnv as jest.MockedFunction<typeof getEnv>;
const mockRedis = redisClient as unknown as {
  isOpen: boolean;
  set: jest.Mock;
  get: jest.Mock;
  eval: jest.Mock;
};
const mockWarn = logger.warn as jest.MockedFunction<typeof logger.warn>;
const mockError = logger.error as jest.MockedFunction<typeof logger.error>;

function makeEnv(overrides: Record<string, unknown> = {}): ReturnType<typeof getEnv> {
  return {
    MASSIVE_TICK_WS_ENABLED: true,
    MASSIVE_TICK_LOCK_ENABLED: false,
    MASSIVE_API_KEY: 'test-massive-key',
    MASSIVE_TICK_WS_URL: 'wss://example.com/indices',
    MASSIVE_TICK_SYMBOLS: 'SPX,SPY',
    MASSIVE_TICK_EVENT_PREFIX: 'V.',
    MASSIVE_TICK_RECONNECT_BASE_MS: 1_000,
    MASSIVE_TICK_RECONNECT_MAX_MS: 30_000,
    ...overrides,
  } as ReturnType<typeof getEnv>;
}

describe('massiveTickStream helpers', () => {
  const previousL2Flag = process.env.ENABLE_L2_MICROSTRUCTURE;

  beforeEach(async () => {
    await stopMassiveTickStream();
    jest.clearAllMocks();
    jest.useRealTimers();
    mockGetEnv.mockReturnValue(makeEnv());
    mockRedis.isOpen = true;
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.eval.mockResolvedValue(1);
  });

  afterEach(async () => {
    await stopMassiveTickStream();
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

  it('applies bounded jitter to reconnect delays', () => {
    expect(__testables.applyReconnectJitter(1000, () => 0)).toBe(700);
    expect(__testables.applyReconnectJitter(1000, () => 0.5)).toBe(1000);
    expect(__testables.applyReconnectJitter(1000, () => 1)).toBe(1300);
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

  it('detects provider max-connections status messages', () => {
    expect(__testables.isMaxConnectionsStatus({
      status: 'max_connections',
      message: 'Maximum number of websocket connections exceeded',
    })).toBe(true);

    expect(__testables.isMaxConnectionsStatus({
      status: 'error',
      message: 'Maximum number of websocket connections exceeded',
    })).toBe(true);
  });

  it('does not classify unrelated statuses as max-connections', () => {
    expect(__testables.isMaxConnectionsStatus({
      status: 'success',
      message: 'subscribed',
    })).toBe(false);
  });
});

describe('massiveTickStream connectStream race guard', () => {
  beforeEach(async () => {
    await stopMassiveTickStream();
    jest.clearAllMocks();
    mockGetEnv.mockReturnValue(makeEnv());
    mockRedis.isOpen = true;
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.eval.mockResolvedValue(1);
  });

  afterEach(async () => {
    await stopMassiveTickStream();
  });

  it('does not create a second websocket when first is CONNECTING', async () => {
    await startMassiveTickStream();
    expect(websocketConstructor).toHaveBeenCalledTimes(1);

    __testables.connectStream();

    expect(websocketConstructor).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalled();
  });

  it('does not create a second websocket when first is OPEN', async () => {
    await startMassiveTickStream();
    expect(websocketConstructor).toHaveBeenCalledTimes(1);

    const firstSocket = websocketConstructor.mock.results[0]?.value as { readyState: number } | undefined;
    expect(firstSocket).toBeDefined();
    if (firstSocket) {
      firstSocket.readyState = (WebSocket as unknown as { OPEN: number }).OPEN;
    }

    __testables.connectStream();

    expect(websocketConstructor).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalled();
  });
});

describe('massiveTickStream upstream lock', () => {
  beforeEach(async () => {
    await stopMassiveTickStream();
    jest.clearAllMocks();
    jest.useRealTimers();
    mockGetEnv.mockReturnValue(makeEnv());
    mockRedis.isOpen = true;
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.eval.mockResolvedValue(1);
  });

  afterEach(async () => {
    await stopMassiveTickStream();
    jest.useRealTimers();
  });

  it('acquires lock and starts stream when no holder', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ MASSIVE_TICK_LOCK_ENABLED: true }));

    await startMassiveTickStream();

    expect(mockRedis.set).toHaveBeenCalledWith(
      __testables.MASSIVE_LOCK_KEY,
      expect.any(String),
      { NX: true, EX: __testables.MASSIVE_LOCK_TTL_S },
    );
    expect(websocketConstructor).toHaveBeenCalledTimes(1);
  });

  it('refuses start when lock is held by another instance', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ MASSIVE_TICK_LOCK_ENABLED: true }));
    mockRedis.set.mockResolvedValue(null);
    mockRedis.get.mockResolvedValue('other-instance-token');

    await startMassiveTickStream();

    expect(websocketConstructor).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledWith(
      'FATAL: Another instance holds the Massive tick stream lock',
      expect.objectContaining({
        lockKey: __testables.MASSIVE_LOCK_KEY,
        holder: 'other-instance-token',
      }),
    );
    expect(mockError).toHaveBeenCalledWith(
      'Massive tick stream will not start: upstream lock unavailable (poll-only mode)',
    );
  });

  it('renews lock periodically', async () => {
    jest.useFakeTimers();
    mockGetEnv.mockReturnValue(makeEnv({ MASSIVE_TICK_LOCK_ENABLED: true }));

    await __testables.acquireUpstreamLock();
    await jest.advanceTimersByTimeAsync((__testables.MASSIVE_LOCK_TTL_S * 1000) / 2);

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('EXPIRE'),
      {
        keys: [__testables.MASSIVE_LOCK_KEY],
        arguments: [expect.any(String), `${__testables.MASSIVE_LOCK_TTL_S}`],
      },
    );
  });

  it('releases lock on stopMassiveTickStream()', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ MASSIVE_TICK_LOCK_ENABLED: true }));

    await __testables.acquireUpstreamLock();
    await stopMassiveTickStream();

    expect(mockRedis.eval).toHaveBeenCalledWith(
      expect.stringContaining('DEL'),
      {
        keys: [__testables.MASSIVE_LOCK_KEY],
        arguments: [expect.any(String)],
      },
    );
  });

  it('bypasses lock when MASSIVE_TICK_LOCK_ENABLED=false', async () => {
    mockGetEnv.mockReturnValue(makeEnv({ MASSIVE_TICK_LOCK_ENABLED: false }));

    await startMassiveTickStream();

    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(websocketConstructor).toHaveBeenCalledTimes(1);
  });
});
