/**
 * WebSocket Price Streaming Service
 *
 * Provides real-time price updates to connected clients via WebSocket.
 * Clients subscribe to symbols and receive price ticks at regular intervals.
 *
 * Protocol (JSON messages):
 *
 *   Authentication:
 *     - Clients must pass Supabase JWT as query param: /ws/prices?token=<jwt>
 *
 *   Client → Server:
 *     { "type": "subscribe",   "symbols": ["SPX", "NDX"] }
 *     { "type": "subscribe",   "channels": ["setups:user-123"] }
 *     { "type": "subscribe",   "channels": ["positions:user-123"] }
 *     { "type": "unsubscribe", "symbols": ["SPX"] }
 *     { "type": "unsubscribe", "channels": ["setups:user-123"] }
 *     { "type": "unsubscribe", "channels": ["positions:user-123"] }
 *     { "type": "ping" }
 *
 *   Server → Client:
 *     { "type": "price",  "symbol": "SPX", "price": 5842.50, "change": 12.30, "changePct": 0.21, "volume": 1234567, "timestamp": "..." }
 *     { "type": "status", "marketStatus": "open", "session": "regular", ... }
 *     { "type": "setup_update", "channel": "setups:user-123", "data": { ... } }
 *     { "type": "setup_detected", "channel": "setups:user-123", "data": { ... } }
 *     { "type": "position_update", "channel": "positions:user-123", "data": { ... } }
 *     { "type": "position_advice", "channel": "positions:user-123", "data": { ... } }
 *     { "type": "pong" }
 *     { "type": "error",  "message": "..." }
 *
 * Polling intervals:
 *   Market open: every 30 seconds
 *   Extended hours: every 60 seconds
 *   Market closed: every 5 minutes
 */

import { Server as HTTPServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../lib/logger';
import { getMinuteAggregates, getDailyAggregates } from '../config/massive';
import { formatMassiveTicker, isValidSymbol, normalizeSymbol } from '../lib/symbols';
import { getMarketStatus, toEasternTime } from './marketHours';
import { AuthTokenError, extractBearerToken, verifyAuthToken } from '../lib/tokenAuth';
import { subscribeMassiveTickUpdates, isMassiveTickStreamConnected } from './massiveTickStream';
import { getLatestTick, type NormalizedMarketTick } from './tickCache';
import { ingestTickMicrobars, resetMicrobarAggregator } from './spx/microbarAggregator';
import {
  applyTickStateToSetups,
  evaluateTickSetupTransitions,
  resetTickEvaluatorState,
  syncTickEvaluatorSetups,
  type SetupTransitionEvent,
} from './spx/tickEvaluator';
import { persistSetupTransitionsForWinRate } from './spx/outcomeTracker';
import { buildExecutionCoachMessageFromTransition } from './spx/executionCoach';
import {
  subscribeSetupPushEvents,
  type SetupDetectedUpdate,
  type SetupStatusUpdate,
} from './setupPushChannel';
import {
  subscribePositionPushEvents,
  type PositionAdviceUpdate,
  type PositionLiveUpdate,
} from './positionPushChannel';
import { getSPXSnapshot } from './spx';
import type { CoachMessage, SPXSnapshot, Setup } from './spx/types';

// ============================================
// TYPES
// ============================================

interface ClientState {
  userId: string;
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
  source?: 'poll' | 'tick';
  feedAgeMs?: number;
  seq?: number;
}

interface MicrobarUpdate {
  type: 'microbar';
  symbol: string;
  interval: '1s' | '5s';
  bucketStartMs: number;
  bucketEndMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  deltaVolume: number;
  bidSize: number | null;
  askSize: number | null;
  bidAskImbalance: number | null;
  bidSizeAtClose: number | null;
  askSizeAtClose: number | null;
  askBidSizeRatio: number | null;
  quoteCoveragePct: number;
  avgSpreadBps: number | null;
  finalized: boolean;
  timestamp: string;
  source: 'tick';
}

// ============================================
// CONFIGURATION
// ============================================

const MAX_SUBSCRIPTIONS_PER_CLIENT = 10;
const CLIENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes inactivity
const HEARTBEAT_INTERVAL = 30 * 1000;  // 30 seconds

const POLL_INTERVALS = {
  regular: 30_000,   // 30s during regular hours
  extended: 60_000,  // 60s during extended hours
  closed: 300_000,   // 5 min when closed
  degradedRegular: 5_000,   // 5s when market is open but tick feed is degraded
  degradedExtended: 15_000, // 15s in pre/after hours when tick feed is degraded
};
const SETUP_CHANNEL_PREFIX = 'setups:';
const SETUP_CHANNEL_PATTERN = /^setups:[a-zA-Z0-9_-]{3,64}$/;
const POSITION_CHANNEL_PREFIX = 'positions:';
const POSITION_CHANNEL_PATTERN = /^positions:[a-zA-Z0-9_-]{3,64}$/;
const PRICE_CHANNEL_PATTERN = /^price:(SPX|SPY)$/i;
const SPX_PUBLIC_CHANNEL_MAP: Record<string, string> = {
  'gex:spx': 'gex:SPX',
  'gex:spy': 'gex:SPY',
  'levels:update': 'levels:update',
  'clusters:update': 'clusters:update',
  'setups:update': 'setups:update',
  'regime:update': 'regime:update',
  'flow:alert': 'flow:alert',
  'coach:message': 'coach:message',
  'basis:update': 'basis:update',
};
const SPX_PUBLIC_CHANNEL_SET = new Set<string>(Object.values(SPX_PUBLIC_CHANNEL_MAP));
const WS_CLOSE_UNAUTHORIZED = 4401;
const WS_CLOSE_FORBIDDEN = 4403;
const GEX_BROADCAST_INTERVAL_MS = 60_000;
const REGIME_BROADCAST_INTERVAL_MS = 30_000;
const BASIS_BROADCAST_INTERVAL_MS = 30_000;
const FLOW_ALERT_PREMIUM_THRESHOLD = 100_000;
const FLOW_ALERT_SIZE_THRESHOLD = 500;
const PRICE_CACHE_STALE_MS = 15_000;
const TICK_FANOUT_THROTTLE_MS = (() => {
  const parsed = Number.parseInt(process.env.MASSIVE_TICK_FANOUT_THROTTLE_MS || '150', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 25) : 150;
})();
const TICK_STALE_MS = (() => {
  const parsed = Number.parseInt(process.env.MASSIVE_TICK_STALE_MS || '5000', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 1000) : 5000;
})();
const MICROBAR_FANOUT_THROTTLE_MS = (() => {
  const parsed = Number.parseInt(process.env.MASSIVE_MICROBAR_FANOUT_THROTTLE_MS || '250', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 25) : 250;
})();

function formatTicker(symbol: string): string {
  return formatMassiveTicker(symbol);
}

// ============================================
// PRICE CACHE
// ============================================

const priceCache = new Map<string, { price: number; prevClose: number; volume: number; asOfMs: number; fetchedAt: number }>();
const inFlightPriceFetch = new Map<string, Promise<{ price: number; prevClose: number; volume: number; asOfMs: number } | null>>();
let lastSPXSnapshot: SPXSnapshot | null = null;
let lastLevelsSignature = '';
let lastClustersSignature = '';
let lastSetupsSignature = '';
let lastFlowAlertSignature = '';
let lastCoachMessageSignature = '';
const lastGexBroadcastAtBySymbol: Record<'SPX' | 'SPY', number> = {
  SPX: 0,
  SPY: 0,
};
let lastRegimeBroadcastAt = 0;
let lastBasisBroadcastAt = 0;

function toAsOfMs(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : NaN;
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  return Date.now();
}

async function fetchLatestPrice(symbol: string): Promise<{ price: number; prevClose: number; volume: number; asOfMs: number } | null> {
  try {
    const ticker = formatTicker(symbol);
    const now = new Date();
    const today = toEasternTime(now).dateStr;
    const weekAgo = toEasternTime(new Date(now.getTime() - 7 * 86400000)).dateStr;

    const [minuteData, dailyData] = await Promise.all([
      getMinuteAggregates(ticker, today),
      getDailyAggregates(ticker, weekAgo, today),
    ]);

    const previousClose = dailyData.length >= 2
      ? dailyData[dailyData.length - 2].c
      : dailyData.length === 1
        ? dailyData[0].o
        : null;

    if (minuteData.length > 0) {
      const lastBar = minuteData[minuteData.length - 1];
      const prevClose = previousClose ?? minuteData[0].o;
      return {
        price: lastBar.c,
        prevClose: prevClose,
        volume: lastBar.v,
        asOfMs: toAsOfMs((lastBar as { t?: number }).t),
      };
    }

    // Fallback to daily
    if (dailyData.length >= 1) {
      const lastBar = dailyData[dailyData.length - 1];
      const prevBar = dailyData.length >= 2 ? dailyData[dailyData.length - 2] : lastBar;
      return {
        price: lastBar.c,
        prevClose: prevBar.c,
        volume: lastBar.v,
        asOfMs: toAsOfMs((lastBar as { t?: number }).t),
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function getLatestPriceSnapshot(symbol: string): Promise<{ price: number; prevClose: number; volume: number; asOfMs: number } | null> {
  const cached = priceCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt <= PRICE_CACHE_STALE_MS) {
    return {
      price: cached.price,
      prevClose: cached.prevClose,
      volume: cached.volume,
      asOfMs: cached.asOfMs,
    };
  }

  const existing = inFlightPriceFetch.get(symbol);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const latest = await fetchLatestPrice(symbol);
    if (latest) {
      priceCache.set(symbol, { ...latest, fetchedAt: Date.now() });
    }
    return latest;
  })();

  inFlightPriceFetch.set(symbol, request);
  try {
    return await request;
  } finally {
    inFlightPriceFetch.delete(symbol);
  }
}

// ============================================
// WEBSOCKET SERVER
// ============================================

let wss: WebSocketServer | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let initialPollTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSetupEvents: (() => void) | null = null;
let unsubscribePositionEvents: (() => void) | null = null;
let unsubscribeTickEvents: (() => void) | null = null;
const clients = new Map<WebSocket, ClientState>();
const lastTickBroadcastAtBySymbol = new Map<string, number>();
const lastMicrobarBroadcastAtBySymbolInterval = new Map<string, number>();

function isSymbolSubscription(value: string): boolean {
  return isValidSymbol(value);
}

function normalizeSetupChannel(value: string): string | null {
  const normalized = value.toLowerCase();
  if (!normalized.startsWith(SETUP_CHANNEL_PREFIX)) return null;
  if (!SETUP_CHANNEL_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizePositionChannel(value: string): string | null {
  const normalized = value.toLowerCase();
  if (!normalized.startsWith(POSITION_CHANNEL_PREFIX)) return null;
  if (!POSITION_CHANNEL_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizePriceChannel(value: string): string | null {
  const normalized = value.trim();
  if (!PRICE_CHANNEL_PATTERN.test(normalized)) return null;
  const symbol = normalized.split(':')[1]?.toUpperCase();
  if (!symbol) return null;
  return `price:${symbol}`;
}

function normalizePublicSPXChannel(value: string): string | null {
  const canonical = SPX_PUBLIC_CHANNEL_MAP[value.trim().toLowerCase()];
  return canonical || null;
}

function normalizeRealtimeChannel(value: string): string | null {
  return normalizeSetupChannel(value)
    || normalizePositionChannel(value)
    || normalizePriceChannel(value)
    || normalizePublicSPXChannel(value);
}

function getChannelOwnerId(channel: string): string | null {
  if (channel.startsWith(SETUP_CHANNEL_PREFIX)) {
    return channel.slice(SETUP_CHANNEL_PREFIX.length);
  }
  if (channel.startsWith(POSITION_CHANNEL_PREFIX)) {
    return channel.slice(POSITION_CHANNEL_PREFIX.length);
  }
  return null;
}

function isRealtimeChannelAuthorized(channel: string, userId: string): boolean {
  if (channel.startsWith('price:')) return true;
  if (SPX_PUBLIC_CHANNEL_SET.has(channel)) return true;
  const ownerId = getChannelOwnerId(channel);
  if (!ownerId) return true;
  return ownerId === userId.toLowerCase();
}

function toSetupChannel(userId: string): string {
  return `${SETUP_CHANNEL_PREFIX}${userId.toLowerCase()}`;
}

function toPositionChannel(userId: string): string {
  return `${POSITION_CHANNEL_PREFIX}${userId.toLowerCase()}`;
}

function toPriceChannel(symbol: string): string {
  return `price:${symbol.toUpperCase()}`;
}

function extractWsToken(req: IncomingMessage): string | null {
  const host = req.headers.host || 'localhost';
  const requestUrl = req.url || '/ws/prices';

  try {
    const parsedUrl = new URL(requestUrl, `http://${host}`);
    const tokenFromQuery = parsedUrl.searchParams.get('token');
    if (tokenFromQuery && tokenFromQuery.trim().length > 0) {
      return tokenFromQuery.trim();
    }
  } catch {
    // Ignore URL parsing errors and fall back to Authorization header parsing.
  }

  return extractBearerToken(req.headers.authorization);
}

function getActiveSymbols(): Set<string> {
  const symbols = new Set<string>();
  for (const state of clients.values()) {
    for (const sym of state.subscriptions) {
      if (isSymbolSubscription(sym)) {
        symbols.add(sym);
        continue;
      }

      const priceChannel = normalizePriceChannel(sym);
      if (priceChannel) {
        const symbol = priceChannel.split(':')[1];
        if (symbol && isSymbolSubscription(symbol)) {
          symbols.add(symbol);
        }
      }
    }
  }
  return symbols;
}

function isSymbolTickFresh(symbol: string, nowMs: number = Date.now()): boolean {
  const latest = getLatestTick(symbol);
  if (!latest) return false;
  return nowMs - latest.timestamp <= TICK_STALE_MS;
}

function areSymbolTicksFresh(symbols: Iterable<string>, nowMs: number = Date.now()): boolean {
  const normalized = Array.from(new Set(
    Array.from(symbols)
      .map((symbol) => normalizeSymbol(symbol))
      .filter((symbol) => symbol.length > 0),
  ));

  if (normalized.length === 0) return false;
  return normalized.every((symbol) => isSymbolTickFresh(symbol, nowMs));
}

function hasSubscribersForChannel(channel: string): boolean {
  for (const state of clients.values()) {
    if (state.subscriptions.has(channel)) {
      return true;
    }
  }
  return false;
}

function hasSubscribersForAnyChannel(channels: string[]): boolean {
  for (const channel of channels) {
    if (hasSubscribersForChannel(channel)) return true;
  }
  return false;
}

function broadcastChannelMessage(channel: string, type: string, data: Record<string, unknown>): void {
  const message = JSON.stringify({
    type,
    channel,
    data,
    timestamp: new Date().toISOString(),
  });

  for (const [ws, state] of clients) {
    if (ws.readyState === WebSocket.OPEN && state.subscriptions.has(channel)) {
      ws.send(message);
    }
  }
}

function levelsSignature(levels: SPXSnapshot['levels']): string {
  return levels
    .map((level) => `${level.symbol}|${level.category}|${level.source}|${level.price.toFixed(2)}|${level.strength}`)
    .sort()
    .join(';');
}

function clustersSignature(clusters: SPXSnapshot['clusters']): string {
  return clusters
    .map((cluster) => `${cluster.priceLow.toFixed(2)}|${cluster.priceHigh.toFixed(2)}|${cluster.clusterScore.toFixed(2)}|${cluster.type}`)
    .sort()
    .join(';');
}

function setupsSignature(setups: Setup[]): string {
  return setups
    .map((setup) => `${setup.id}|${setup.status}|${setup.direction}|${setup.entryZone.low.toFixed(2)}|${setup.entryZone.high.toFixed(2)}|${setup.statusUpdatedAt || ''}|${setup.ttlExpiresAt || ''}|${setup.invalidationReason || ''}|${setup.score ?? ''}|${setup.evR ?? ''}|${setup.pWinCalibrated ?? ''}|${setup.tier || ''}|${setup.rank ?? ''}`)
    .sort()
    .join(';');
}

function flowAlertSignature(flow: SPXSnapshot['flow']): string {
  return flow
    .filter((event) => event.premium >= FLOW_ALERT_PREMIUM_THRESHOLD || event.size >= FLOW_ALERT_SIZE_THRESHOLD)
    .slice(0, 5)
    .map((event) => `${event.id}|${event.premium}|${event.size}`)
    .join(';');
}

function coachMessageSignature(messages: SPXSnapshot['coachMessages']): string {
  if (messages.length === 0) return '';
  return messages
    .slice(0, 3)
    .map((msg) => `${msg.id}|${msg.type}|${msg.priority}|${msg.setupId || 'none'}|${msg.timestamp}|${msg.content}`)
    .join(';');
}

function toCoachChannelPayload(message: CoachMessage, source: 'snapshot' | 'transition'): Record<string, unknown> {
  const structuredData = message.structuredData && typeof message.structuredData === 'object'
    ? message.structuredData
    : {};

  return {
    id: message.id,
    type: message.type,
    content: message.content,
    setupId: message.setupId,
    priority: message.priority,
    structuredData: {
      ...structuredData,
      transportSource: source,
    },
    timestamp: message.timestamp,
  };
}

function diffLevels(
  previous: SPXSnapshot['levels'],
  next: SPXSnapshot['levels'],
): { added: SPXSnapshot['levels']; removed: SPXSnapshot['levels']; modified: SPXSnapshot['levels'] } {
  const byKey = (levels: SPXSnapshot['levels']) => {
    const map = new Map<string, SPXSnapshot['levels'][number]>();
    for (const level of levels) {
      const key = `${level.symbol}|${level.category}|${level.source}`;
      map.set(key, level);
    }
    return map;
  };

  const previousMap = byKey(previous);
  const nextMap = byKey(next);

  const added: SPXSnapshot['levels'] = [];
  const removed: SPXSnapshot['levels'] = [];
  const modified: SPXSnapshot['levels'] = [];

  for (const [key, nextLevel] of nextMap.entries()) {
    const previousLevel = previousMap.get(key);
    if (!previousLevel) {
      added.push(nextLevel);
      continue;
    }

    if (
      previousLevel.price !== nextLevel.price
      || previousLevel.strength !== nextLevel.strength
      || previousLevel.timeframe !== nextLevel.timeframe
    ) {
      modified.push(nextLevel);
    }
  }

  for (const [key, previousLevel] of previousMap.entries()) {
    if (!nextMap.has(key)) {
      removed.push(previousLevel);
    }
  }

  return { added, removed, modified };
}

function diffSetups(
  previous: Setup[],
  next: Setup[],
): Array<{ setup: Setup; action: 'created' | 'updated' | 'expired' }> {
  const previousMap = new Map(previous.map((setup) => [setup.id, setup]));
  const nextMap = new Map(next.map((setup) => [setup.id, setup]));
  const changes: Array<{ setup: Setup; action: 'created' | 'updated' | 'expired' }> = [];

  for (const [id, setup] of nextMap.entries()) {
    const prior = previousMap.get(id);
    if (!prior) {
      changes.push({ setup, action: 'created' });
      continue;
    }

    if (
      prior.status !== setup.status
      || prior.statusUpdatedAt !== setup.statusUpdatedAt
      || prior.ttlExpiresAt !== setup.ttlExpiresAt
      || prior.invalidationReason !== setup.invalidationReason
      || prior.score !== setup.score
      || prior.evR !== setup.evR
      || prior.pWinCalibrated !== setup.pWinCalibrated
      || prior.tier !== setup.tier
      || prior.rank !== setup.rank
      || prior.stop !== setup.stop
      || prior.target1.price !== setup.target1.price
      || prior.target2.price !== setup.target2.price
    ) {
      changes.push({
        setup,
        action: setup.status === 'expired' ? 'expired' : 'updated',
      });
    }
  }

  for (const [id, setup] of previousMap.entries()) {
    if (!nextMap.has(id)) {
      changes.push({
        setup: {
          ...setup,
          status: 'expired',
          statusUpdatedAt: new Date().toISOString(),
          ttlExpiresAt: null,
          invalidationReason: null,
        },
        action: 'expired',
      });
    }
  }

  return changes;
}

function broadcastPrice(update: PriceUpdate): void {
  const priceChannel = toPriceChannel(update.symbol);
  const message = JSON.stringify({
    ...update,
    channel: priceChannel,
  });
  for (const [ws, state] of clients) {
    if (
      ws.readyState === WebSocket.OPEN
      && (state.subscriptions.has(update.symbol) || state.subscriptions.has(priceChannel))
    ) {
      ws.send(message);
    }
  }
}

async function broadcastTickPrice(tick: NormalizedMarketTick): Promise<void> {
  const symbol = normalizeSymbol(tick.symbol);
  const priceChannel = toPriceChannel(symbol);
  if (!hasSubscribersForChannel(symbol) && !hasSubscribersForChannel(priceChannel)) {
    return;
  }

  const now = Date.now();
  const lastBroadcast = lastTickBroadcastAtBySymbol.get(symbol) || 0;
  if (now - lastBroadcast < TICK_FANOUT_THROTTLE_MS) {
    return;
  }
  lastTickBroadcastAtBySymbol.set(symbol, now);

  const cached = priceCache.get(symbol);
  let prevClose = cached?.prevClose;
  let volume = cached?.volume || 0;

  if (!prevClose || prevClose <= 0) {
    const latest = await getLatestPriceSnapshot(symbol);
    if (latest) {
      prevClose = latest.prevClose;
      volume = latest.volume;
    }
  }

  const resolvedPrevClose = prevClose && prevClose > 0 ? prevClose : tick.price;
  volume = Math.max(volume, tick.size);
  priceCache.set(symbol, {
    price: tick.price,
    prevClose: resolvedPrevClose,
    volume,
    asOfMs: tick.timestamp,
    fetchedAt: Date.now(),
  });

  const change = tick.price - resolvedPrevClose;
  const changePct = resolvedPrevClose !== 0 ? (change / resolvedPrevClose) * 100 : 0;

  broadcastPrice({
    type: 'price',
    symbol,
    price: Number(tick.price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    volume,
    timestamp: new Date(tick.timestamp).toISOString(),
    source: 'tick',
    feedAgeMs: Math.max(0, now - tick.timestamp),
    seq: tick.sequence === null ? undefined : tick.sequence,
  });
}

function broadcastMicrobar(update: MicrobarUpdate): void {
  const priceChannel = toPriceChannel(update.symbol);
  const message = JSON.stringify({
    ...update,
    channel: priceChannel,
  });

  for (const [ws, state] of clients) {
    if (
      ws.readyState === WebSocket.OPEN
      && (state.subscriptions.has(update.symbol) || state.subscriptions.has(priceChannel))
    ) {
      ws.send(message);
    }
  }
}

function broadcastTickMicrobars(tick: NormalizedMarketTick): void {
  const symbol = normalizeSymbol(tick.symbol);
  const priceChannel = toPriceChannel(symbol);
  if (!hasSubscribersForChannel(symbol) && !hasSubscribersForChannel(priceChannel)) {
    return;
  }

  const microbars = ingestTickMicrobars(tick);
  for (const microbar of microbars) {
    const throttleKey = `${microbar.symbol}:${microbar.interval}`;
    const now = Date.now();
    const lastBroadcast = lastMicrobarBroadcastAtBySymbolInterval.get(throttleKey) || 0;
    if (!microbar.finalized && now - lastBroadcast < MICROBAR_FANOUT_THROTTLE_MS) {
      continue;
    }
    lastMicrobarBroadcastAtBySymbolInterval.set(throttleKey, now);

    broadcastMicrobar({
      type: 'microbar',
      symbol: microbar.symbol,
      interval: microbar.interval,
      bucketStartMs: microbar.bucketStartMs,
      bucketEndMs: microbar.bucketEndMs,
      open: Number(microbar.open.toFixed(2)),
      high: Number(microbar.high.toFixed(2)),
      low: Number(microbar.low.toFixed(2)),
      close: Number(microbar.close.toFixed(2)),
      volume: microbar.volume,
      trades: microbar.trades,
      buyVolume: microbar.buyVolume,
      sellVolume: microbar.sellVolume,
      neutralVolume: microbar.neutralVolume,
      deltaVolume: microbar.deltaVolume,
      bidSize: microbar.bidSize,
      askSize: microbar.askSize,
      bidAskImbalance: microbar.bidAskImbalance,
      bidSizeAtClose: microbar.bidSizeAtClose,
      askSizeAtClose: microbar.askSizeAtClose,
      askBidSizeRatio: microbar.askBidSizeRatio,
      quoteCoveragePct: microbar.quoteCoveragePct,
      avgSpreadBps: microbar.avgSpreadBps,
      finalized: microbar.finalized,
      timestamp: new Date(microbar.updatedAtMs).toISOString(),
      source: 'tick',
    });
  }
}

function broadcastSetupTransition(event: SetupTransitionEvent): void {
  if (!hasSubscribersForChannel('setups:update')) return;

  broadcastChannelMessage('setups:update', 'spx_setup', {
    setup: event.setup,
    action: 'updated',
    transition: {
      id: event.id,
      fromPhase: event.fromPhase,
      toPhase: event.toPhase,
      reason: event.reason,
      price: event.price,
      timestamp: event.timestamp,
    },
  });
}

function broadcastExecutionDirective(event: SetupTransitionEvent): void {
  if (!hasSubscribersForChannel('coach:message')) return;
  const directiveMessage = buildExecutionCoachMessageFromTransition(event);
  if (!directiveMessage) return;

  broadcastChannelMessage('coach:message', 'spx_coach', toCoachChannelPayload(directiveMessage, 'transition'));
}

function broadcastSetupUpdate(update: SetupStatusUpdate): void {
  const channel = toSetupChannel(update.userId);
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

function broadcastSetupDetected(update: SetupDetectedUpdate): void {
  const channel = toSetupChannel(update.userId);
  const message = JSON.stringify({
    type: 'setup_detected',
    channel,
    data: update,
  });

  for (const [ws, state] of clients) {
    if (ws.readyState === WebSocket.OPEN && state.subscriptions.has(channel)) {
      ws.send(message);
    }
  }
}

function broadcastPositionUpdate(update: PositionLiveUpdate): void {
  const channel = toPositionChannel(update.userId);
  const message = JSON.stringify({
    type: 'position_update',
    channel,
    data: update,
  });

  for (const [ws, state] of clients) {
    if (ws.readyState === WebSocket.OPEN && state.subscriptions.has(channel)) {
      ws.send(message);
    }
  }
}

function broadcastPositionAdvice(update: PositionAdviceUpdate): void {
  const channel = toPositionChannel(update.userId);
  const message = JSON.stringify({
    type: 'position_advice',
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

function sendChannelPayloadToClient(
  ws: WebSocket,
  channel: string,
  type: string,
  data: Record<string, unknown>,
): void {
  sendToClient(ws, {
    type,
    channel,
    data,
    timestamp: new Date().toISOString(),
  });
}

async function sendLatestSymbolPriceToClient(
  ws: WebSocket,
  symbol: string,
  channel?: string,
): Promise<void> {
  const now = Date.now();
  const liveTick = getLatestTick(symbol);
  if (liveTick && now - liveTick.timestamp <= TICK_STALE_MS) {
    const cached = priceCache.get(symbol);
    let prevClose = cached?.prevClose;
    let volume = Math.max(cached?.volume || 0, liveTick.size);

    if (!prevClose || prevClose <= 0) {
      const latest = await getLatestPriceSnapshot(symbol);
      if (latest) {
        prevClose = latest.prevClose;
        volume = Math.max(volume, latest.volume);
      }
    }

    const resolvedPrevClose = prevClose && prevClose > 0 ? prevClose : liveTick.price;
    const change = liveTick.price - resolvedPrevClose;
    const changePct = resolvedPrevClose !== 0 ? (change / resolvedPrevClose) * 100 : 0;

    priceCache.set(symbol, {
      price: liveTick.price,
      prevClose: resolvedPrevClose,
      volume,
      asOfMs: liveTick.timestamp,
      fetchedAt: now,
    });

    sendToClient(ws, {
      type: 'price',
      ...(channel ? { channel } : {}),
      symbol,
      price: Number(liveTick.price.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePct: Number(changePct.toFixed(2)),
      volume,
      timestamp: new Date(liveTick.timestamp).toISOString(),
      source: 'tick',
      feedAgeMs: Math.max(0, now - liveTick.timestamp),
      seq: liveTick.sequence === null ? undefined : liveTick.sequence,
    });
    return;
  }

  const latest = await getLatestPriceSnapshot(symbol);
  if (!latest) return;

  const change = latest.price - latest.prevClose;
  const changePct = latest.prevClose !== 0 ? (change / latest.prevClose) * 100 : 0;

  sendToClient(ws, {
    type: 'price',
    ...(channel ? { channel } : {}),
    symbol,
    price: Number(latest.price.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    volume: latest.volume,
    timestamp: new Date(latest.asOfMs).toISOString(),
    source: 'poll',
    feedAgeMs: Math.max(0, now - latest.asOfMs),
  });
}

async function sendInitialSPXChannelSnapshot(
  ws: WebSocket,
  channels: Set<string>,
): Promise<void> {
  const requestedPublicChannels = Array.from(channels).filter((channel) => SPX_PUBLIC_CHANNEL_SET.has(channel));
  if (requestedPublicChannels.length === 0) return;

  const snapshot = await getSPXSnapshot({ forceRefresh: false });
  const snapshotSetups = applyTickStateToSetups(snapshot.setups);
  syncTickEvaluatorSetups(snapshotSetups);

  if (channels.has('gex:SPX')) {
    sendChannelPayloadToClient(ws, 'gex:SPX', 'spx_gex', {
      netGex: snapshot.gex.spx.netGex,
      flipPoint: snapshot.gex.spx.flipPoint,
      callWall: snapshot.gex.spx.callWall,
      putWall: snapshot.gex.spx.putWall,
      topLevels: snapshot.gex.spx.keyLevels.slice(0, 5),
    });
  }

  if (channels.has('gex:SPY')) {
    sendChannelPayloadToClient(ws, 'gex:SPY', 'spx_gex', {
      netGex: snapshot.gex.spy.netGex,
      flipPoint: snapshot.gex.spy.flipPoint,
      callWall: snapshot.gex.spy.callWall,
      putWall: snapshot.gex.spy.putWall,
      topLevels: snapshot.gex.spy.keyLevels.slice(0, 5),
    });
  }

  if (channels.has('regime:update')) {
    sendChannelPayloadToClient(ws, 'regime:update', 'spx_regime', {
      regime: snapshot.regime.regime,
      direction: snapshot.regime.direction,
      probability: snapshot.regime.probability,
      magnitude: snapshot.regime.magnitude,
    });
  }

  if (channels.has('basis:update')) {
    sendChannelPayloadToClient(ws, 'basis:update', 'spx_basis', {
      basis: snapshot.basis.current,
      trend: snapshot.basis.trend,
      leading: snapshot.basis.leading,
      timestamp: snapshot.basis.timestamp,
    });
  }

  if (channels.has('levels:update')) {
    sendChannelPayloadToClient(ws, 'levels:update', 'spx_levels', {
      added: snapshot.levels,
      removed: [],
      modified: [],
    });
  }

  if (channels.has('clusters:update')) {
    sendChannelPayloadToClient(ws, 'clusters:update', 'spx_clusters', {
      zones: snapshot.clusters,
    });
  }

  if (channels.has('setups:update')) {
    for (const setup of snapshotSetups) {
      sendChannelPayloadToClient(ws, 'setups:update', 'spx_setup', {
        setup,
        action: 'created',
      });
    }
  }

  if (channels.has('flow:alert')) {
    for (const event of snapshot.flow) {
      if (event.premium < FLOW_ALERT_PREMIUM_THRESHOLD && event.size < FLOW_ALERT_SIZE_THRESHOLD) continue;
      sendChannelPayloadToClient(ws, 'flow:alert', 'spx_flow', {
        type: event.type,
        symbol: event.symbol,
        strike: event.strike,
        expiry: event.expiry,
        size: event.size,
        direction: event.direction,
        premium: event.premium,
      });
    }
  }

  if (channels.has('coach:message')) {
    const latest = snapshot.coachMessages[0];
    if (latest) {
      sendChannelPayloadToClient(ws, 'coach:message', 'spx_coach', toCoachChannelPayload(latest, 'snapshot'));
    }
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
        const newlySubscribedChannels = new Set<string>();

        for (const sym of symbols) {
          if (typeof sym !== 'string') continue;
          const upper = normalizeSymbol(sym);
          if (!isSymbolSubscription(upper)) {
            sendToClient(ws, { type: 'error', message: `Unknown symbol: ${upper}` });
            continue;
          }
          if (state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
            sendToClient(ws, { type: 'error', message: `Maximum ${MAX_SUBSCRIPTIONS_PER_CLIENT} subscriptions` });
            break;
          }
          state.subscriptions.add(upper);
          void sendLatestSymbolPriceToClient(ws, upper).catch((error) => {
            logger.warn('Failed to send initial websocket symbol price', {
              symbol: upper,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }

        for (const channelCandidate of channels) {
          if (typeof channelCandidate !== 'string') continue;

          const channel = normalizeRealtimeChannel(channelCandidate);
          if (!channel) {
            sendToClient(ws, { type: 'error', message: `Invalid channel: ${String(channelCandidate)}` });
            continue;
          }

          if (!isRealtimeChannelAuthorized(channel, state.userId)) {
            sendToClient(ws, { type: 'error', message: `Forbidden channel: ${channel}` });
            continue;
          }

          if (state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_CLIENT) {
            sendToClient(ws, { type: 'error', message: `Maximum ${MAX_SUBSCRIPTIONS_PER_CLIENT} subscriptions` });
            break;
          }

          state.subscriptions.add(channel);
          newlySubscribedChannels.add(channel);

          const priceChannel = normalizePriceChannel(channel);
          if (priceChannel) {
            const symbol = priceChannel.split(':')[1];
            if (symbol) {
              void sendLatestSymbolPriceToClient(ws, symbol, priceChannel).catch((error) => {
                logger.warn('Failed to send initial websocket channel price', {
                  channel: priceChannel,
                  symbol,
                  error: error instanceof Error ? error.message : String(error),
                });
              });
            }
          }
        }

        if (newlySubscribedChannels.size > 0) {
          void sendInitialSPXChannelSnapshot(ws, newlySubscribedChannels).catch((error) => {
            logger.error('Failed to send initial SPX websocket snapshot', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
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
          const channel = normalizeRealtimeChannel(channelCandidate);
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
  const spxChannels = [
    'gex:SPX',
    'gex:SPY',
    'levels:update',
    'clusters:update',
    'setups:update',
    'regime:update',
    'flow:alert',
    'coach:message',
    'basis:update',
  ];
  const hasSPXSubscribers = hasSubscribersForAnyChannel(spxChannels);
  if (symbols.size === 0 && !hasSPXSubscribers) return;

  const tickFeedConnected = isMassiveTickStreamConnected();
  const now = Date.now();

  for (const symbol of symbols) {
    if (tickFeedConnected) {
      const liveTick = getLatestTick(symbol);
      if (liveTick && now - liveTick.timestamp <= TICK_STALE_MS) {
        continue;
      }
    }

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
      timestamp: new Date(data.asOfMs).toISOString(),
      source: 'poll',
      feedAgeMs: Math.max(0, now - data.asOfMs),
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

  if (hasSPXSubscribers) {
    await broadcastSPXChannels();
  }
}

async function broadcastSPXChannels(): Promise<void> {
  const now = Date.now();

  const snapshot = await getSPXSnapshot({ forceRefresh: false });
  const snapshotWithTickSetups: SPXSnapshot = {
    ...snapshot,
    setups: applyTickStateToSetups(snapshot.setups),
  };
  syncTickEvaluatorSetups(snapshotWithTickSetups.setups);
  const previousSnapshot = lastSPXSnapshot;
  lastSPXSnapshot = snapshotWithTickSetups;

  if (hasSubscribersForChannel('gex:SPX') && now - lastGexBroadcastAtBySymbol.SPX >= GEX_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('gex:SPX', 'spx_gex', {
      netGex: snapshotWithTickSetups.gex.spx.netGex,
      flipPoint: snapshotWithTickSetups.gex.spx.flipPoint,
      callWall: snapshotWithTickSetups.gex.spx.callWall,
      putWall: snapshotWithTickSetups.gex.spx.putWall,
      topLevels: snapshotWithTickSetups.gex.spx.keyLevels.slice(0, 5),
    });
    lastGexBroadcastAtBySymbol.SPX = now;
  }

  if (hasSubscribersForChannel('gex:SPY') && now - lastGexBroadcastAtBySymbol.SPY >= GEX_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('gex:SPY', 'spx_gex', {
      netGex: snapshotWithTickSetups.gex.spy.netGex,
      flipPoint: snapshotWithTickSetups.gex.spy.flipPoint,
      callWall: snapshotWithTickSetups.gex.spy.callWall,
      putWall: snapshotWithTickSetups.gex.spy.putWall,
      topLevels: snapshotWithTickSetups.gex.spy.keyLevels.slice(0, 5),
    });
    lastGexBroadcastAtBySymbol.SPY = now;
  }

  if (hasSubscribersForChannel('regime:update') && now - lastRegimeBroadcastAt >= REGIME_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('regime:update', 'spx_regime', {
      regime: snapshotWithTickSetups.regime.regime,
      direction: snapshotWithTickSetups.regime.direction,
      probability: snapshotWithTickSetups.regime.probability,
      magnitude: snapshotWithTickSetups.regime.magnitude,
    });
    lastRegimeBroadcastAt = now;
  }

  if (hasSubscribersForChannel('basis:update') && now - lastBasisBroadcastAt >= BASIS_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('basis:update', 'spx_basis', {
      basis: snapshotWithTickSetups.basis.current,
      trend: snapshotWithTickSetups.basis.trend,
      leading: snapshotWithTickSetups.basis.leading,
      timestamp: snapshotWithTickSetups.basis.timestamp,
    });
    lastBasisBroadcastAt = now;
  }

  const nextLevelsSignature = levelsSignature(snapshotWithTickSetups.levels);
  if (hasSubscribersForChannel('levels:update') && nextLevelsSignature !== lastLevelsSignature) {
    const delta = diffLevels(previousSnapshot?.levels || [], snapshotWithTickSetups.levels);
    broadcastChannelMessage('levels:update', 'spx_levels', delta as unknown as Record<string, unknown>);
    lastLevelsSignature = nextLevelsSignature;
  }

  const nextClustersSignature = clustersSignature(snapshotWithTickSetups.clusters);
  if (hasSubscribersForChannel('clusters:update') && nextClustersSignature !== lastClustersSignature) {
    broadcastChannelMessage('clusters:update', 'spx_clusters', {
      zones: snapshotWithTickSetups.clusters,
    });
    lastClustersSignature = nextClustersSignature;
  }

  const nextSetupsSignature = setupsSignature(snapshotWithTickSetups.setups);
  if (hasSubscribersForChannel('setups:update') && nextSetupsSignature !== lastSetupsSignature) {
    const setupChanges = diffSetups(previousSnapshot?.setups || [], snapshotWithTickSetups.setups);
    for (const change of setupChanges) {
      broadcastChannelMessage('setups:update', 'spx_setup', {
        setup: change.setup,
        action: change.action,
      });
    }
    lastSetupsSignature = nextSetupsSignature;
  }

  const nextFlowSignature = flowAlertSignature(snapshotWithTickSetups.flow);
  if (hasSubscribersForChannel('flow:alert') && nextFlowSignature !== lastFlowAlertSignature) {
    for (const event of snapshotWithTickSetups.flow) {
      if (event.premium < FLOW_ALERT_PREMIUM_THRESHOLD && event.size < FLOW_ALERT_SIZE_THRESHOLD) {
        continue;
      }
      broadcastChannelMessage('flow:alert', 'spx_flow', {
        type: event.type,
        symbol: event.symbol,
        strike: event.strike,
        expiry: event.expiry,
        size: event.size,
        direction: event.direction,
        premium: event.premium,
      });
    }
    lastFlowAlertSignature = nextFlowSignature;
  }

  const nextCoachSignature = coachMessageSignature(snapshotWithTickSetups.coachMessages);
  if (hasSubscribersForChannel('coach:message') && nextCoachSignature !== lastCoachMessageSignature) {
    const latest = snapshotWithTickSetups.coachMessages[0];
    if (latest) {
      broadcastChannelMessage('coach:message', 'spx_coach', toCoachChannelPayload(latest, 'snapshot'));
    }
    lastCoachMessageSignature = nextCoachSignature;
  }
}

function getCurrentPollInterval(): number {
  const status = getMarketStatus();
  const tickFeedConnected = isMassiveTickStreamConnected();
  const activeSymbols = getActiveSymbols();
  const symbolsToCheck = activeSymbols.size > 0
    ? activeSymbols
    : new Set<string>(['SPX', 'SPY']);
  const tickFeedFresh = tickFeedConnected && areSymbolTicksFresh(symbolsToCheck);

  if (status.status === 'open') {
    return tickFeedFresh ? POLL_INTERVALS.regular : POLL_INTERVALS.degradedRegular;
  }
  if (status.status === 'pre-market' || status.status === 'after-hours') {
    return tickFeedFresh ? POLL_INTERVALS.extended : POLL_INTERVALS.degradedExtended;
  }
  return POLL_INTERVALS.closed;
}

function startPolling(): void {
  if (initialPollTimeout) {
    clearTimeout(initialPollTimeout);
    initialPollTimeout = null;
  }
  if (pollTimer) clearInterval(pollTimer);

  const poll = async () => {
    await pollPrices();
    // Adapt interval based on market status
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, getCurrentPollInterval());
  };

  // Run immediately so command-center surfaces do not hang on skeletons.
  void poll();
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

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const remoteAddress = req.socket.remoteAddress || 'unknown';
    const token = extractWsToken(req);
    if (!token) {
      logger.warn('WebSocket rejected: missing authentication token', {
        remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      sendToClient(ws, { type: 'error', message: 'Missing authentication token' });
      ws.close(WS_CLOSE_UNAUTHORIZED, 'Unauthorized');
      return;
    }

    let authenticatedUserId = '';
    try {
      const user = await verifyAuthToken(token);
      authenticatedUserId = user.id.toLowerCase();
    } catch (error) {
      if (error instanceof AuthTokenError) {
        logger.warn('WebSocket authentication rejected', {
          remoteAddress,
          statusCode: error.statusCode,
          reason: error.clientMessage,
        });
        const closeCode = error.statusCode === 401
          ? WS_CLOSE_UNAUTHORIZED
          : error.statusCode === 403
            ? WS_CLOSE_FORBIDDEN
            : 1011;
        sendToClient(ws, { type: 'error', message: error.clientMessage });
        ws.close(closeCode, error.clientMessage);
        return;
      }

      logger.error('WebSocket authentication error', {
        error: error instanceof Error ? error.message : String(error),
      });
      sendToClient(ws, { type: 'error', message: 'Authentication failed' });
      ws.close(1011, 'Authentication failed');
      return;
    }

    clients.set(ws, {
      userId: authenticatedUserId,
      subscriptions: new Set(),
      lastActivity: Date.now(),
    });

    logger.info('WebSocket client connected', {
      clients: clients.size,
      userId: authenticatedUserId,
      remoteAddress,
    });

    // Send initial market status
    sendToClient(ws, { type: 'status', ...getMarketStatus() });

    ws.on('message', (data) => {
      handleClientMessage(ws, data.toString());
    });

    ws.on('close', (code, reason) => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', {
        clients: clients.size,
        userId: authenticatedUserId,
        code,
        reason: reason.toString('utf8'),
      });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket client error', { error: error.message });
      clients.delete(ws);
    });
  });

  startPolling();
  startHeartbeat();
  unsubscribeSetupEvents = subscribeSetupPushEvents((event) => {
    if (event.type === 'setup_update') {
      broadcastSetupUpdate(event.payload);
      return;
    }
    if (event.type === 'setup_detected') {
      broadcastSetupDetected(event.payload);
    }
  });
  unsubscribePositionEvents = subscribePositionPushEvents((event) => {
    if (event.type === 'position_update') {
      broadcastPositionUpdate(event.payload);
      return;
    }
    if (event.type === 'position_advice') {
      broadcastPositionAdvice(event.payload);
    }
  });
  unsubscribeTickEvents = subscribeMassiveTickUpdates((tick) => {
    void broadcastTickPrice(tick).catch((error) => {
      logger.warn('Failed to broadcast Massive tick price', {
        symbol: tick.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    broadcastTickMicrobars(tick);
    const transitions = evaluateTickSetupTransitions(tick);
    for (const transition of transitions) {
      broadcastSetupTransition(transition);
      broadcastExecutionDirective(transition);
    }
    void persistSetupTransitionsForWinRate(transitions).catch((error) => {
      logger.warn('Failed to persist SPX setup transitions for win-rate tracking', {
        transitionCount: transitions.length,
        error: error instanceof Error ? error.message : String(error),
      });
    });
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
  if (initialPollTimeout) {
    clearTimeout(initialPollTimeout);
    initialPollTimeout = null;
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
  if (unsubscribePositionEvents) {
    unsubscribePositionEvents();
    unsubscribePositionEvents = null;
  }
  if (unsubscribeTickEvents) {
    unsubscribeTickEvents();
    unsubscribeTickEvents = null;
  }
  lastTickBroadcastAtBySymbol.clear();
  lastMicrobarBroadcastAtBySymbolInterval.clear();
  resetMicrobarAggregator();
  resetTickEvaluatorState();
  logger.info('WebSocket server shut down');
}

export const __testables = {
  isSymbolSubscription,
  normalizeSetupChannel,
  normalizePositionChannel,
  normalizePriceChannel,
  normalizePublicSPXChannel,
  normalizeRealtimeChannel,
  getChannelOwnerId,
  isRealtimeChannelAuthorized,
  toSetupChannel,
  toPositionChannel,
  toPriceChannel,
  extractWsToken,
  isSymbolTickFresh,
  areSymbolTicksFresh,
};
