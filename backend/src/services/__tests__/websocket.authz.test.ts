import { describeWithSockets } from '../../testUtils/socketDescribe';
import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import { AuthTokenError, verifyAuthToken } from '../../lib/tokenAuth';
import { publishSetupStatusUpdate } from '../setupPushChannel';
import { initWebSocket, shutdownWebSocket } from '../websocket';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../config/massive', () => ({
  getMinuteAggregates: jest.fn().mockResolvedValue([]),
  getDailyAggregates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../marketHours', () => ({
  getMarketStatus: jest.fn(() => ({
    status: 'closed',
    session: 'none',
    message: 'Market closed',
  })),
  toEasternTime: jest.fn((date: Date) => ({
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    dayOfWeek: date.getUTCDay(),
    dateStr: date.toISOString().slice(0, 10),
  })),
}));

jest.mock('../../lib/tokenAuth', () => {
  const actual = jest.requireActual('../../lib/tokenAuth');
  return {
    ...actual,
    verifyAuthToken: jest.fn(),
  };
});

const mockVerifyAuthToken = verifyAuthToken as jest.MockedFunction<typeof verifyAuthToken>;
const originalWsMaxClients = process.env.WS_MAX_CLIENTS;

async function createServerWithWebSocket(): Promise<{ server: http.Server; wsBaseUrl: string }> {
  const app = express();
  app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  initWebSocket(server);

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine dynamic server port');
  }

  return {
    server,
    wsBaseUrl: `ws://127.0.0.1:${address.port}/ws/prices`,
  };
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (payload: Record<string, unknown>) => boolean,
  timeoutMs: number = 3000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Timed out waiting for websocket message'));
    }, timeoutMs);

    const onMessage = (raw: WebSocket.RawData) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      if (!predicate(parsed)) return;
      clearTimeout(timeout);
      ws.off('message', onMessage);
      resolve(parsed);
    };

    ws.on('message', onMessage);
  });
}

function connectForClose(
  url: string,
  timeoutMs: number = 3000,
): Promise<{ code: number; reason: string; messages: Array<Record<string, unknown>> }> {
  return new Promise((resolve, reject) => {
    const messages: Array<Record<string, unknown>> = [];
    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Timed out waiting for websocket close'));
    }, timeoutMs);

    ws.on('message', (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()) as Record<string, unknown>);
      } catch {
        // Ignore malformed payloads in close-path assertions.
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      resolve({ code, reason: reason.toString(), messages });
    });

    ws.on('error', () => {
      // close handler captures the final state for assertions
    });
  });
}

function connectForOpen(url: string, timeoutMs: number = 3000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Timed out waiting for websocket open'));
    }, timeoutMs);

    const onError = (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    };

    ws.once('open', () => {
      clearTimeout(timeout);
      ws.off('error', onError);
      resolve(ws);
    });
    ws.once('error', onError);
  });
}

describeWithSockets('websocket auth + authorization integration', () => {
  let server: http.Server | null = null;
  let wsBaseUrl = '';
  let wsClient: WebSocket | null = null;
  let additionalClients: WebSocket[] = [];

  beforeEach(async () => {
    jest.clearAllMocks();
    const setup = await createServerWithWebSocket();
    server = setup.server;
    wsBaseUrl = setup.wsBaseUrl;
  });

  afterEach(async () => {
    for (const client of [wsClient, ...additionalClients]) {
      if (!client) continue;
      client.removeAllListeners();
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
    }
    wsClient = null;
    additionalClients = [];

    shutdownWebSocket();

    if (server) {
      await closeServer(server);
      server = null;
    }

    if (originalWsMaxClients === undefined) {
      delete process.env.WS_MAX_CLIENTS;
    } else {
      process.env.WS_MAX_CLIENTS = originalWsMaxClients;
    }
  });

  it('rejects unauthorized websocket clients with 4401', async () => {
    mockVerifyAuthToken.mockRejectedValue(new AuthTokenError(401, 'Invalid or expired token'));

    const result = await connectForClose(`${wsBaseUrl}?token=bad-token`);

    expect(result.code).toBe(4401);
    expect(result.reason).toContain('Invalid or expired token');
    expect(result.messages.some((msg) => msg.type === 'error')).toBe(true);
  });

  it('rejects forbidden channel subscriptions for authenticated users', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      id: 'user-123',
      source: 'supabase',
    } as any);

    wsClient = new WebSocket(`${wsBaseUrl}?token=valid-token`);
    await new Promise<void>((resolve, reject) => {
      wsClient!.once('open', () => resolve());
      wsClient!.once('error', reject);
    });

    wsClient.send(JSON.stringify({
      type: 'subscribe',
      channels: ['setups:other-user'],
    }));

    const errorMsg = await waitForMessage(
      wsClient,
      (msg) => msg.type === 'error' && String(msg.message || '').includes('Forbidden channel'),
    );

    expect(errorMsg.type).toBe('error');
    expect(String(errorMsg.message)).toContain('Forbidden channel');
  });

  it('rejects connections at capacity with 4429', async () => {
    process.env.WS_MAX_CLIENTS = '1';
    mockVerifyAuthToken.mockResolvedValue({
      id: 'user-123',
      source: 'supabase',
    } as any);

    wsClient = await connectForOpen(`${wsBaseUrl}?token=valid-token`);
    const result = await connectForClose(`${wsBaseUrl}?token=overflow-token`);

    expect(result.code).toBe(4429);
    expect(result.reason).toBe('Server at capacity');
    expect(mockVerifyAuthToken).toHaveBeenCalledTimes(1);
  });

  it('accepts connection below capacity', async () => {
    process.env.WS_MAX_CLIENTS = '2';
    mockVerifyAuthToken.mockResolvedValue({
      id: 'user-123',
      source: 'supabase',
    } as any);

    wsClient = await connectForOpen(`${wsBaseUrl}?token=valid-token-1`);
    const secondClient = await connectForOpen(`${wsBaseUrl}?token=valid-token-2`);
    additionalClients.push(secondClient);

    expect(wsClient.readyState).toBe(WebSocket.OPEN);
    expect(secondClient.readyState).toBe(WebSocket.OPEN);
    expect(mockVerifyAuthToken).toHaveBeenCalledTimes(2);
  });

  it('allows authorized setup channel subscriptions and delivers targeted setup_update events', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      id: 'User-ABC',
      source: 'supabase',
    } as any);

    wsClient = new WebSocket(`${wsBaseUrl}?token=valid-token`);
    await new Promise<void>((resolve, reject) => {
      wsClient!.once('open', () => resolve());
      wsClient!.once('error', reject);
    });

    wsClient.send(JSON.stringify({
      type: 'subscribe',
      channels: ['setups:user-abc'],
    }));

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        publishSetupStatusUpdate({
          setupId: 'setup-1',
          userId: 'USER-ABC',
          symbol: 'SPX',
          setupType: 'gamma_squeeze',
          previousStatus: 'active',
          status: 'triggered',
          currentPrice: 6020,
          reason: 'target_reached',
          evaluatedAt: new Date().toISOString(),
        });
        resolve();
      }, 30);
    });

    const updateMsg = await waitForMessage(
      wsClient,
      (msg) => msg.type === 'setup_update' && msg.channel === 'setups:user-abc',
    );

    expect(updateMsg.type).toBe('setup_update');
    expect(updateMsg.channel).toBe('setups:user-abc');
    expect((updateMsg.data as Record<string, unknown>).setupId).toBe('setup-1');
  });
});
