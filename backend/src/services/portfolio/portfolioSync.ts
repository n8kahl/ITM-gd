import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { TradierClient } from '../broker/tradier/client';

interface BrokerCredentialRow {
  user_id: string;
  broker_name: string;
  account_id: string;
  access_token_ciphertext: string;
  is_active: boolean;
}

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

function decryptAccessToken(ciphertext: string): string {
  // Current foundation slice stores token payload directly in ciphertext column.
  // Follow-up slice can replace this with KMS-backed envelope decryption.
  return ciphertext;
}

export async function syncTradierPortfolioSnapshotForUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('broker_credentials')
    .select('user_id,broker_name,account_id,access_token_ciphertext,is_active')
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
  const accessToken = decryptAccessToken(creds.access_token_ciphertext);
  const tradier = new TradierClient({
    accountId: creds.account_id,
    accessToken,
  });
  const balances = await tradier.getBalances();

  const insertPayload = {
    user_id: creds.user_id,
    snapshot_time: new Date().toISOString(),
    total_equity: toFiniteNumber(balances.totalEquity),
    day_trade_buying_power: toFiniteNumber(balances.dayTradeBuyingPower),
    realized_pnl_daily: toFiniteNumber(balances.realizedPnlDaily),
    metadata: balances.raw,
  };

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
