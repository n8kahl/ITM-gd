import WebSocket, { RawData } from 'ws';
import { getEnv } from '../config/env';
import { logger } from '../lib/logger';
import { formatMassiveTicker } from '../lib/symbols';
import {
  ingestTick,
  normalizeTickSymbol,
  type NormalizedMarketTick,
} from './tickCache';

type TickListener = (tick: NormalizedMarketTick) => void;

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_HEARTBEAT_MS = 30_000;

const tickListeners = new Set<TickListener>();

let wsClient: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let shouldRun = false;
let isConnected = false;
let reconnectAttempt = 0;
let lastConnectedAt: string | null = null;
let lastMessageAt: string | null = null;
let subscribedSymbols: string[] = [];

function clearReconnectTimer(): void {
  if (!reconnectTimer) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function clearHeartbeatTimer(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function clearConnectTimeoutTimer(): void {
  if (!connectTimeoutTimer) return;
  clearTimeout(connectTimeoutTimer);
  connectTimeoutTimer = null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseSymbols(symbolsCsv: string): string[] {
  const symbols = symbolsCsv
    .split(',')
    .map((value) => normalizeTickSymbol(value))
    .filter(Boolean);
  return Array.from(new Set(symbols));
}

function filterStreamCompatibleSymbols(symbols: string[], wsUrl: string): string[] {
  const isIndexSocket = /\/indices(?:$|[/?#])/i.test(wsUrl);
  if (!isIndexSocket) return symbols;

  const compatible = symbols.filter((symbol) => formatMassiveTicker(symbol).startsWith('I:'));
  const dropped = symbols.filter((symbol) => !compatible.includes(symbol));

  if (dropped.length > 0) {
    logger.warn('Massive tick stream dropped non-index symbols for indices socket', {
      droppedSymbols: dropped,
      wsUrl,
    });
  }

  return compatible;
}

function toSubscriptionParams(symbols: string[], eventPrefix: string): string {
  const prefix = eventPrefix.trim();
  const channels = symbols.map((symbol) => `${prefix}${formatMassiveTicker(symbol)}`);
  return channels.join(',');
}

function normalizeTimestamp(raw: unknown): number {
  const value = typeof raw === 'number' && Number.isFinite(raw)
    ? raw
    : typeof raw === 'string' && raw.trim().length > 0
      ? Number(raw)
      : NaN;

  if (!Number.isFinite(value)) return Date.now();

  // Heuristics:
  // - >= 1e15: likely ns -> ms
  // - >= 1e12: likely already ms
  // - >= 1e10: likely ms as well
  // - else: seconds -> ms
  if (value >= 1e15) return Math.floor(value / 1_000_000);
  if (value >= 1e10) return Math.floor(value);
  return Math.floor(value * 1000);
}

function rawDataToString(raw: RawData): string {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Buffer) return raw.toString('utf8');
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8');
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw)).toString('utf8');
  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  }
  return '';
}

function getObjectNumber(
  payload: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getObjectString(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function parseTickPayload(payload: unknown): NormalizedMarketTick | null {
  if (!payload || typeof payload !== 'object') return null;
  const event = payload as Record<string, unknown>;

  const rawSymbol = getObjectString(event, ['sym', 'symbol', 'ticker', 'T']);
  if (!rawSymbol) return null;

  const symbol = normalizeTickSymbol(rawSymbol);
  if (!symbol) return null;

  const price = getObjectNumber(event, ['price', 'p', 'val', 'c', 'close']);
  if (!price || price <= 0) return null;

  const size = getObjectNumber(event, ['size', 's', 'volume']) || 0;
  const timestampRaw = getObjectNumber(event, ['timestamp', 'ts', 't', 'y']) || Date.now();
  const sequence = getObjectNumber(event, ['sequence', 'seq', 'q']);

  return {
    symbol,
    rawSymbol,
    price,
    size: Math.max(0, Math.floor(size)),
    timestamp: normalizeTimestamp(timestampRaw),
    sequence: sequence === null ? null : Math.floor(sequence),
  };
}

function emitTick(tick: NormalizedMarketTick): void {
  for (const listener of tickListeners) {
    try {
      listener(tick);
    } catch (error) {
      logger.warn('Massive tick listener failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function handleMessage(raw: RawData): void {
  lastMessageAt = nowIso();
  const body = rawDataToString(raw).trim();
  if (!body) return;

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return;
  }

  const events = Array.isArray(payload) ? payload : [payload];
  for (const event of events) {
    const tick = parseTickPayload(event);
    if (!tick) continue;

    const accepted = ingestTick(tick);
    if (!accepted) continue;
    emitTick(tick);
  }
}

function scheduleReconnect(reason: string): void {
  if (!shouldRun) return;
  clearReconnectTimer();

  const env = getEnv();
  const delay = Math.min(
    env.MASSIVE_TICK_RECONNECT_BASE_MS * (2 ** reconnectAttempt),
    env.MASSIVE_TICK_RECONNECT_MAX_MS,
  );
  reconnectAttempt += 1;

  logger.warn('Massive tick stream reconnect scheduled', {
    reason,
    delayMs: delay,
    attempt: reconnectAttempt,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectStream();
  }, delay);
}

function safeSend(payload: Record<string, unknown>): void {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) return;
  wsClient.send(JSON.stringify(payload));
}

function connectStream(): void {
  if (!shouldRun) return;

  const env = getEnv();
  if (!env.MASSIVE_TICK_WS_ENABLED) return;
  if (!env.MASSIVE_API_KEY) {
    logger.warn('Massive tick stream disabled: MASSIVE_API_KEY missing');
    return;
  }

  clearReconnectTimer();
  clearHeartbeatTimer();
  clearConnectTimeoutTimer();

  wsClient = new WebSocket(env.MASSIVE_TICK_WS_URL);
  connectTimeoutTimer = setTimeout(() => {
    if (wsClient && wsClient.readyState !== WebSocket.OPEN) {
      wsClient.terminate();
    }
  }, DEFAULT_CONNECT_TIMEOUT_MS);

  wsClient.on('open', () => {
    isConnected = true;
    reconnectAttempt = 0;
    lastConnectedAt = nowIso();
    clearConnectTimeoutTimer();

    safeSend({ action: 'auth', params: env.MASSIVE_API_KEY });
    const subscribeParams = toSubscriptionParams(subscribedSymbols, env.MASSIVE_TICK_EVENT_PREFIX);
    if (subscribeParams.length > 0) {
      safeSend({ action: 'subscribe', params: subscribeParams });
    }

    heartbeatTimer = setInterval(() => {
      if (wsClient?.readyState === WebSocket.OPEN) {
        wsClient.ping();
      }
    }, DEFAULT_HEARTBEAT_MS);

    logger.info('Massive tick stream connected', {
      url: env.MASSIVE_TICK_WS_URL,
      symbols: subscribedSymbols,
    });
  });

  wsClient.on('message', handleMessage);

  wsClient.on('close', (code, reason) => {
    clearHeartbeatTimer();
    clearConnectTimeoutTimer();
    isConnected = false;
    wsClient = null;
    if (!shouldRun) return;
    scheduleReconnect(`close:${code}:${reason.toString('utf8')}`);
  });

  wsClient.on('error', (error) => {
    logger.warn('Massive tick stream socket error', { error: error.message });
  });
}

export function startMassiveTickStream(): void {
  if (shouldRun) return;

  const env = getEnv();
  if (!env.MASSIVE_TICK_WS_ENABLED) {
    logger.info('Massive tick stream disabled by configuration');
    return;
  }

  subscribedSymbols = filterStreamCompatibleSymbols(
    parseSymbols(env.MASSIVE_TICK_SYMBOLS),
    env.MASSIVE_TICK_WS_URL,
  );
  if (subscribedSymbols.length === 0) {
    logger.warn('Massive tick stream disabled: no symbols configured');
    return;
  }

  shouldRun = true;
  connectStream();
}

export function stopMassiveTickStream(): void {
  shouldRun = false;
  clearReconnectTimer();
  clearHeartbeatTimer();
  clearConnectTimeoutTimer();
  isConnected = false;
  reconnectAttempt = 0;

  if (!wsClient) return;

  try {
    wsClient.close();
  } catch {
    wsClient.terminate();
  } finally {
    wsClient = null;
  }
}

export function subscribeMassiveTickUpdates(listener: TickListener): () => void {
  tickListeners.add(listener);
  return () => {
    tickListeners.delete(listener);
  };
}

export function isMassiveTickStreamConnected(): boolean {
  return isConnected;
}

export function getMassiveTickStreamStatus(): {
  enabled: boolean;
  connected: boolean;
  shouldRun: boolean;
  subscribedSymbols: string[];
  reconnectAttempt: number;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
} {
  const env = getEnv();
  return {
    enabled: env.MASSIVE_TICK_WS_ENABLED,
    connected: isConnected,
    shouldRun,
    subscribedSymbols: [...subscribedSymbols],
    reconnectAttempt,
    lastConnectedAt,
    lastMessageAt,
  };
}

export const __testables = {
  parseSymbols,
  toSubscriptionParams,
  normalizeTimestamp,
  parseTickPayload,
};
