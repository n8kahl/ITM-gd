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
type MassiveTickConnectionState = 'connecting' | 'authenticating' | 'authenticated' | 'subscribing' | 'active' | 'error';
type MassiveControlAction = 'none' | 'send_subscriptions' | 'reconnect';

const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_AUTH_ACK_TIMEOUT_MS = 5_000;
const SUBSCRIBE_ACK_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_CONNECTIONS_RECONNECT_MS = 60_000;
const DEFAULT_POLICY_CLOSE_RECONNECT_MS = 15_000;
const AUTH_ACK_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.MASSIVE_TICK_AUTH_ACK_TIMEOUT_MS || `${DEFAULT_AUTH_ACK_TIMEOUT_MS}`, 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 1_000) : DEFAULT_AUTH_ACK_TIMEOUT_MS;
})();
const MAX_CONNECTIONS_RECONNECT_MS = (() => {
  const parsed = Number.parseInt(
    process.env.MASSIVE_TICK_MAX_CONNECTIONS_RECONNECT_MS || `${DEFAULT_MAX_CONNECTIONS_RECONNECT_MS}`,
    10,
  );
  return Number.isFinite(parsed) ? Math.max(parsed, 5_000) : DEFAULT_MAX_CONNECTIONS_RECONNECT_MS;
})();
const POLICY_CLOSE_RECONNECT_MS = (() => {
  const parsed = Number.parseInt(
    process.env.MASSIVE_TICK_POLICY_CLOSE_RECONNECT_MS || `${DEFAULT_POLICY_CLOSE_RECONNECT_MS}`,
    10,
  );
  return Number.isFinite(parsed) ? Math.max(parsed, 5_000) : DEFAULT_POLICY_CLOSE_RECONNECT_MS;
})();

const tickListeners = new Set<TickListener>();

let wsClient: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let authAckTimer: ReturnType<typeof setTimeout> | null = null;
let subscribeAckTimer: ReturnType<typeof setTimeout> | null = null;
let shouldRun = false;
let isConnected = false;
let connectionState: MassiveTickConnectionState = 'connecting';
let reconnectAttempt = 0;
let lastConnectedAt: string | null = null;
let lastMessageAt: string | null = null;
let subscribedSymbols: string[] = [];
let forcedReconnectDelayMs: number | null = null;
let lastProviderStatus: string | null = null;
let lastProviderMessage: string | null = null;
let lastCloseCode: number | null = null;
let lastCloseReason: string | null = null;

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

function clearAuthAckTimer(): void {
  if (!authAckTimer) return;
  clearTimeout(authAckTimer);
  authAckTimer = null;
}

function clearSubscribeAckTimer(): void {
  if (!subscribeAckTimer) return;
  clearTimeout(subscribeAckTimer);
  subscribeAckTimer = null;
}

function setConnectionState(nextState: MassiveTickConnectionState, reason: string): void {
  if (connectionState === nextState) return;
  logger.info('Massive tick stream state transition', {
    from: connectionState,
    to: nextState,
    reason,
  });
  connectionState = nextState;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isL2MicrostructureEnabled(): boolean {
  const raw = process.env.ENABLE_L2_MICROSTRUCTURE;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

function parseSymbols(symbolsCsv: string): string[] {
  const symbols = symbolsCsv
    .split(',')
    .map((value) => normalizeTickSymbol(value))
    .filter(Boolean);
  return Array.from(new Set(symbols));
}

function isIndexSocketUrl(wsUrl: string): boolean {
  return /\/indices(?:$|[/?#])/i.test(wsUrl);
}

function filterStreamCompatibleSymbols(symbols: string[], wsUrl: string): string[] {
  const isIndexSocket = isIndexSocketUrl(wsUrl);
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

interface MassiveStatusEvent {
  status: string;
  message?: string;
}

function requestReconnectDelay(delayMs: number): void {
  const safeDelay = Math.max(0, Math.floor(delayMs));
  if (forcedReconnectDelayMs == null || safeDelay > forcedReconnectDelayMs) {
    forcedReconnectDelayMs = safeDelay;
  }
}

function isMaxConnectionsStatus(statusEvent: MassiveStatusEvent): boolean {
  const status = statusEvent.status.toLowerCase();
  const message = (statusEvent.message || '').toLowerCase();
  return status === 'max_connections'
    || message.includes('maximum number of websocket connections');
}

function parseStatusEvent(payload: unknown): MassiveStatusEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const event = payload as Record<string, unknown>;

  const eventType = getObjectString(event, ['ev', 'event', 'type']);
  const status = getObjectString(event, ['status', 'state']);
  if (!status) return null;
  if (eventType && eventType.toLowerCase() !== 'status') return null;

  return {
    status: status.toLowerCase(),
    message: getObjectString(event, ['message', 'msg']) || undefined,
  };
}

function evaluateAuthControlEvent(
  state: MassiveTickConnectionState,
  statusEvent: MassiveStatusEvent,
): { nextState: MassiveTickConnectionState; action: MassiveControlAction } {
  if (state !== 'authenticating') {
    return {
      nextState: state,
      action: 'none',
    };
  }

  const message = (statusEvent.message || '').toLowerCase();
  const isAuthSuccess = statusEvent.status === 'auth_success' || statusEvent.status === 'authenticated';
  const isAuthFailure = statusEvent.status === 'auth_failed'
    || statusEvent.status === 'auth_error'
    || statusEvent.status === 'authentication_failed'
    || (statusEvent.status === 'error' && message.includes('auth'));

  if (isAuthSuccess) {
    return {
      nextState: 'authenticated',
      action: 'send_subscriptions',
    };
  }

  if (isAuthFailure) {
    return {
      nextState: 'error',
      action: 'reconnect',
    };
  }

  return {
    nextState: state,
    action: 'none',
  };
}

function evaluateAuthTimeout(state: MassiveTickConnectionState): {
  nextState: MassiveTickConnectionState;
  action: MassiveControlAction;
} {
  if (state === 'authenticating') {
    return {
      nextState: 'error',
      action: 'reconnect',
    };
  }

  return {
    nextState: state,
    action: 'none',
  };
}

function shouldProcessTickEvent(state: MassiveTickConnectionState): boolean {
  return state === 'active';
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
  const microstructureEnabled = isL2MicrostructureEnabled();

  const bidRaw = microstructureEnabled
    ? getObjectNumber(event, ['bid', 'b', 'bp', 'bidPrice', 'bid_price', 'bidprice'])
    : null;
  const askRaw = microstructureEnabled
    ? getObjectNumber(event, ['ask', 'a', 'ap', 'askPrice', 'ask_price', 'askprice'])
    : null;
  const bidSizeRaw = microstructureEnabled
    ? getObjectNumber(event, ['bidSize', 'bs', 'bid_size', 'bidsize', 'bid_volume'])
    : null;
  const askSizeRaw = microstructureEnabled
    ? getObjectNumber(event, ['askSize', 'as', 'ask_size', 'asksize', 'ask_volume'])
    : null;

  const bid = bidRaw != null && bidRaw > 0 ? bidRaw : null;
  const ask = askRaw != null && askRaw > 0 ? askRaw : null;
  const bidSize = bidSizeRaw != null && bidSizeRaw >= 0 ? Math.floor(bidSizeRaw) : null;
  const askSize = askSizeRaw != null && askSizeRaw >= 0 ? Math.floor(askSizeRaw) : null;
  const aggressorSide: NormalizedMarketTick['aggressorSide'] = !microstructureEnabled
    ? 'neutral'
    : ask != null && price >= ask
      ? 'buyer'
      : bid != null && price <= bid
        ? 'seller'
        : 'neutral';

  return {
    symbol,
    rawSymbol,
    price,
    size: Math.max(0, Math.floor(size)),
    timestamp: normalizeTimestamp(timestampRaw),
    sequence: sequence === null ? null : Math.floor(sequence),
    bid,
    ask,
    bidSize,
    askSize,
    aggressorSide,
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
    const statusEvent = parseStatusEvent(event);
    if (statusEvent) {
      lastProviderStatus = statusEvent.status;
      lastProviderMessage = statusEvent.message || null;

      const authControl = evaluateAuthControlEvent(connectionState, statusEvent);
      if (authControl.nextState !== connectionState) {
        setConnectionState(authControl.nextState, `status:${statusEvent.status}`);
      }

      if (authControl.action === 'send_subscriptions') {
        clearAuthAckTimer();
        sendSubscriptions(getEnv().MASSIVE_TICK_EVENT_PREFIX);
        continue;
      }

      if (authControl.action === 'reconnect') {
        clearAuthAckTimer();
        clearSubscribeAckTimer();
        isConnected = false;
        logger.error('Massive tick stream authentication failed', {
          status: statusEvent.status,
          message: statusEvent.message,
        });

        if (wsClient) {
          try {
            wsClient.close();
          } catch {
            wsClient.terminate();
          }
        }
        return;
      }

      if (isMaxConnectionsStatus(statusEvent)) {
        clearAuthAckTimer();
        clearSubscribeAckTimer();
        isConnected = false;
        requestReconnectDelay(MAX_CONNECTIONS_RECONNECT_MS);
        setConnectionState('error', `status:${statusEvent.status}`);
        logger.error('Massive tick stream provider connection limit reached', {
          status: statusEvent.status,
          message: statusEvent.message,
          reconnectDelayMs: forcedReconnectDelayMs,
        });
        if (wsClient) {
          try {
            wsClient.close();
          } catch {
            wsClient.terminate();
          }
        }
        return;
      }
    }

    if (!shouldProcessTickEvent(connectionState)) {
      continue;
    }

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
  const baseDelay = Math.min(
    env.MASSIVE_TICK_RECONNECT_BASE_MS * (2 ** reconnectAttempt),
    env.MASSIVE_TICK_RECONNECT_MAX_MS,
  );
  const forcedDelay = forcedReconnectDelayMs ?? 0;
  const delay = Math.max(baseDelay, forcedDelay);
  forcedReconnectDelayMs = null;
  reconnectAttempt += 1;

  logger.warn('Massive tick stream reconnect scheduled', {
    reason,
    delayMs: delay,
    attempt: reconnectAttempt,
    forcedDelayMs: forcedDelay || undefined,
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

function sendSubscriptions(eventPrefix: string): void {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) return;

  setConnectionState('subscribing', 'auth_acknowledged');
  const subscribeParams = toSubscriptionParams(subscribedSymbols, eventPrefix);
  if (subscribeParams.length > 0) {
    safeSend({ action: 'subscribe', params: subscribeParams });
  }

  clearSubscribeAckTimer();
  subscribeAckTimer = setTimeout(() => {
    if (connectionState !== 'subscribing') return;
    setConnectionState('active', 'subscription_assumed_active');
    isConnected = true;
  }, SUBSCRIBE_ACK_TIMEOUT_MS);
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
  clearAuthAckTimer();
  clearSubscribeAckTimer();
  isConnected = false;
  setConnectionState('connecting', 'connect_attempt');

  wsClient = new WebSocket(env.MASSIVE_TICK_WS_URL);
  connectTimeoutTimer = setTimeout(() => {
    if (wsClient && wsClient.readyState !== WebSocket.OPEN) {
      wsClient.terminate();
    }
  }, DEFAULT_CONNECT_TIMEOUT_MS);

  wsClient.on('open', () => {
    reconnectAttempt = 0;
    lastConnectedAt = nowIso();
    clearConnectTimeoutTimer();
    setConnectionState('authenticating', 'socket_open');

    safeSend({ action: 'auth', params: env.MASSIVE_API_KEY });
    clearAuthAckTimer();
    authAckTimer = setTimeout(() => {
      const authTimeout = evaluateAuthTimeout(connectionState);
      if (authTimeout.action !== 'reconnect') return;

      setConnectionState(authTimeout.nextState, 'auth_ack_timeout');
      isConnected = false;
      logger.error('Massive tick stream auth timeout', {
        timeoutMs: AUTH_ACK_TIMEOUT_MS,
      });

      if (wsClient) {
        try {
          wsClient.close();
        } catch {
          wsClient.terminate();
        }
      }
    }, AUTH_ACK_TIMEOUT_MS);

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
    clearAuthAckTimer();
    clearSubscribeAckTimer();
    isConnected = false;
    wsClient = null;
    lastCloseCode = code;
    lastCloseReason = reason.toString('utf8') || null;
    if (!shouldRun) return;
    if (code === 1008) {
      requestReconnectDelay(POLICY_CLOSE_RECONNECT_MS);
    }
    setConnectionState('error', `socket_close:${code}`);
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
  clearAuthAckTimer();
  clearSubscribeAckTimer();
  isConnected = false;
  setConnectionState('error', 'stream_stopped');
  reconnectAttempt = 0;
  forcedReconnectDelayMs = null;

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

export function isMassiveTickSymbolSupported(symbol: string): boolean {
  const normalizedSymbol = normalizeTickSymbol(symbol);
  if (!normalizedSymbol) return false;

  const wsUrl = getEnv().MASSIVE_TICK_WS_URL;
  if (!isIndexSocketUrl(wsUrl)) return true;
  return formatMassiveTicker(normalizedSymbol).startsWith('I:');
}

export function getMassiveTickStreamStatus(): {
  enabled: boolean;
  connected: boolean;
  connectionState: MassiveTickConnectionState;
  shouldRun: boolean;
  subscribedSymbols: string[];
  reconnectAttempt: number;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  lastProviderStatus: string | null;
  lastProviderMessage: string | null;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
} {
  const env = getEnv();
  return {
    enabled: env.MASSIVE_TICK_WS_ENABLED,
    connected: isConnected,
    connectionState,
    shouldRun,
    subscribedSymbols: [...subscribedSymbols],
    reconnectAttempt,
    lastConnectedAt,
    lastMessageAt,
    lastProviderStatus,
    lastProviderMessage,
    lastCloseCode,
    lastCloseReason,
  };
}

export const __testables = {
  AUTH_ACK_TIMEOUT_MS,
  SUBSCRIBE_ACK_TIMEOUT_MS,
  parseSymbols,
  toSubscriptionParams,
  normalizeTimestamp,
  parseTickPayload,
  parseStatusEvent,
  isMaxConnectionsStatus,
  evaluateAuthControlEvent,
  evaluateAuthTimeout,
  shouldProcessTickEvent,
};
