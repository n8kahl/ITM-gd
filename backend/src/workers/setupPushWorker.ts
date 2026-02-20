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
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

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

export type SetupTransitionReason = 'target_reached' | 'stop_loss_hit' | 'stale_timeout' | 'superseded_by_newer_setup';

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
const SETUP_PUSH_FETCH_LIMIT = 5_000;
const SETUP_PUSH_MAX_ACTIVE_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const WORKER_NAME = 'setup_push_worker';

const INDEX_SYMBOLS = new Set(['SPX', 'NDX', 'DJI', 'RUT', 'DJX']);
registerWorker(WORKER_NAME);

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

function trackedSetupEpoch(setup: ActiveTrackedSetupRow): number {
  const parsed = Date.parse(setup.tracked_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAutoDetectedSetup(setup: ActiveTrackedSetupRow): boolean {
  const metadata = setup.opportunity_data
    && typeof setup.opportunity_data === 'object'
    && typeof (setup.opportunity_data as { metadata?: unknown }).metadata === 'object'
    && (setup.opportunity_data as { metadata: Record<string, unknown> }).metadata !== null
      ? (setup.opportunity_data as { metadata: Record<string, unknown> }).metadata
      : null;

  return metadata?.source === 'setup_detector';
}

function dedupeAutoDetectedSetups(rows: ActiveTrackedSetupRow[]): {
  canonical: ActiveTrackedSetupRow[];
  superseded: ActiveTrackedSetupRow[];
} {
  const canonical: ActiveTrackedSetupRow[] = [];
  const superseded: ActiveTrackedSetupRow[] = [];
  const newestByKey = new Set<string>();

  const ranked = [...rows].sort((a, b) => trackedSetupEpoch(b) - trackedSetupEpoch(a));
  for (const setup of ranked) {
    if (!isAutoDetectedSetup(setup)) {
      canonical.push(setup);
      continue;
    }

    const key = [
      setup.user_id,
      setup.symbol.toUpperCase(),
      setup.setup_type,
      setup.direction,
    ].join('|');
    if (!newestByKey.has(key)) {
      newestByKey.add(key);
      canonical.push(setup);
      continue;
    }
    superseded.push(setup);
  }

  return { canonical, superseded };
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
  currentPrice: number | null,
  options?: { publishEvent?: boolean },
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const publishEvent = options?.publishEvent !== false;
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

  if (publishEvent) {
    publishSetupStatusUpdate({
      setupId: setup.id,
      userId: setup.user_id,
      symbol: setup.symbol,
      setupType: setup.setup_type,
      previousStatus: 'active',
      status: transition.status,
      currentPrice: currentPrice != null ? Number(currentPrice.toFixed(2)) : null,
      reason: transition.reason,
      evaluatedAt: nowIso,
    });
  }

  logger.info('Setup push worker: setup transition persisted', {
    setupId: setup.id,
    userId: setup.user_id,
    symbol: setup.symbol,
    status: transition.status,
    reason: transition.reason,
    currentPrice: currentPrice != null ? Number(currentPrice.toFixed(2)) : null,
    publishEvent,
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

    const nowEpoch = Date.now();
    const { canonical, superseded } = dedupeAutoDetectedSetups(rows);
    if (superseded.length > 0) {
      logger.warn('Setup push worker: superseded active setups detected', {
        count: superseded.length,
      });
      for (const setup of superseded) {
        await persistSetupTransition(
          setup,
          { status: 'invalidated', reason: 'superseded_by_newer_setup' },
          null,
          { publishEvent: false },
        );
      }
    }

    const staleSetups: ActiveTrackedSetupRow[] = [];
    const freshSetups: ActiveTrackedSetupRow[] = [];
    for (const setup of canonical) {
      const ageMs = nowEpoch - trackedSetupEpoch(setup);
      if (ageMs > SETUP_PUSH_MAX_ACTIVE_AGE_MS) {
        staleSetups.push(setup);
      } else {
        freshSetups.push(setup);
      }
    }

    if (staleSetups.length > 0) {
      logger.warn('Setup push worker: stale active setups invalidated', {
        count: staleSetups.length,
        maxActiveAgeMs: SETUP_PUSH_MAX_ACTIVE_AGE_MS,
      });
      for (const setup of staleSetups) {
        await persistSetupTransition(
          setup,
          { status: 'invalidated', reason: 'stale_timeout' },
          null,
          { publishEvent: false },
        );
      }
    }

    if (freshSetups.length === 0) return;

    const setupsBySymbol = new Map<string, ActiveTrackedSetupRow[]>();
    for (const row of freshSetups) {
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

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    await pollTrackedSetups();
    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('Setup push worker: run cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const interval = getSetupPushPollingInterval();
  markWorkerNextRun(WORKER_NAME, interval);
  pollingTimer = setTimeout(runCycle, interval);
}

export function startSetupPushWorker(): void {
  if (isRunning) {
    logger.warn('Setup push worker is already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('Setup push worker started');
  markWorkerNextRun(WORKER_NAME, SETUP_PUSH_INITIAL_DELAY);
  pollingTimer = setTimeout(runCycle, SETUP_PUSH_INITIAL_DELAY);
}

export function stopSetupPushWorker(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (pollingTimer) {
    clearTimeout(pollingTimer);
    pollingTimer = null;
  }

  logger.info('Setup push worker stopped');
}
