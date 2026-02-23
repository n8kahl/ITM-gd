import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { TradierClient } from '../broker/tradier/client';
import { decryptTradierAccessToken } from '../broker/tradier/credentials';
import { publishCoachMessage } from '../coachPushChannel';

interface BrokerCredentialRow {
  user_id: string;
  broker_name: string;
  account_id: string;
  access_token_ciphertext: string;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
}

interface PortfolioSnapshotRow {
  total_equity: number | string | null;
  day_trade_buying_power: number | string | null;
  realized_pnl_daily: number | string | null;
}

const SNAPSHOT_SHIFT_THRESHOLD_PCT = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_PORTFOLIO_SYNC_SHIFT_THRESHOLD_PCT || '1');
  return Number.isFinite(parsed) ? Math.max(0.1, parsed) : 1;
})();
const PDT_DTBP_ALERT_THRESHOLD = (() => {
  const parsed = Number.parseFloat(process.env.TRADIER_PDT_DTBP_ALERT_THRESHOLD || '25000');
  return Number.isFinite(parsed) ? Math.max(1_000, parsed) : 25_000;
})();
const PDT_ALERT_COOLDOWN_MS = (() => {
  const parsed = Number.parseInt(process.env.TRADIER_PDT_DTBP_ALERT_COOLDOWN_MS || '1800000', 10);
  return Number.isFinite(parsed) ? Math.max(60_000, parsed) : 1_800_000;
})();
const lastPdtAlertAtByUser = new Map<string, number>();

function isMissingTableError(message: string, table: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('relation') && normalized.includes('does not exist') && normalized.includes(table);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function pctShift(current: number, previous: number): number {
  const baseline = Math.max(1, Math.abs(previous));
  return Math.abs((current - previous) / baseline) * 100;
}

function shouldPersistSnapshot(input: {
  next: PortfolioSnapshotRow;
  previous: PortfolioSnapshotRow | null;
}): boolean {
  if (!input.previous) return true;

  const nextEquity = toFiniteNumber(input.next.total_equity);
  const prevEquity = toFiniteNumber(input.previous.total_equity);
  const nextDtbp = toFiniteNumber(input.next.day_trade_buying_power);
  const prevDtbp = toFiniteNumber(input.previous.day_trade_buying_power);
  const nextRealized = toFiniteNumber(input.next.realized_pnl_daily);
  const prevRealized = toFiniteNumber(input.previous.realized_pnl_daily);

  return (
    pctShift(nextEquity, prevEquity) >= SNAPSHOT_SHIFT_THRESHOLD_PCT
    || pctShift(nextDtbp, prevDtbp) >= SNAPSHOT_SHIFT_THRESHOLD_PCT
    || pctShift(nextRealized, prevRealized) >= SNAPSHOT_SHIFT_THRESHOLD_PCT
  );
}

async function maybePublishPdtAlert(input: {
  userId: string;
  dayTradeBuyingPower: number;
}): Promise<void> {
  if (input.dayTradeBuyingPower >= PDT_DTBP_ALERT_THRESHOLD) return;

  const now = Date.now();
  const lastAlertAt = lastPdtAlertAtByUser.get(input.userId) || 0;
  if (now - lastAlertAt < PDT_ALERT_COOLDOWN_MS) return;
  lastPdtAlertAtByUser.set(input.userId, now);

  publishCoachMessage({
    userId: input.userId,
    source: 'portfolio_sync',
    generatedAt: new Date(now).toISOString(),
    message: {
      id: `pdt_dtbp_alert_${input.userId}_${now}`,
      type: 'behavioral',
      priority: 'behavioral',
      setupId: null,
      timestamp: new Date(now).toISOString(),
      content: `Behavioral alert: Day-trade buying power is $${input.dayTradeBuyingPower.toFixed(2)} (below PDT guideline $${PDT_DTBP_ALERT_THRESHOLD.toFixed(2)}). Reduce size and avoid new risk until capital recovers.`,
      structuredData: {
        source: 'portfolio_sync',
        category: 'pdt_warning',
        dayTradeBuyingPower: Number(input.dayTradeBuyingPower.toFixed(2)),
        threshold: PDT_DTBP_ALERT_THRESHOLD,
      },
    },
  });
}

export async function syncTradierPortfolioSnapshotForUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('broker_credentials')
    .select('user_id,broker_name,account_id,access_token_ciphertext,is_active,metadata')
    .eq('user_id', userId)
    .eq('broker_name', 'tradier')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message, 'broker_credentials')) {
      logger.warn('Portfolio sync skipped because broker_credentials table is unavailable.');
      return false;
    }
    throw new Error(`Failed to load broker credentials: ${error.message}`);
  }

  if (!data) return false;
  const creds = data as BrokerCredentialRow;
  const accessToken = decryptTradierAccessToken(creds.access_token_ciphertext);
  const tradier = new TradierClient({
    accountId: creds.account_id,
    accessToken,
    sandbox: typeof creds.metadata?.tradier_sandbox === 'boolean'
      ? creds.metadata.tradier_sandbox
      : undefined,
  });
  const balances = await tradier.getBalances();

  const { data: lastSnapshotData, error: lastSnapshotError } = await supabase
    .from('portfolio_snapshots')
    .select('total_equity,day_trade_buying_power,realized_pnl_daily')
    .eq('user_id', creds.user_id)
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastSnapshotError && !isMissingTableError(lastSnapshotError.message, 'portfolio_snapshots')) {
    throw new Error(`Failed to load previous portfolio snapshot: ${lastSnapshotError.message}`);
  }

  const insertPayload = {
    user_id: creds.user_id,
    snapshot_time: new Date().toISOString(),
    total_equity: toFiniteNumber(balances.totalEquity),
    day_trade_buying_power: toFiniteNumber(balances.dayTradeBuyingPower),
    realized_pnl_daily: toFiniteNumber(balances.realizedPnlDaily),
    metadata: balances.raw,
  };

  await maybePublishPdtAlert({
    userId: creds.user_id,
    dayTradeBuyingPower: toFiniteNumber(insertPayload.day_trade_buying_power),
  });

  const shouldPersist = shouldPersistSnapshot({
    next: insertPayload,
    previous: (lastSnapshotData as PortfolioSnapshotRow | null) ?? null,
  });
  if (!shouldPersist) {
    return false;
  }

  const { error: insertError } = await supabase
    .from('portfolio_snapshots')
    .insert(insertPayload);

  if (insertError) {
    if (isMissingTableError(insertError.message, 'portfolio_snapshots')) {
      logger.warn('Portfolio sync skipped because portfolio_snapshots table is unavailable.');
      return false;
    }
    throw new Error(`Failed to persist portfolio snapshot: ${insertError.message}`);
  }

  return true;
}

export async function syncAllActiveTradierPortfolioSnapshots(limit = 200): Promise<number> {
  const { data, error } = await supabase
    .from('broker_credentials')
    .select('user_id')
    .eq('broker_name', 'tradier')
    .eq('is_active', true)
    .limit(Math.max(1, Math.floor(limit)));

  if (error) {
    if (isMissingTableError(error.message, 'broker_credentials')) {
      logger.warn('Portfolio sync skipped because broker_credentials table is unavailable.');
      return 0;
    }
    throw new Error(`Failed to query active tradier credentials: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  let synced = 0;
  for (const row of rows) {
    const userId = typeof (row as { user_id?: unknown }).user_id === 'string'
      ? (row as { user_id: string }).user_id
      : '';
    if (!userId) continue;
    try {
      const ok = await syncTradierPortfolioSnapshotForUser(userId);
      if (ok) synced += 1;
    } catch (syncError) {
      logger.warn('Portfolio sync failed for user', {
        userId,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  return synced;
}
