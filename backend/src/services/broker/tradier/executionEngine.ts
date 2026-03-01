import { supabase } from '../../../config/database';
import { logger } from '../../../lib/logger';
import { toEasternTime } from '../../marketHours';
import { publishCoachMessage } from '../../coachPushChannel';
import { getContractRecommendation } from '../../spx/contractSelector';
import type { SetupTransitionEvent } from '../../spx/tickEvaluator';
import {
  upsertExecutionState,
  closeExecutionState,
  loadOpenStates,
  type ExecutionActiveState,
} from '../../spx/executionStateStore';
import { buildTradierEntryOrder, buildTradierMarketExitOrder, buildTradierScaleOrder } from './orderRouter';
import { formatTradierOccSymbol } from './occFormatter';
import { TradierClient } from './client';
import { decryptTradierAccessToken, isTradierProductionRuntimeEnabled } from './credentials';
import { enqueueOrderForPolling, resetOrderPollerState } from './orderLifecycleManager';

interface TradierCredentialRow {
  user_id: string;
  account_id: string;
  access_token_ciphertext: string;
  metadata: Record<string, unknown> | null;
}

interface PortfolioSnapshotRow {
  total_equity: number | string | null;
  day_trade_buying_power: number | string | null;
}

interface SizingResult {
  quantity: number;
  reason: 'ok' | 'margin_limit_blocked';
  maxRiskDollars: number;
  contractsByRisk: number;
  contractsByBuyingPower: number;
  perContractDebit: number;
}

const EXECUTION_ENABLED = String(process.env.TRADIER_EXECUTION_ENABLED || 'false').toLowerCase() === 'true';
const EXECUTION_RUNTIME_ENABLEMENT = isTradierProductionRuntimeEnabled({
  baseEnabled: EXECUTION_ENABLED,
  productionEnableEnv: process.env.TRADIER_EXECUTION_PRODUCTION_ENABLED,
});
const EXECUTION_REQUIRE_METADATA = String(
  process.env.TRADIER_EXECUTION_REQUIRE_AUTO_EXECUTE_METADATA || 'true',
).toLowerCase() !== 'false';
const EXECUTION_SANDBOX_DEFAULT = String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';
const ENTRY_LIMIT_OFFSET = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_EXECUTION_ENTRY_LIMIT_OFFSET || '0.2');
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0.2;
})();
const SCALE_T1_PCT = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_EXECUTION_T1_SCALE_PCT || '0.65');
  return Number.isFinite(parsed) ? Math.max(0.1, Math.min(0.95, parsed)) : 0.65;
})();
const DEFAULT_RISK_PCT = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_EXECUTION_RISK_PCT || '0.02');
  return Number.isFinite(parsed) ? Math.max(0.0025, Math.min(0.05, parsed)) : 0.02;
})();
const BUYING_POWER_UTILIZATION = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_EXECUTION_DTBP_UTILIZATION || '0.90');
  return Number.isFinite(parsed) ? Math.max(0.25, Math.min(0.98, parsed)) : 0.90;
})();
const CREDENTIAL_CACHE_TTL_MS = 30_000;
const EXECUTION_ALLOWED_USER_IDS = new Set(
  String(process.env.TRADIER_EXECUTION_ALLOWED_USER_IDS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

// In-memory cache backed by Supabase for fast lookups during processing loop
const stateByUserSetup = new Map<string, ExecutionActiveState>();
let rehydrated = false;
let cachedCredentials:
  | {
      expiresAt: number;
      rows: TradierCredentialRow[];
    }
  | null = null;

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toSessionDate(input: string): string {
  const parsed = Date.parse(input);
  if (!Number.isFinite(parsed)) return toEasternTime(new Date()).dateStr;
  return toEasternTime(new Date(parsed)).dateStr;
}

function stateKey(userId: string, setupId: string, sessionDate: string): string {
  return `${userId}:${setupId}:${sessionDate}`;
}

function parseMetadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string): boolean {
  const value = metadata?.[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return false;
}

function shouldIncludeUser(userId: string): boolean {
  if (EXECUTION_ALLOWED_USER_IDS.size === 0) return true;
  return EXECUTION_ALLOWED_USER_IDS.has(userId.toLowerCase());
}

function shouldAutoExecuteCredential(row: TradierCredentialRow): boolean {
  if (!shouldIncludeUser(row.user_id)) return false;
  if (!EXECUTION_REQUIRE_METADATA) return true;
  return parseMetadataBoolean(row.metadata, 'spx_auto_execute');
}

function resolveSandboxMode(row: TradierCredentialRow): boolean {
  const metadataValue = row.metadata?.tradier_sandbox;
  if (typeof metadataValue === 'boolean') return metadataValue;
  return EXECUTION_SANDBOX_DEFAULT;
}

function isSetupExecutionEligible(setup: SetupTransitionEvent['setup']): boolean {
  if (setup?.gateStatus === 'blocked') return false;
  const gateReasons = Array.isArray(setup?.gateReasons) ? setup.gateReasons : [];
  if (gateReasons.some((reason) => reason.includes('drift_control_paused'))) return false;
  return true;
}

function createSizingResult(input: {
  ask: number;
  totalEquity: number;
  dayTradeBuyingPower: number;
}): SizingResult {
  const perContractDebit = Math.max(0, input.ask) * 100;
  const maxRiskDollars = Math.max(0, input.totalEquity) * DEFAULT_RISK_PCT;
  const contractsByRisk = perContractDebit > 0 ? Math.floor(maxRiskDollars / perContractDebit) : 0;
  const contractsByBuyingPower = perContractDebit > 0
    ? Math.floor((Math.max(0, input.dayTradeBuyingPower) * BUYING_POWER_UTILIZATION) / perContractDebit)
    : 0;
  const quantity = Math.max(0, Math.min(contractsByRisk, contractsByBuyingPower));

  return {
    quantity,
    reason: quantity >= 1 ? 'ok' : 'margin_limit_blocked',
    maxRiskDollars,
    contractsByRisk,
    contractsByBuyingPower,
    perContractDebit,
  };
}

async function loadLatestPortfolioSnapshot(userId: string): Promise<{ totalEquity: number; dayTradeBuyingPower: number }> {
  const { data } = await supabase
    .from('portfolio_snapshots')
    .select('total_equity,day_trade_buying_power')
    .eq('user_id', userId)
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as PortfolioSnapshotRow | null;
  return {
    totalEquity: toFiniteNumber(row?.total_equity, 0),
    dayTradeBuyingPower: toFiniteNumber(row?.day_trade_buying_power, 0),
  };
}

export function inferTargetOptionPrice(input: {
  entryLimitPrice: number;
  bid: number;
  ask: number;
  expectedPnlAtTarget1?: number;
  setupTarget1Price?: number;
  setupEntryMid?: number;
  setupStop?: number;
  delta?: number;
  gamma?: number;
}): number {
  // S5: Use actual geometry-based T1 price when available
  if (
    typeof input.setupTarget1Price === 'number'
    && typeof input.setupEntryMid === 'number'
    && typeof input.setupStop === 'number'
    && typeof input.delta === 'number'
  ) {
    const moveToT1 = Math.abs(input.setupTarget1Price - input.setupEntryMid);
    const gammaAdj = typeof input.gamma === 'number' ? input.gamma * (moveToT1 ** 2) / 2 : 0;
    const optionPriceChange = Math.abs(input.delta) * moveToT1 + gammaAdj;
    const mid = (input.bid + input.ask) / 2;
    const estimated = mid + (optionPriceChange / 100);
    if (Number.isFinite(estimated) && estimated > 0.05) {
      return Number(Math.max(0.05, estimated).toFixed(2));
    }
  }

  // Fallback: use expectedPnlAtTarget1 if provided
  const mid = (input.bid + input.ask) / 2;
  const expected = typeof input.expectedPnlAtTarget1 === 'number'
    ? mid + (input.expectedPnlAtTarget1 / 100)
    : input.entryLimitPrice * 1.35;
  if (!Number.isFinite(expected)) return Number(input.entryLimitPrice.toFixed(2));
  return Number(Math.max(0.05, expected).toFixed(2));
}

function inferEntryProtectiveStopPrice(input: {
  entryLimitPrice: number;
  recommendation: { delta?: number; gamma?: number };
  setup: SetupTransitionEvent['setup'];
}): number {
  const fallback = Number(Math.max(0.05, input.entryLimitPrice * 0.65).toFixed(2));
  const entryMid = input.setup?.entryZone
    ? (input.setup.entryZone.low + input.setup.entryZone.high) / 2
    : null;
  const setupStop = typeof input.setup?.stop === 'number' ? input.setup.stop : null;
  const delta = typeof input.recommendation.delta === 'number'
    ? Math.abs(input.recommendation.delta)
    : null;
  const gamma = typeof input.recommendation.gamma === 'number'
    ? Math.abs(input.recommendation.gamma)
    : 0;

  if (
    entryMid == null
    || setupStop == null
    || delta == null
    || !Number.isFinite(entryMid)
    || !Number.isFinite(setupStop)
    || !Number.isFinite(delta)
  ) {
    return fallback;
  }

  const setupRiskDistance = Math.max(0.25, Math.abs(entryMid - setupStop));
  const gammaContribution = gamma * ((setupRiskDistance ** 2) / 2);
  const estimatedOptionRisk = (delta * setupRiskDistance) + gammaContribution;
  const estimatedStop = input.entryLimitPrice - (estimatedOptionRisk / 100);

  if (!Number.isFinite(estimatedStop)) return fallback;
  const capped = Math.min(input.entryLimitPrice * 0.95, estimatedStop);
  return Number(Math.max(0.05, capped).toFixed(2));
}

async function loadActiveExecutionCredentials(): Promise<TradierCredentialRow[]> {
  const now = Date.now();
  if (cachedCredentials && cachedCredentials.expiresAt > now) {
    return cachedCredentials.rows;
  }

  const { data, error } = await supabase
    .from('broker_credentials')
    .select('user_id,account_id,access_token_ciphertext,metadata')
    .eq('broker_name', 'tradier')
    .eq('is_active', true)
    .limit(300);

  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('relation') && normalized.includes('does not exist') && normalized.includes('broker_credentials')) {
      logger.warn('Tradier execution engine skipped because broker_credentials table is unavailable.');
      return [];
    }
    throw new Error(`Tradier execution engine failed to load credentials: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? data : []) as TradierCredentialRow[];
  const filtered = rows.filter((row) => row.user_id && row.account_id && row.access_token_ciphertext);
  cachedCredentials = {
    expiresAt: now + CREDENTIAL_CACHE_TTL_MS,
    rows: filtered,
  };
  return filtered;
}

/**
 * Rehydrate in-memory cache from Supabase on startup. (S1)
 */
export async function rehydrateExecutionStates(): Promise<number> {
  try {
    const openStates = await loadOpenStates();
    for (const state of openStates) {
      const key = stateKey(state.userId, state.setupId, state.sessionDate);
      stateByUserSetup.set(key, state);
    }
    rehydrated = true;
    logger.info('Execution states rehydrated from Supabase', { count: openStates.length });
    return openStates.length;
  } catch (error) {
    logger.warn('Failed to rehydrate execution states; starting with empty cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    rehydrated = true;
    return 0;
  }
}

async function handleTriggeredTransition(
  event: SetupTransitionEvent,
  credentials: TradierCredentialRow[],
): Promise<void> {
  if (!isSetupExecutionEligible(event.setup)) {
    logger.info('Tradier execution skipped due to blocked setup gate', {
      setupId: event.setupId,
      gateStatus: event.setup?.gateStatus ?? null,
      gateReasons: event.setup?.gateReasons ?? [],
    });
    return;
  }

  const recommendation = await getContractRecommendation({
    setup: event.setup,
    forceRefresh: true,
  });
  if (!recommendation) return;

  const optionSymbol = formatTradierOccSymbol({
    underlying: 'SPX',
    expiry: recommendation.expiry,
    optionType: recommendation.type,
    strike: recommendation.strike,
  });
  const sessionDate = toSessionDate(event.timestamp);

  for (const credential of credentials) {
    if (!shouldAutoExecuteCredential(credential)) continue;
    const key = stateKey(credential.user_id, event.setupId, sessionDate);
    if (stateByUserSetup.has(key)) continue;

    const portfolio = await loadLatestPortfolioSnapshot(credential.user_id);
    const sizing = createSizingResult({
      ask: recommendation.ask,
      totalEquity: portfolio.totalEquity,
      dayTradeBuyingPower: portfolio.dayTradeBuyingPower,
    });
    if (sizing.reason !== 'ok') {
      logger.info('Tradier execution blocked by margin/risk sizing constraints', {
        userId: credential.user_id,
        setupId: event.setupId,
        contractsByRisk: sizing.contractsByRisk,
        contractsByBuyingPower: sizing.contractsByBuyingPower,
      });
      continue;
    }

    try {
      const tradier = new TradierClient({
        accountId: credential.account_id,
        accessToken: decryptTradierAccessToken(credential.access_token_ciphertext),
        sandbox: resolveSandboxMode(credential),
      });
      const entryLimitPrice = Number((recommendation.ask + ENTRY_LIMIT_OFFSET).toFixed(2));
      const protectiveStopPrice = inferEntryProtectiveStopPrice({
        entryLimitPrice,
        recommendation,
        setup: event.setup,
      });
      const entryOrder = await tradier.placeOrder(buildTradierEntryOrder({
        symbol: optionSymbol,
        quantity: sizing.quantity,
        limitPrice: entryLimitPrice,
        tag: `spx:${event.setupId}:${sessionDate}:entry`,
      }));

      // S1: Persist to Supabase with duplicate prevention (S5)
      const { inserted, state: persistedState } = await upsertExecutionState({
        userId: credential.user_id,
        setupId: event.setupId,
        sessionDate,
        symbol: optionSymbol,
        quantity: sizing.quantity,
        remainingQuantity: sizing.quantity,
        entryOrderId: entryOrder.id,
        entryLimitPrice,
      });

      if (!inserted) {
        // Duplicate detected at DB level - cancel the order we just placed
        logger.warn('Duplicate execution state detected; cancelling duplicate entry order', {
          userId: credential.user_id,
          setupId: event.setupId,
          orderId: entryOrder.id,
        });
        await tradier.cancelOrder(entryOrder.id).catch(() => false);
        continue;
      }

      // Update in-memory cache
      if (persistedState) {
        stateByUserSetup.set(key, persistedState);
      }

      enqueueOrderForPolling({
        orderId: entryOrder.id,
        userId: credential.user_id,
        setupId: event.setupId,
        sessionDate,
        phase: 'entry',
        tradier,
        totalQuantity: sizing.quantity,
        transitionEventId: event.id,
        direction: event.direction,
        referencePrice: entryLimitPrice,
        protectiveStopPrice,
        symbol: optionSymbol,
      });

      publishCoachMessage({
        userId: credential.user_id,
        generatedAt: new Date().toISOString(),
        source: 'broker_execution',
        message: {
          id: `tradier_entry_${credential.user_id}_${event.id}`,
          type: 'behavioral',
          priority: 'guidance',
          setupId: event.setupId,
          timestamp: new Date().toISOString(),
          content: `Tradier ${resolveSandboxMode(credential) ? 'sandbox' : 'live'} entry routed (${sizing.quantity} contract${sizing.quantity > 1 ? 's' : ''}) for setup ${event.setupId}.`,
          structuredData: {
            source: 'tradier_execution',
            orderId: entryOrder.id,
            symbol: optionSymbol,
            quantity: sizing.quantity,
            sandbox: resolveSandboxMode(credential),
          },
        },
      });
    } catch (error) {
      logger.warn('Tradier execution entry routing failed', {
        userId: credential.user_id,
        setupId: event.setupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function handleTarget1Transition(event: SetupTransitionEvent): Promise<void> {
  const sessionDate = toSessionDate(event.timestamp);
  const suffix = `:${event.setupId}:${sessionDate}`;
  const activeStates = Array.from(stateByUserSetup.entries()).filter(([key]) => key.endsWith(suffix));
  if (activeStates.length === 0) return;

  for (const [, state] of activeStates) {
    if (state.remainingQuantity <= 0) continue;
    const partialQuantity = Math.min(
      state.remainingQuantity,
      Math.max(1, Math.floor(state.quantity * SCALE_T1_PCT)),
    );
    if (partialQuantity <= 0) continue;

    const { data } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata')
      .eq('user_id', state.userId)
      .eq('broker_name', 'tradier')
      .eq('is_active', true)
      .maybeSingle();
    if (!data) continue;

    try {
      const row = data as {
        account_id: string;
        access_token_ciphertext: string;
        metadata: Record<string, unknown> | null;
      };
      const tradier = new TradierClient({
        accountId: row.account_id,
        accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
        sandbox: typeof row.metadata?.tradier_sandbox === 'boolean'
          ? row.metadata.tradier_sandbox
          : EXECUTION_SANDBOX_DEFAULT,
      });

      // S5: Use geometry-based T1 pricing when available
      const targetPrice = inferTargetOptionPrice({
        entryLimitPrice: state.entryLimitPrice,
        bid: state.entryLimitPrice * 0.9,
        ask: state.entryLimitPrice * 1.1,
        expectedPnlAtTarget1: event.setup?.recommendedContract?.expectedPnlAtTarget1,
        setupTarget1Price: event.setup?.target1?.price,
        setupEntryMid: event.setup?.entryZone
          ? (event.setup.entryZone.low + event.setup.entryZone.high) / 2
          : undefined,
        setupStop: event.setup?.stop,
        delta: event.setup?.recommendedContract?.delta,
        gamma: event.setup?.recommendedContract?.gamma,
      });
      const partialOrder = await tradier.placeOrder(buildTradierScaleOrder({
        symbol: state.symbol,
        quantity: partialQuantity,
        limitPrice: targetPrice,
        tag: `spx:${state.setupId}:${state.sessionDate}:t1`,
      }));

      // S6: Move stop to entry + 0.15R instead of flat breakeven
      const runnerStopPrice = Math.max(0.05, state.entryLimitPrice * 1.015);
      enqueueOrderForPolling({
        orderId: partialOrder.id,
        userId: state.userId,
        setupId: event.setupId,
        sessionDate: state.sessionDate,
        phase: 't1',
        tradier,
        totalQuantity: partialQuantity,
        transitionEventId: event.id,
        direction: event.direction,
        referencePrice: targetPrice,
        symbol: state.symbol,
        activeStopOrderId: state.runnerStopOrderId,
        remainingBeforeOrder: state.remainingQuantity,
        postFillStopPrice: runnerStopPrice,
        fillSide: 'partial',
        fillPhase: 'target1_hit',
      });
    } catch (error) {
      logger.warn('Tradier execution T1 routing failed', {
        userId: state.userId,
        setupId: state.setupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function handleTerminalTransition(event: SetupTransitionEvent): Promise<void> {
  const sessionDate = toSessionDate(event.timestamp);
  const suffix = `:${event.setupId}:${sessionDate}`;
  const activeStates = Array.from(stateByUserSetup.entries()).filter(([key]) => key.endsWith(suffix));
  if (activeStates.length === 0) return;

  for (const [key, state] of activeStates) {
    if (state.remainingQuantity <= 0) {
      // S1: Close state in Supabase
      await closeExecutionState(state.userId, state.setupId, state.sessionDate, event.reason || 'expired').catch(() => undefined);
      stateByUserSetup.delete(key);
      continue;
    }

    const { data } = await supabase
      .from('broker_credentials')
      .select('account_id,access_token_ciphertext,metadata')
      .eq('user_id', state.userId)
      .eq('broker_name', 'tradier')
      .eq('is_active', true)
      .maybeSingle();
    if (!data) continue;

    try {
      const row = data as {
        account_id: string;
        access_token_ciphertext: string;
        metadata: Record<string, unknown> | null;
      };
      const tradier = new TradierClient({
        accountId: row.account_id,
        accessToken: decryptTradierAccessToken(row.access_token_ciphertext),
        sandbox: typeof row.metadata?.tradier_sandbox === 'boolean'
          ? row.metadata.tradier_sandbox
          : EXECUTION_SANDBOX_DEFAULT,
      });

      if (state.runnerStopOrderId) {
        await tradier.cancelOrder(state.runnerStopOrderId).catch(() => false);
      }

      const exitOrder = await tradier.placeOrder(buildTradierMarketExitOrder({
        symbol: state.symbol,
        quantity: state.remainingQuantity,
        tag: `spx:${state.setupId}:${state.sessionDate}:terminal`,
      }));
      enqueueOrderForPolling({
        orderId: exitOrder.id,
        userId: state.userId,
        setupId: event.setupId,
        sessionDate: state.sessionDate,
        phase: 'terminal',
        tradier,
        totalQuantity: state.remainingQuantity,
        transitionEventId: event.id,
        direction: event.direction,
        referencePrice: state.entryLimitPrice,
        fillSide: 'exit',
        fillPhase: event.reason === 'stop' ? 'invalidated' : 'target2_hit',
      });
    } catch (error) {
      logger.warn('Tradier execution terminal routing failed', {
        userId: state.userId,
        setupId: state.setupId,
        reason: event.reason,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // S1: Close state in Supabase
      const closeReason = event.reason === 'stop' ? 'stop' : 'target2_hit';
      await closeExecutionState(state.userId, state.setupId, state.sessionDate, closeReason).catch(() => undefined);
      stateByUserSetup.delete(key);
    }
  }
}

export async function processTradierExecutionTransitions(events: SetupTransitionEvent[]): Promise<void> {
  if (!EXECUTION_RUNTIME_ENABLEMENT.enabled) return;
  if (!Array.isArray(events) || events.length === 0) return;

  // S1: Ensure rehydration on first call
  if (!rehydrated) {
    await rehydrateExecutionStates();
  }

  const actionable = events.filter((event) => event.symbol === 'SPX');
  if (actionable.length === 0) return;

  const credentials = await loadActiveExecutionCredentials();
  if (credentials.length === 0) return;

  for (const event of actionable) {
    if (event.toPhase === 'triggered') {
      await handleTriggeredTransition(event, credentials);
      continue;
    }
    if (event.toPhase === 'target1_hit') {
      await handleTarget1Transition(event);
      continue;
    }
    if (event.toPhase === 'target2_hit' || (event.toPhase === 'invalidated' && event.reason === 'stop')) {
      await handleTerminalTransition(event);
    }
  }
}

export function getTradierExecutionRuntimeStatus(): {
  enabled: boolean;
  reason: string | null;
  sandboxDefault: boolean;
  metadataRequired: boolean;
  trackedTrades: number;
} {
  return {
    enabled: EXECUTION_RUNTIME_ENABLEMENT.enabled,
    reason: EXECUTION_RUNTIME_ENABLEMENT.reason,
    sandboxDefault: EXECUTION_SANDBOX_DEFAULT,
    metadataRequired: EXECUTION_REQUIRE_METADATA,
    trackedTrades: stateByUserSetup.size,
  };
}

export function __resetExecutionEngineStateForTests(): void {
  stateByUserSetup.clear();
  rehydrated = false;
  cachedCredentials = null;
  resetOrderPollerState();
}
