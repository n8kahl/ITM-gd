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
import { getMarketStatus } from './marketHours';
import { AuthTokenError, extractBearerToken, verifyAuthToken } from '../lib/tokenAuth';
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
import type { SPXSnapshot, Setup } from './spx/types';

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

function formatTicker(symbol: string): string {
  return formatMassiveTicker(symbol);
}

// ============================================
// PRICE CACHE
// ============================================

const priceCache = new Map<string, { price: number; prevClose: number; volume: number; fetchedAt: number }>();
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
let initialPollTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribeSetupEvents: (() => void) | null = null;
let unsubscribePositionEvents: (() => void) | null = null;
const clients = new Map<WebSocket, ClientState>();

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
    .map((setup) => `${setup.id}|${setup.status}|${setup.direction}|${setup.entryZone.low.toFixed(2)}|${setup.entryZone.high.toFixed(2)}`)
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
  const latest = messages[0];
  if (!latest) return '';
  return `${latest.id}|${latest.timestamp}`;
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

          const priceChannel = normalizePriceChannel(channel);
          if (priceChannel) {
            const symbol = priceChannel.split(':')[1];
            if (symbol) {
              const cached = priceCache.get(symbol);
              if (cached) {
                const change = cached.price - cached.prevClose;
                const changePct = cached.prevClose !== 0 ? (change / cached.prevClose) * 100 : 0;
                sendToClient(ws, {
                  type: 'price',
                  channel: priceChannel,
                  symbol,
                  price: Number(cached.price.toFixed(2)),
                  change: Number(change.toFixed(2)),
                  changePct: Number(changePct.toFixed(2)),
                  volume: cached.volume,
                  timestamp: new Date().toISOString(),
                });
              }
            }
          }
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

  if (hasSPXSubscribers) {
    await broadcastSPXChannels();
  }
}

async function broadcastSPXChannels(): Promise<void> {
  const now = Date.now();

  const snapshot = await getSPXSnapshot({ forceRefresh: false });
  const previousSnapshot = lastSPXSnapshot;
  lastSPXSnapshot = snapshot;

  if (hasSubscribersForChannel('gex:SPX') && now - lastGexBroadcastAtBySymbol.SPX >= GEX_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('gex:SPX', 'spx_gex', {
      netGex: snapshot.gex.spx.netGex,
      flipPoint: snapshot.gex.spx.flipPoint,
      callWall: snapshot.gex.spx.callWall,
      putWall: snapshot.gex.spx.putWall,
      topLevels: snapshot.gex.spx.keyLevels.slice(0, 5),
    });
    lastGexBroadcastAtBySymbol.SPX = now;
  }

  if (hasSubscribersForChannel('gex:SPY') && now - lastGexBroadcastAtBySymbol.SPY >= GEX_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('gex:SPY', 'spx_gex', {
      netGex: snapshot.gex.spy.netGex,
      flipPoint: snapshot.gex.spy.flipPoint,
      callWall: snapshot.gex.spy.callWall,
      putWall: snapshot.gex.spy.putWall,
      topLevels: snapshot.gex.spy.keyLevels.slice(0, 5),
    });
    lastGexBroadcastAtBySymbol.SPY = now;
  }

  if (hasSubscribersForChannel('regime:update') && now - lastRegimeBroadcastAt >= REGIME_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('regime:update', 'spx_regime', {
      regime: snapshot.regime.regime,
      direction: snapshot.regime.direction,
      probability: snapshot.regime.probability,
      magnitude: snapshot.regime.magnitude,
    });
    lastRegimeBroadcastAt = now;
  }

  if (hasSubscribersForChannel('basis:update') && now - lastBasisBroadcastAt >= BASIS_BROADCAST_INTERVAL_MS) {
    broadcastChannelMessage('basis:update', 'spx_basis', {
      basis: snapshot.basis.current,
      trend: snapshot.basis.trend,
      leading: snapshot.basis.leading,
      timestamp: snapshot.basis.timestamp,
    });
    lastBasisBroadcastAt = now;
  }

  const nextLevelsSignature = levelsSignature(snapshot.levels);
  if (hasSubscribersForChannel('levels:update') && nextLevelsSignature !== lastLevelsSignature) {
    const delta = diffLevels(previousSnapshot?.levels || [], snapshot.levels);
    broadcastChannelMessage('levels:update', 'spx_levels', delta as unknown as Record<string, unknown>);
    lastLevelsSignature = nextLevelsSignature;
  }

  const nextClustersSignature = clustersSignature(snapshot.clusters);
  if (hasSubscribersForChannel('clusters:update') && nextClustersSignature !== lastClustersSignature) {
    broadcastChannelMessage('clusters:update', 'spx_clusters', {
      zones: snapshot.clusters,
    });
    lastClustersSignature = nextClustersSignature;
  }

  const nextSetupsSignature = setupsSignature(snapshot.setups);
  if (hasSubscribersForChannel('setups:update') && nextSetupsSignature !== lastSetupsSignature) {
    const setupChanges = diffSetups(previousSnapshot?.setups || [], snapshot.setups);
    for (const change of setupChanges) {
      broadcastChannelMessage('setups:update', 'spx_setup', {
        setup: change.setup,
        action: change.action,
      });
    }
    lastSetupsSignature = nextSetupsSignature;
  }

  const nextFlowSignature = flowAlertSignature(snapshot.flow);
  if (hasSubscribersForChannel('flow:alert') && nextFlowSignature !== lastFlowAlertSignature) {
    for (const event of snapshot.flow) {
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

  const nextCoachSignature = coachMessageSignature(snapshot.coachMessages);
  if (hasSubscribersForChannel('coach:message') && nextCoachSignature !== lastCoachMessageSignature) {
    const latest = snapshot.coachMessages[0];
    if (latest) {
      broadcastChannelMessage('coach:message', 'spx_coach', {
        type: latest.type,
        content: latest.content,
        setupId: latest.setupId,
        priority: latest.priority,
      });
    }
    lastCoachMessageSignature = nextCoachSignature;
  }
}

function getCurrentPollInterval(): number {
  const status = getMarketStatus();
  if (status.status === 'open') return POLL_INTERVALS.regular;
  if (status.status === 'pre-market' || status.status === 'after-hours') return POLL_INTERVALS.extended;
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

  // Start first poll after 5 seconds
  initialPollTimeout = setTimeout(async () => {
    initialPollTimeout = null;
    await poll();
  }, 5_000);
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
    const token = extractWsToken(req);
    if (!token) {
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
};
