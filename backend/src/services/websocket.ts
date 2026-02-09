/**
 * WebSocket Price Streaming Service
 *
 * Provides real-time price updates to connected clients via WebSocket.
 * Clients subscribe to symbols and receive price ticks at regular intervals.
 *
 * Protocol (JSON messages):
 *
 *   Client → Server:
 *     { "type": "subscribe",   "symbols": ["SPX", "NDX"] }
 *     { "type": "subscribe",   "channels": ["setups:user-123"] }
 *     { "type": "unsubscribe", "symbols": ["SPX"] }
 *     { "type": "unsubscribe", "channels": ["setups:user-123"] }
 *     { "type": "ping" }
 *
 *   Server → Client:
 *     { "type": "price",  "symbol": "SPX", "price": 5842.50, "change": 12.30, "changePct": 0.21, "volume": 1234567, "timestamp": "..." }
 *     { "type": "status", "marketStatus": "open", "session": "regular", ... }
 *     { "type": "setup_update", "channel": "setups:user-123", "data": { ... } }
 *     { "type": "pong" }
 *     { "type": "error",  "message": "..." }
 *
 * Polling intervals:
 *   Market open: every 30 seconds
 *   Extended hours: every 60 seconds
 *   Market closed: every 5 minutes
 */

import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../lib/logger';
import { getMinuteAggregates, getDailyAggregates } from '../config/massive';
import { getMarketStatus } from './marketHours';
import { subscribeSetupPushEvents, type SetupStatusUpdate } from './setupPushChannel';

// ============================================
// TYPES
// ============================================

interface ClientState {
  subscriptions: Set<string>;
  lastActivity: number;
}

interface PriceUpdate {
  type: 'price';
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  timestamp: string;
}

// ============================================
// CONFIGURATION
// ============================================

const MAX_SUBSCRIPTIONS_PER_CLIENT = 10;
const ALLOWED_SYMBOLS = new Set(['SPX', 'NDX', 'QQQ', 'SPY', 'IWM', 'DIA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'NVDA', 'META', 'TSLA']);
const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'RUT']);
const CLIENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes inactivity
const HEARTBEAT_INTERVAL = 30 * 1000;  // 30 seconds

const POLL_INTERVALS = {
  regular: 30_000,   // 30s during regular hours
  extended: 60_000,  // 60s during extended hours
  closed: 300_000,   // 5 min when closed
};
const SETUP_CHANNEL_PREFIX = 'setups:';
const SETUP_CHANNEL_PATTERN = /^setups:[a-zA-Z0-9_-]{3,64}$/;

function formatTicker(symbol: string): string {
  return INDEX_SYMBOLS.has(symbol) ? `I:${symbol}` : symbol;
}

// ============================================
// PRICE CACHE
// ============================================

const priceCache = new Map<string, { price: number; prevClose: number; volume: number; fetchedAt: number }>();

async function fetchLatestPrice(symbol: string): Promise<{ price: number; prevClose: number; volume: number } | null> {
  try {
    const ticker = formatTicker(symbol);
    const today = new Date().toISOString().split('T')[0];

    const minuteData = await getMinuteAggregates(ticker, today);
    if (minuteData.length > 0) {
      const lastBar = minuteData[minuteData.length - 1];
      const firstBar = minuteData[0];
      return { price: lastBar.c, prevClose: firstBar.o, volume: lastBar.v };
    }

    // Fallback to daily
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    const dailyData = await getDailyAggregates(ticker, yesterday, today);
    if (dailyData.length >= 1) {
      const lastBar = dailyData[dailyData.length - 1];
      const prevBar = dailyData.length >= 2 ? dailyData[dailyData.length - 2] : lastBar;
      return { price: lastBar.c, prevClose: prevBar.c, volume: lastBar.v };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================
// WEBSOCKET SERVER
// ============================================

let wss: WebSocketServer | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeSetupEvents: (() => void) | null = null;
const clients = new Map<WebSocket, ClientState>();

function isSymbolSubscription(value: string): boolean {
  return ALLOWED_SYMBOLS.has(value);
}

function normalizeSetupChannel(value: string): string | null {
  const normalized = value.toLowerCase();
  if (!normalized.startsWith(SETUP_CHANNEL_PREFIX)) return null;
  if (!SETUP_CHANNEL_PATTERN.test(normalized)) return null;
  return normalized;
}

function getActiveSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const state of clients.values()) {
    for (const sym of state.subscriptions) {
      if (isSymbolSubscription(sym)) {
        symbols.add(sym);
      }
    }
  }
  return symbols;
}

function broadcastPrice(update: PriceUpdate): void {
  const message = JSON.stringify(update);
  for (const [ws, state] of clients) {
    if (ws.readyState === WebSocket.OPEN && state.subscriptions.has(update.symbol)) {
      ws.send(message);
    }
  }
}

function broadcastSetupUpdate(update: SetupStatusUpdate): void {
  const channel = `${SETUP_CHANNEL_PREFIX}${update.userId}`;
  const message = JSON.stringify({
    type: 'setup_update',
    channel,
    data: update,
  });

  for (const [ws, state] of clients) {
    if (ws.readyState === WebSocket.OPEN && state.subscriptions.has(channel)) {
      ws.send(message);
    }
  }
}

function sendToClient(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleClientMessage(ws: WebSocket, raw: string): void {
  const state = clients.get(ws);
  if (!state) return;

  state.lastActivity = Date.now();

  try {
    const msg = JSON.parse(raw);

    switch (msg.type) {
      case 'subscribe': {
        const symbols = Array.isArray(msg.symbols) ? msg.symbols : [];
        const channels = Array.isArray(msg.channels) ? msg.channels : [];

        for (const sym of symbols) {
          if (typeof sym !== 'string') continue;
          const upper = sym.toUpperCase();
          if (!isSymbolSubscription(upper)) {
            sendToClient(ws, { type: 'error', message: `Unknown symbol: ${upper}` });
            continue;
          }
          if (state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
            sendToClient(ws, { type: 'error', message: `Maximum ${MAX_SUBSCRIPTIONS_PER_CLIENT} subscriptions` });
            break;
          }
          state.subscriptions.add(upper);

          // Send cached price immediately if available
          const cached = priceCache.get(upper);
          if (cached) {
            const change = cached.price - cached.prevClose;
            const changePct = cached.prevClose !== 0 ? (change / cached.prevClose) * 100 : 0;
            sendToClient(ws, {
              type: 'price',
              symbol: upper,
              price: Number(cached.price.toFixed(2)),
              change: Number(change.toFixed(2)),
              changePct: Number(changePct.toFixed(2)),
              volume: cached.volume,
              timestamp: new Date().toISOString(),
            });
          }
        }

        for (const channelCandidate of channels) {
          if (typeof channelCandidate !== 'string') continue;

          const channel = normalizeSetupChannel(channelCandidate);
          if (!channel) {
            sendToClient(ws, { type: 'error', message: `Invalid channel: ${String(channelCandidate)}` });
            continue;
          }

          if (state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
            sendToClient(ws, { type: 'error', message: `Maximum ${MAX_SUBSCRIPTIONS_PER_CLIENT} subscriptions` });
            break;
          }

          state.subscriptions.add(channel);
        }
        break;
      }

      case 'unsubscribe': {
        const symbols = Array.isArray(msg.symbols) ? msg.symbols : [];
        const channels = Array.isArray(msg.channels) ? msg.channels : [];
        for (const sym of symbols) {
          if (typeof sym === 'string') {
            state.subscriptions.delete(sym.toUpperCase());
          }
        }
        for (const channelCandidate of channels) {
          if (typeof channelCandidate !== 'string') continue;
          const channel = normalizeSetupChannel(channelCandidate);
          if (channel) {
            state.subscriptions.delete(channel);
          }
        }
        break;
      }

      case 'ping':
        sendToClient(ws, { type: 'pong' });
        break;

      default:
        sendToClient(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
    }
  } catch {
    sendToClient(ws, { type: 'error', message: 'Invalid JSON message' });
  }
}

async function pollPrices(): Promise<void> {
  const symbols = getActiveSymbols();
  if (symbols.size === 0) return;

  for (const symbol of symbols) {
    const data = await fetchLatestPrice(symbol);
    if (!data) continue;

    priceCache.set(symbol, { ...data, fetchedAt: Date.now() });

    const change = data.price - data.prevClose;
    const changePct = data.prevClose !== 0 ? (change / data.prevClose) * 100 : 0;

    broadcastPrice({
      type: 'price',
      symbol,
      price: Number(data.price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      volume: data.volume,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast market status after price updates
  const marketStatus = getMarketStatus();
  const statusMsg = JSON.stringify({ type: 'status', ...marketStatus });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(statusMsg);
    }
  }
}

function getCurrentPollInterval(): number {
  const status = getMarketStatus();
  if (status.status === 'open') return POLL_INTERVALS.regular;
  if (status.status === 'pre-market' || status.status === 'after-hours') return POLL_INTERVALS.extended;
  return POLL_INTERVALS.closed;
}

function startPolling(): void {
  if (pollTimer) clearInterval(pollTimer);

  const poll = async () => {
    await pollPrices();
    // Adapt interval based on market status
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, getCurrentPollInterval());
  };

  // Start first poll after 5 seconds
  setTimeout(poll, 5_000);
}

function startHeartbeat(): void {
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [ws, state] of clients) {
      if (now - state.lastActivity > CLIENT_TIMEOUT) {
        ws.terminate();
        clients.delete(ws);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize the WebSocket server on the existing HTTP server.
 * Called from server.ts after the HTTP server starts listening.
 */
export function initWebSocket(server: HTTPServer): void {
  wss = new WebSocketServer({ server, path: '/ws/prices' });

  wss.on('connection', (ws: WebSocket) => {
    clients.set(ws, { subscriptions: new Set(), lastActivity: Date.now() });

    logger.info(`WebSocket client connected (${clients.size} total)`);

    // Send initial market status
    sendToClient(ws, { type: 'status', ...getMarketStatus() });

    ws.on('message', (data) => {
      handleClientMessage(ws, data.toString());
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`WebSocket client disconnected (${clients.size} remaining)`);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error', { error: error.message });
      clients.delete(ws);
    });
  });

  startPolling();
  startHeartbeat();
  unsubscribeSetupEvents = subscribeSetupPushEvents((event) => {
    if (event.type !== 'setup_update') return;
    broadcastSetupUpdate(event.payload);
  });

  logger.info('WebSocket price server initialized at /ws/prices');
}

/**
 * Shut down the WebSocket server.
 * Called during graceful shutdown.
 */
export function shutdownWebSocket(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (wss) {
    for (const [ws] of clients) {
      ws.terminate();
    }
    clients.clear();
    wss.close();
    wss = null;
  }
  if (unsubscribeSetupEvents) {
    unsubscribeSetupEvents();
    unsubscribeSetupEvents = null;
  }
  logger.info('WebSocket server shut down');
}
