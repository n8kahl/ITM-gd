import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { MARKET_HOLIDAYS, toEasternTime } from '../marketHours';
import { TradierClient } from '../broker/tradier/client';
import { decryptTradierAccessToken, isTradierProductionRuntimeEnabled } from '../broker/tradier/credentials';
import { formatTradierOccSymbol } from '../broker/tradier/occFormatter';

interface OpenPositionRow {
  id: string;
  user_id: string;
  symbol: string;
  position_type: string;
  strike: number | string | null;
  expiry: string | null;
  quantity: number | string | null;
  current_price: number | string | null;
  entry_price: number | string | null;
  notes: string | null;
}

interface CredentialRow {
  user_id: string;
  account_id: string;
  access_token_ciphertext: string;
  metadata: Record<string, unknown> | null;
}

export interface TradierFlattenSummary {
  enabled: boolean;
  disabledReason: string | null;
  consideredPositions: number;
  flattenedPositions: number;
  failedPositions: number;
}

const FLATTEN_ENABLED = String(process.env.TRADIER_FORCE_FLATTEN_ENABLED || 'false').toLowerCase() === 'true';
const FLATTEN_RUNTIME = isTradierProductionRuntimeEnabled({
  baseEnabled: FLATTEN_ENABLED,
  productionEnableEnv: process.env.TRADIER_FORCE_FLATTEN_PRODUCTION_ENABLED,
});
const FLATTEN_MINUTES_BEFORE_CLOSE = (() => {
  const parsed = Number.parseInt(process.env.TRADIER_FORCE_FLATTEN_MINUTES_BEFORE_CLOSE || '5', 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 5;
})();
const SANDBOX_DEFAULT = String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function closeMinuteEtForDate(dateStr: string): number {
  const holidayType = MARKET_HOLIDAYS[dateStr];
  return holidayType === 'early' ? (13 * 60) : (16 * 60);
}

function shouldRunFlattenNow(now: Date): boolean {
  const et = toEasternTime(now);
  const minuteOfDay = et.hour * 60 + et.minute;
  const closeMinute = closeMinuteEtForDate(et.dateStr);
  return minuteOfDay >= Math.max(0, closeMinute - FLATTEN_MINUTES_BEFORE_CLOSE) && minuteOfDay < closeMinute;
}

function resolveSandbox(metadata: Record<string, unknown> | null): boolean {
  if (typeof metadata?.tradier_sandbox === 'boolean') return metadata.tradier_sandbox;
  return SANDBOX_DEFAULT;
}

function appendFlattenNote(existing: string | null, nowIso: string): string {
  const prefix = existing && existing.trim().length > 0 ? `${existing.trim()}\n` : '';
  return `${prefix}[${nowIso}] Auto-flattened before close to avoid 0DTE exercise/assignment risk.`;
}

export async function enforceTradierLateDayFlatten(now: Date = new Date()): Promise<TradierFlattenSummary> {
  if (!FLATTEN_RUNTIME.enabled) {
    return {
      enabled: false,
      disabledReason: FLATTEN_RUNTIME.reason,
      consideredPositions: 0,
      flattenedPositions: 0,
      failedPositions: 0,
    };
  }

  if (!shouldRunFlattenNow(now)) {
    return {
      enabled: true,
      disabledReason: null,
      consideredPositions: 0,
      flattenedPositions: 0,
      failedPositions: 0,
    };
  }

  const et = toEasternTime(now);
  const sessionDate = et.dateStr;
  const nowIso = now.toISOString();

  const { data: openRowsData, error: openRowsError } = await supabase
    .from('ai_coach_positions')
    .select('id,user_id,symbol,position_type,strike,expiry,quantity,current_price,entry_price,notes')
    .eq('status', 'open')
    .eq('symbol', 'SPX')
    .eq('expiry', sessionDate)
    .in('position_type', ['call', 'put']);

  if (openRowsError) {
    const normalized = openRowsError.message.toLowerCase();
    if (normalized.includes('relation') && normalized.includes('does not exist') && normalized.includes('ai_coach_positions')) {
      logger.warn('Tradier late-day flatten skipped because ai_coach_positions table is unavailable.');
      return {
        enabled: true,
        disabledReason: null,
        consideredPositions: 0,
        flattenedPositions: 0,
        failedPositions: 0,
      };
    }
    throw new Error(`Tradier late-day flatten failed to load open positions: ${openRowsError.message}`);
  }

  const openRows = (Array.isArray(openRowsData) ? openRowsData : []) as OpenPositionRow[];
  if (openRows.length === 0) {
    return {
      enabled: true,
      disabledReason: null,
      consideredPositions: 0,
      flattenedPositions: 0,
      failedPositions: 0,
    };
  }

  const userIds = Array.from(new Set(openRows.map((row) => row.user_id).filter(Boolean)));
  const { data: credentialRowsData, error: credentialError } = await supabase
    .from('broker_credentials')
    .select('user_id,account_id,access_token_ciphertext,metadata')
    .in('user_id', userIds)
    .eq('broker_name', 'tradier')
    .eq('is_active', true);

  if (credentialError) {
    throw new Error(`Tradier late-day flatten failed to load credentials: ${credentialError.message}`);
  }

  const credentialByUser = new Map<string, CredentialRow>();
  for (const row of (credentialRowsData || []) as CredentialRow[]) {
    credentialByUser.set(row.user_id, row);
  }

  let flattenedPositions = 0;
  let failedPositions = 0;

  for (const row of openRows) {
    const credential = credentialByUser.get(row.user_id);
    if (!credential) continue;

    const qty = Math.max(0, Math.floor(Math.abs(toFiniteNumber(row.quantity) || 0)));
    if (qty < 1) continue;
    const strike = toFiniteNumber(row.strike);
    if (!strike || !row.expiry || (row.position_type !== 'call' && row.position_type !== 'put')) continue;

    try {
      const symbol = formatTradierOccSymbol({
        underlying: row.symbol,
        expiry: row.expiry,
        optionType: row.position_type,
        strike,
      });
      const tradier = new TradierClient({
        accountId: credential.account_id,
        accessToken: decryptTradierAccessToken(credential.access_token_ciphertext),
        sandbox: resolveSandbox(credential.metadata),
      });
      await tradier.placeOrder({
        class: 'option',
        symbol,
        side: 'sell_to_close',
        quantity: qty,
        type: 'market',
        duration: 'day',
        tag: `spx:flatten:${row.id}:${sessionDate}`,
      });

      const closePrice = toFiniteNumber(row.current_price) || toFiniteNumber(row.entry_price) || 0;
      const { error: patchError } = await supabase
        .from('ai_coach_positions')
        .update({
          status: 'closed',
          close_date: sessionDate,
          close_price: closePrice,
          updated_at: nowIso,
          notes: appendFlattenNote(row.notes, nowIso),
        })
        .eq('id', row.id)
        .eq('user_id', row.user_id)
        .eq('status', 'open');
      if (patchError) {
        logger.warn('Tradier late-day flatten order succeeded but position patch failed', {
          positionId: row.id,
          userId: row.user_id,
          error: patchError.message,
        });
      }
      flattenedPositions += 1;
    } catch (error) {
      failedPositions += 1;
      logger.warn('Tradier late-day flatten failed for position', {
        positionId: row.id,
        userId: row.user_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    enabled: true,
    disabledReason: null,
    consideredPositions: openRows.length,
    flattenedPositions,
    failedPositions,
  };
}
