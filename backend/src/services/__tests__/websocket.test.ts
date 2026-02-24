import type { IncomingMessage } from 'http';
import { __testables } from '../websocket';
import { ingestTick, resetTickCache } from '../tickCache';

describe('websocket service helpers', () => {
  const {
    isSymbolSubscription,
    normalizeSetupChannel,
    normalizePositionChannel,
    normalizeRealtimeChannel,
    getChannelOwnerId,
    isRealtimeChannelAuthorized,
    toSetupChannel,
    toPositionChannel,
    extractWsToken,
    isSymbolTickFresh,
    areSymbolTicksFresh,
    addClientSubscription,
    removeClientSubscription,
    cleanupClientSubscriptions,
    cleanupClient,
    __getTrackedClientCount,
    __getTrackedSubscriptionRegistryCount,
  } = __testables;

  beforeEach(() => {
    resetTickCache();
    __testables.cleanupAllClients();
  });

  it('normalizes realtime channels and rejects invalid formats', () => {
    expect(normalizeSetupChannel('SETUPS:User_123')).toBe('setups:user_123');
    expect(normalizePositionChannel('POSITIONS:Desk-9')).toBe('positions:desk-9');
    expect(normalizeRealtimeChannel('positions:user_1')).toBe('positions:user_1');

    expect(normalizeSetupChannel('setups:user@123')).toBeNull();
    expect(normalizePositionChannel('positions:')).toBeNull();
    expect(normalizeRealtimeChannel('alerts:user-1')).toBeNull();
  });

  it('enforces channel ownership authorization', () => {
    expect(getChannelOwnerId('setups:user-123')).toBe('user-123');
    expect(getChannelOwnerId('positions:desk_1')).toBe('desk_1');
    expect(getChannelOwnerId('prices:spx')).toBeNull();

    expect(isRealtimeChannelAuthorized('setups:user-123', 'user-123')).toBe(true);
    expect(isRealtimeChannelAuthorized('setups:user-123', 'USER-123')).toBe(true);
    expect(isRealtimeChannelAuthorized('positions:user-123', 'another-user')).toBe(false);
  });

  it('builds canonical per-user channels', () => {
    expect(toSetupChannel('Trader-ABC')).toBe('setups:trader-abc');
    expect(toPositionChannel('Desk_99')).toBe('positions:desk_99');
  });

  it('extracts websocket auth token from query string first, then bearer header', () => {
    const queryReq = {
      url: '/ws/prices?token=query-token-123',
      headers: { host: 'localhost:3001' },
    } as IncomingMessage;

    const bearerReq = {
      url: '/ws/prices',
      headers: { host: 'localhost:3001', authorization: 'Bearer bearer-token-456' },
    } as IncomingMessage;

    expect(extractWsToken(queryReq)).toBe('query-token-123');
    expect(extractWsToken(bearerReq)).toBe('bearer-token-456');
  });

  it('validates symbol subscription format using canonical symbol rules', () => {
    expect(isSymbolSubscription('SPX')).toBe(true);
    expect(isSymbolSubscription('BRK.B')).toBe(true);
    expect(isSymbolSubscription('AAPL$')).toBe(false);
  });

  it('marks symbol ticks fresh only within configured stale threshold window', () => {
    const now = Date.now();
    ingestTick({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6100,
      size: 1,
      timestamp: now - 500,
      sequence: 1,
    });
    ingestTick({
      symbol: 'SPY',
      rawSymbol: 'SPY',
      price: 610,
      size: 1,
      timestamp: now - 8000,
      sequence: 1,
    });

    expect(isSymbolTickFresh('SPX', now)).toBe(true);
    expect(isSymbolTickFresh('SPY', now)).toBe(false);
  });

  it('requires all subscribed symbols to have fresh ticks', () => {
    const now = Date.now();
    ingestTick({
      symbol: 'SPX',
      rawSymbol: 'I:SPX',
      price: 6102,
      size: 1,
      timestamp: now - 700,
      sequence: 2,
    });

    expect(areSymbolTicksFresh(['SPX'], now)).toBe(true);
    expect(areSymbolTicksFresh(['SPX', 'SPY'], now)).toBe(false);
  });

  it('cleans tracked subscriptions on disconnect', () => {
    const ws = {} as any;
    const state = {
      subscriptions: new Set<string>(['SPX']),
    };

    addClientSubscription(ws, 'SPX', () => {
      state.subscriptions.delete('SPX');
    });

    expect(__getTrackedSubscriptionRegistryCount()).toBe(1);
    cleanupClientSubscriptions(ws);
    expect(state.subscriptions.size).toBe(0);
    expect(__getTrackedSubscriptionRegistryCount()).toBe(0);
  });

  it('continues cleanup when a subscription cleanup callback throws', () => {
    const ws = {} as any;
    const state = {
      userId: 'user-2',
      subscriptions: new Set<string>(['SPX', 'NDX']),
      lastActivity: Date.now(),
    };

    addClientSubscription(ws, 'SPX', () => {
      state.subscriptions.delete('SPX');
      throw new Error('boom');
    });
    addClientSubscription(ws, 'NDX', () => {
      state.subscriptions.delete('NDX');
    });

    cleanupClient(ws);
    expect(state.subscriptions.size).toBe(0);
    expect(__getTrackedSubscriptionRegistryCount()).toBe(0);
    expect(__getTrackedClientCount()).toBe(0);
  });

  it('removes a single subscription via unsubscribe path helper', () => {
    const ws = {} as any;
    const state = {
      userId: 'user-3',
      subscriptions: new Set<string>(['SPX', 'NDX']),
      lastActivity: Date.now(),
    };

    addClientSubscription(ws, 'SPX', () => {
      state.subscriptions.delete('SPX');
    });
    addClientSubscription(ws, 'NDX', () => {
      state.subscriptions.delete('NDX');
    });

    removeClientSubscription(ws, 'SPX');
    expect(state.subscriptions.has('SPX')).toBe(false);
    expect(state.subscriptions.has('NDX')).toBe(true);

    cleanupClientSubscriptions(ws);
    expect(state.subscriptions.size).toBe(0);
  });
});
