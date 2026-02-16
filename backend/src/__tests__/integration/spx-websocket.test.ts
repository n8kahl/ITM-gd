import { describeWithSockets } from '../../testUtils/socketDescribe';
import http from 'http';
import express from 'express';
import WebSocket from 'ws';

jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../config/massive', () => ({
  getMinuteAggregates: jest.fn().mockResolvedValue([]),
  getDailyAggregates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/spx', () => ({
  getSPXSnapshot: jest.fn(),
}));

jest.mock('../../services/marketHours', () => ({
  getMarketStatus: jest.fn(() => ({
    status: 'open',
    session: 'regular',
    message: 'Market open',
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
    verifyAuthToken: jest.fn().mockResolvedValue({ id: 'user-123', source: 'supabase' }),
  };
});

import { getSPXSnapshot } from '../../services/spx';
import { getMinuteAggregates } from '../../config/massive';
import { initWebSocket, shutdownWebSocket } from '../../services/websocket';

const mockGetSPXSnapshot = getSPXSnapshot as jest.MockedFunction<typeof getSPXSnapshot>;
const mockGetMinuteAggregates = getMinuteAggregates as jest.MockedFunction<typeof getMinuteAggregates>;

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
    throw new Error('Failed to determine server port');
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

function waitForMatchingMessages(
  ws: WebSocket,
  predicates: Array<(payload: Record<string, unknown>) => boolean>,
  timeoutMs: number = 8000,
): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const matches: Array<Record<string, unknown> | null> = Array.from({ length: predicates.length }, () => null);
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Timed out waiting for websocket messages'));
    }, timeoutMs);

    const onMessage = (raw: WebSocket.RawData) => {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      for (let i = 0; i < predicates.length; i += 1) {
        if (matches[i]) continue;
        if (predicates[i](parsed)) {
          matches[i] = parsed;
          break;
        }
      }

      if (matches.every(Boolean)) {
        clearTimeout(timeout);
        ws.off('message', onMessage);
        resolve(matches as Array<Record<string, unknown>>);
      }
    };

    ws.on('message', onMessage);
  });
}

describeWithSockets('SPX websocket integration', () => {
  let server: http.Server | null = null;
  let wsBaseUrl = '';
  let wsClient: WebSocket | null = null;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetMinuteAggregates.mockResolvedValue([
      { o: 6030, c: 6031.5, v: 12000 } as any,
      { o: 6031.5, c: 6032.25, v: 15000 } as any,
    ]);
    mockGetSPXSnapshot.mockResolvedValue({
      levels: [
        {
          id: 'lvl-1',
          symbol: 'SPX',
          category: 'options',
          source: 'spx_call_wall',
          price: 6050,
          strength: 'critical',
          timeframe: '0dte',
          metadata: {},
          chartStyle: { color: '#fff', lineStyle: 'solid', lineWidth: 1, labelFormat: 'L' },
        },
      ],
      clusters: [
        {
          id: 'cluster-1',
          priceLow: 6048,
          priceHigh: 6052,
          clusterScore: 4.1,
          type: 'defended',
          sources: [],
          testCount: 0,
          lastTestAt: null,
          held: true,
          holdRate: 66,
        },
      ],
      fibLevels: [],
      gex: {
        spx: {
          symbol: 'SPX',
          spotPrice: 6032,
          netGex: 2200,
          flipPoint: 6025,
          callWall: 6050,
          putWall: 6000,
          zeroGamma: 6025,
          gexByStrike: [],
          keyLevels: [{ strike: 6050, gex: 1800, type: 'call_wall' }],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:12:00.000Z',
        },
        spy: {
          symbol: 'SPY',
          spotPrice: 603,
          netGex: 1100,
          flipPoint: 602,
          callWall: 604,
          putWall: 600,
          zeroGamma: 602,
          gexByStrike: [],
          keyLevels: [{ strike: 604, gex: 900, type: 'call_wall' }],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:12:00.000Z',
        },
        combined: {
          symbol: 'COMBINED',
          spotPrice: 6032,
          netGex: 3300,
          flipPoint: 6024,
          callWall: 6050,
          putWall: 6000,
          zeroGamma: 6024,
          gexByStrike: [],
          keyLevels: [{ strike: 6050, gex: 2200, type: 'call_wall' }],
          expirationBreakdown: {},
          timestamp: '2026-02-15T15:12:00.000Z',
        },
      },
      basis: {
        current: 1.9,
        trend: 'stable',
        leading: 'neutral',
        ema5: 1.8,
        ema20: 1.7,
        zscore: 0.4,
        spxPrice: 6032,
        spyPrice: 603,
        timestamp: '2026-02-15T15:12:00.000Z',
      },
      setups: [
        {
          id: 'setup-1',
          type: 'fade_at_wall',
          direction: 'bullish',
          entryZone: { low: 6028, high: 6030 },
          stop: 6024,
          target1: { price: 6038, label: 'Target 1' },
          target2: { price: 6044, label: 'Target 2' },
          confluenceScore: 4,
          confluenceSources: ['gex_alignment'],
          clusterZone: {
            id: 'cluster-1',
            priceLow: 6028,
            priceHigh: 6030,
            clusterScore: 4,
            type: 'defended',
            sources: [],
            testCount: 0,
            lastTestAt: null,
            held: true,
            holdRate: 60,
          },
          regime: 'ranging',
          status: 'ready',
          probability: 71,
          recommendedContract: null,
          createdAt: '2026-02-15T15:10:00.000Z',
          triggeredAt: null,
        },
      ],
      regime: {
        regime: 'ranging',
        direction: 'neutral',
        probability: 60,
        magnitude: 'small',
        confidence: 70,
        timestamp: '2026-02-15T15:12:00.000Z',
      },
      prediction: {
        regime: 'ranging',
        direction: { bullish: 34, bearish: 33, neutral: 33 },
        magnitude: { small: 50, medium: 40, large: 10 },
        timingWindow: { description: 'test', actionable: true },
        nextTarget: {
          upside: { price: 6042, zone: 'projected' },
          downside: { price: 6020, zone: 'projected' },
        },
        probabilityCone: [],
        confidence: 70,
      },
      flow: [
        {
          id: 'flow-1',
          type: 'sweep',
          symbol: 'SPX',
          strike: 6050,
          expiry: '2026-03-20',
          size: 900,
          direction: 'bullish',
          premium: 120000,
          timestamp: '2026-02-15T15:11:00.000Z',
        },
      ],
      coachMessages: [
        {
          id: 'coach-1',
          type: 'pre_trade',
          priority: 'setup',
          setupId: 'setup-1',
          content: 'Primary setup message',
          structuredData: {},
          timestamp: '2026-02-15T15:12:00.000Z',
        },
      ],
      generatedAt: '2026-02-15T15:12:00.000Z',
    } as any);

    const setup = await createServerWithWebSocket();
    server = setup.server;
    wsBaseUrl = setup.wsBaseUrl;
  });

  afterEach(async () => {
    if (wsClient) {
      wsClient.removeAllListeners();
      if (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING) {
        wsClient.close();
      }
      wsClient = null;
    }

    shutdownWebSocket();

    if (server) {
      await closeServer(server);
      server = null;
    }
  });

  it('delivers SPX channel payloads for subscribed channels', async () => {
    wsClient = new WebSocket(`${wsBaseUrl}?token=valid-token`);
    await new Promise<void>((resolve, reject) => {
      wsClient!.once('open', () => resolve());
      wsClient!.once('error', reject);
    });

    wsClient.send(JSON.stringify({
      type: 'subscribe',
      channels: ['gex:SPX', 'regime:update', 'basis:update', 'flow:alert', 'coach:message'],
    }));

    const [gexMessage, regimeMessage, basisMessage] = await waitForMatchingMessages(
      wsClient,
      [
        (msg) => msg.channel === 'gex:SPX' && msg.type === 'spx_gex',
        (msg) => msg.channel === 'regime:update' && msg.type === 'spx_regime',
        (msg) => msg.channel === 'basis:update' && msg.type === 'spx_basis',
      ],
      5000,
    );

    expect(gexMessage.channel).toBe('gex:SPX');
    expect(regimeMessage.channel).toBe('regime:update');
    expect(basisMessage.channel).toBe('basis:update');
  });

  it('delivers initial symbol price snapshot immediately after subscribing to symbol', async () => {
    wsClient = new WebSocket(`${wsBaseUrl}?token=valid-token`);
    await new Promise<void>((resolve, reject) => {
      wsClient!.once('open', () => resolve());
      wsClient!.once('error', reject);
    });

    const priceMessagePromise = waitForMatchingMessages(
      wsClient,
      [
        (msg) => msg.type === 'price' && msg.symbol === 'SPX',
      ],
      5000,
    );

    wsClient.send(JSON.stringify({
      type: 'subscribe',
      symbols: ['SPX'],
    }));

    const [priceMessage] = await priceMessagePromise;

    expect(priceMessage.type).toBe('price');
    expect(priceMessage.symbol).toBe('SPX');
    expect(priceMessage.price).toBe(6032.25);
  });
});
