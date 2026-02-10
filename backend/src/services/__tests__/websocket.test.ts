import type { IncomingMessage } from 'http';
import { __testables } from '../websocket';

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
  } = __testables;

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
});
