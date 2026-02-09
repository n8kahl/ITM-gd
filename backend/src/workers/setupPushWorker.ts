/**
 * Setup Push Worker
 *
 * Purpose:
 * - Poll active tracked setups on an adaptive schedule.
 * - Evaluate setup state transitions from live price vs tracked trade levels.
 * - Persist transition (`active -> triggered|invalidated`) and publish user-targeted updates.
 * - Emit heartbeat telemetry for observability.
 */

import { supabase } from '../config/database';
import { getDailyAggregates, getMinuteAggregates } from '../config/massive';
import { logger } from '../lib/logger';
import { getMarketStatus } from '../services/marketHours';
import {
  publishSetupPushHeartbeat,
  publishSetupStatusUpdate,
} from '../services/setupPushChannel';

interface ActiveTrackedSetupRow {
  id: string;
  user_id: string;
  symbol: string;
  setup_type: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  tracked_at: string;
  opportunity_data: Record<string, unknown> | null;
}

export interface SetupTradeLevels {
  entry?: number;
  stopLoss?: number;
  target?: number;
}

export type SetupTransitionReason = 'target_reached' | 'stop_loss_hit';

export interface SetupTransition {
  status: 'triggered' | 'invalidated';
  reason: SetupTransitionReason;
}

interface SymbolPriceData {
  currentPrice: number;
}

export const SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN = 15_000; // 15 seconds
export const SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED = 60_000; // 60 seconds
export const SETUP_PUSH_INITIAL_DELAY = 15_000; // 15 seconds
const SETUP_PUSH_FETCH_LIMIT = 200;

const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'RUT', 'DJX']);

let pollingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

function formatTicker(symbol: string): string {
  return INDEX_SYMBOLS.has(symbol) ? `I:${symbol}` : symbol;
}

export function extractSetupTradeLevels(opportunityData: Record<string, unknown> | null): SetupTradeLevels {
  if (!opportunityData || typeof opportunityData !== 'object') return {};

  const suggestedTrade = (opportunityData as { suggestedTrade?: Record<string, unknown> }).suggestedTrade;
  if (!suggestedTrade || typeof suggestedTrade !== 'object') return {};

  return {
    entry: toFiniteNumber(suggestedTrade.entry),
    stopLoss: toFiniteNumber(suggestedTrade.stopLoss),
    target: toFiniteNumber(suggestedTrade.target),
  };
}

export function evaluateSetupTransition(
  direction: ActiveTrackedSetupRow['direction'],
  currentPrice: number,
  levels: SetupTradeLevels,
): SetupTransition | null {
  if (!Number.isFinite(currentPrice)) return null;
  if (direction === 'neutral') return null;

  if (direction === 'bullish') {
    if (levels.target !== undefined && currentPrice >= levels.target) {
      return { status: 'triggered', reason: 'target_reached' };
    }
    if (levels.stopLoss !== undefined && currentPrice <= levels.stopLoss) {
      return { status: 'invalidated', reason: 'stop_loss_hit' };
    }
    return null;
  }

  if (levels.target !== undefined && currentPrice <= levels.target) {
    return { status: 'triggered', reason: 'target_reached' };
  }
  if (levels.stopLoss !== undefined && currentPrice >= levels.stopLoss) {
    return { status: 'invalidated', reason: 'stop_loss_hit' };
  }

  return null;
}

async function fetchCurrentPrice(symbol: string): Promise<SymbolPriceData | null> {
  try {
    const ticker = formatTicker(symbol);
    const today = new Date().toISOString().split('T')[0];

    const minuteData = await getMinuteAggregates(ticker, today);
    if (minuteData.length > 0) {
      const lastBar = minuteData[minuteData.length - 1];
      return { currentPrice: lastBar.c };
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const dailyData = await getDailyAggregates(ticker, yesterday, today);
    if (dailyData.length > 0) {
      const lastBar = dailyData[dailyData.length - 1];
      return { currentPrice: lastBar.c };
    }

    return null;
  } catch (error) {
    logger.warn('Setup push worker: failed to fetch current price', {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function getSetupPushPollingInterval(): number {
  const status = getMarketStatus();
  if (status.status === 'open' || status.status === 'pre-market' || status.status === 'after-hours') {
    return SETUP_PUSH_POLL_INTERVAL_MARKET_OPEN;
  }
  return SETUP_PUSH_POLL_INTERVAL_MARKET_CLOSED;
}

async function persistSetupTransition(
  setup: ActiveTrackedSetupRow,
  transition: SetupTransition,
  currentPrice: number,
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    status: transition.status,
    updated_at: nowIso,
  };

  if (transition.status === 'triggered') {
    updatePayload.triggered_at = nowIso;
    updatePayload.invalidated_at = null;
  } else {
    updatePayload.invalidated_at = nowIso;
    updatePayload.triggered_at = null;
  }

  const { data, error } = await supabase
    .from('ai_coach_tracked_setups')
    .update(updatePayload)
    .eq('id', setup.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('Setup push worker: failed to persist setup transition', {
      setupId: setup.id,
      status: transition.status,
      error: error.message,
      code: (error as any).code,
    });
    return false;
  }

  if (!data) return false;

  publishSetupStatusUpdate({
    setupId: setup.id,
    userId: setup.user_id,
    symbol: setup.symbol,
    setupType: setup.setup_type,
    previousStatus: 'active',
    status: transition.status,
    currentPrice: Number(currentPrice.toFixed(2)),
    reason: transition.reason,
    evaluatedAt: nowIso,
  });

  logger.info('Setup push worker: setup transition published', {
    setupId: setup.id,
    userId: setup.user_id,
    symbol: setup.symbol,
    status: transition.status,
    reason: transition.reason,
    currentPrice: Number(currentPrice.toFixed(2)),
  });

  return true;
}

async function pollTrackedSetups(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('ai_coach_tracked_setups')
      .select('id, user_id, symbol, setup_type, direction, tracked_at, opportunity_data')
      .eq('status', 'active')
      .limit(SETUP_PUSH_FETCH_LIMIT);

    if (error) {
      logger.error('Setup push worker: failed to fetch tracked setups', {
        error: error.message,
        code: (error as any).code,
      });
      return;
    }

    const rows = (data || []) as ActiveTrackedSetupRow[];
    const uniqueUsers = new Set(rows.map((row) => row.user_id)).size;

    publishSetupPushHeartbeat({
      generatedAt: new Date().toISOString(),
      activeSetupCount: rows.length,
      uniqueUsers,
    });

    if (rows.length === 0) return;

    const setupsBySymbol = new Map<string, ActiveTrackedSetupRow[]>();
    for (const row of rows) {
      const key = row.symbol.toUpperCase();
      const existing = setupsBySymbol.get(key) || [];
      existing.push({ ...row, symbol: key });
      setupsBySymbol.set(key, existing);
    }

    for (const [symbol, symbolSetups] of setupsBySymbol) {
      const priceData = await fetchCurrentPrice(symbol);
      if (!priceData) continue;

      for (const setup of symbolSetups) {
        const levels = extractSetupTradeLevels(setup.opportunity_data);
        const transition = evaluateSetupTransition(setup.direction, priceData.currentPrice, levels);
        if (!transition) continue;

        await persistSetupTransition(setup, transition, priceData.currentPrice);
      }
    }
  } catch (error) {
    logger.error('Setup push worker: poll cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  await pollTrackedSetups();
  pollingTimer = setTimeout(runCycle, getSetupPushPollingInterval());
}

export function startSetupPushWorker(): void {
  if (isRunning) {
    logger.warn('Setup push worker is already running');
    return;
  }

  isRunning = true;
  logger.info('Setup push worker started');
  pollingTimer = setTimeout(runCycle, SETUP_PUSH_INITIAL_DELAY);
}

export function stopSetupPushWorker(): void {
  isRunning = false;

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }

  logger.info('Setup push worker stopped');
}
