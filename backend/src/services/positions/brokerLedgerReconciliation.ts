import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import {
  parseTradierOccSymbol,
  type TradierOptionType,
} from '../broker/tradier/occFormatter';
import {
  TradierClient,
  type TradierBrokerPosition,
} from '../broker/tradier/client';
import {
  decryptTradierAccessToken,
  isTradierProductionRuntimeEnabled,
} from '../broker/tradier/credentials';

interface BrokerCredentialRow {
  user_id: string;
  broker_name: string;
  account_id: string;
  access_token_ciphertext: string;
  is_active: boolean;
}

interface OpenPositionRow {
  id: string;
  user_id: string;
  symbol: string;
  position_type: string;
  strike: number | string | null;
  expiry: string | null;
  quantity: number | string;
  entry_price: number | string;
  current_price: number | string | null;
  notes: string | null;
}

type ReconciliationAction =
  | {
    kind: 'force_close';
    positionId: string;
    userId: string;
    patch: Record<string, unknown>;
  }
  | {
    kind: 'quantity_sync';
    positionId: string;
    userId: string;
    patch: Record<string, unknown>;
  };

export interface BrokerLedgerReconciliationSummary {
  enabled: boolean;
  disabledReason: string | null;
  usersScanned: number;
  usersWithCredentials: number;
  usersWithBrokerErrors: number;
  openPositionsScanned: number;
  positionsForceClosed: number;
  positionsQuantitySynced: number;
}

const TRADIER_RECONCILIATION_ENABLED = String(
  process.env.TRADIER_POSITION_RECONCILIATION_ENABLED || 'false',
).toLowerCase() === 'true';
const DEFAULT_USER_LIMIT = 200;
const DEFAULT_POSITION_LIMIT = 1500;
const NOTES_MAX_CHARS = 1800;
const OPTION_MULTIPLIER = 100;

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function isMissingRelationError(message: string, table: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('relation') && normalized.includes('does not exist') && normalized.includes(table);
}

function normalizeUnderlyingSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'SPXW') return 'SPX';
  return normalized;
}

function strikeKey(value: number): string {
  return round(value, 3).toString();
}

function positionTypeToOptionCode(positionType: string): 'C' | 'P' | null {
  const normalized = positionType.trim().toLowerCase();
  if (normalized === 'call') return 'C';
  if (normalized === 'put') return 'P';
  return null;
}

function occOptionTypeToCode(optionType: TradierOptionType): 'C' | 'P' {
  return optionType === 'call' ? 'C' : 'P';
}

function toExpiryDate(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function buildInternalPositionKey(row: OpenPositionRow): string | null {
  const symbol = normalizeUnderlyingSymbol(row.symbol || '');
  const positionType = row.position_type.trim().toLowerCase();
  if (!symbol) return null;

  if (positionType === 'stock') {
    return `${symbol}|STOCK`;
  }

  const cp = positionTypeToOptionCode(positionType);
  const expiry = toExpiryDate(row.expiry);
  const strike = toFiniteNumber(row.strike);
  if (!cp || !expiry || strike == null) return null;

  return `${symbol}|${expiry}|${cp}|${strikeKey(strike)}`;
}

function buildBrokerPositionKey(position: TradierBrokerPosition): string | null {
  const symbol = position.symbol.trim().toUpperCase();
  if (!symbol) return null;

  try {
    const occ = parseTradierOccSymbol(symbol);
    const underlying = normalizeUnderlyingSymbol(occ.underlying);
    return `${underlying}|${occ.expiry}|${occOptionTypeToCode(occ.optionType)}|${strikeKey(occ.strike)}`;
  } catch {
    return `${normalizeUnderlyingSymbol(symbol)}|STOCK`;
  }
}

function buildBrokerPositionExposureMap(positions: TradierBrokerPosition[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const position of positions) {
    const key = buildBrokerPositionKey(position);
    if (!key) continue;
    const qty = Math.abs(position.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    map.set(key, (map.get(key) || 0) + qty);
  }
  return map;
}

function appendNote(existing: string | null, newLine: string): string {
  const lines = typeof existing === 'string' && existing.trim().length > 0
    ? existing.trim()
    : '';
  const merged = lines.length > 0 ? `${lines}\n${newLine}` : newLine;
  return merged.slice(-NOTES_MAX_CHARS);
}

function buildForceClosePatch(row: OpenPositionRow, nowIso: string): Record<string, unknown> {
  const closeDate = toEasternTime(new Date(nowIso)).dateStr;
  const quantity = toFiniteNumber(row.quantity) ?? 0;
  const quantityAbs = Math.max(1, Math.abs(quantity));
  const entryPrice = Math.max(0, toFiniteNumber(row.entry_price) ?? 0);
  const closePrice = Math.max(0, toFiniteNumber(row.current_price) ?? entryPrice);
  const multiplier = row.position_type.trim().toLowerCase() === 'stock' ? 1 : OPTION_MULTIPLIER;
  const costBasis = entryPrice * quantityAbs * multiplier;
  const currentValue = closePrice * quantityAbs * multiplier;
  const pnl = quantity >= 0 ? currentValue - costBasis : costBasis - currentValue;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  return {
    status: 'closed',
    close_date: closeDate,
    close_price: round(closePrice, 2),
    current_price: round(closePrice, 2),
    current_value: round(currentValue, 2),
    pnl: round(pnl, 2),
    pnl_pct: round(pnlPct, 2),
    notes: appendNote(
      row.notes,
      `[${new Date(nowIso).toISOString()}] Auto-closed by Tradier reconciliation (broker quantity = 0).`,
    ),
    updated_at: nowIso,
  };
}

function buildQuantitySyncPatch(
  row: OpenPositionRow,
  brokerQuantityAbs: number,
  nowIso: string,
): Record<string, unknown> {
  const internalQty = Math.max(0, Math.abs(toFiniteNumber(row.quantity) ?? 0));
  const nextQuantity = Math.max(1, Math.round(brokerQuantityAbs));
  return {
    quantity: nextQuantity,
    notes: appendNote(
      row.notes,
      `[${new Date(nowIso).toISOString()}] Quantity synced to Tradier (${internalQty} -> ${nextQuantity}).`,
    ),
    updated_at: nowIso,
  };
}

function computeReconciliationActions(
  positions: OpenPositionRow[],
  brokerExposureMap: Map<string, number>,
  nowIso: string,
): ReconciliationAction[] {
  const actions: ReconciliationAction[] = [];
  for (const position of positions) {
    const key = buildInternalPositionKey(position);
    if (!key) continue;

    const brokerQtyAbs = brokerExposureMap.get(key) || 0;
    const internalQtyAbs = Math.max(0, Math.abs(toFiniteNumber(position.quantity) ?? 0));
    if (internalQtyAbs <= 0) continue;

    if (brokerQtyAbs <= 0) {
      actions.push({
        kind: 'force_close',
        positionId: position.id,
        userId: position.user_id,
        patch: buildForceClosePatch(position, nowIso),
      });
      continue;
    }

    if (Math.round(brokerQtyAbs) !== Math.round(internalQtyAbs)) {
      actions.push({
        kind: 'quantity_sync',
        positionId: position.id,
        userId: position.user_id,
        patch: buildQuantitySyncPatch(position, brokerQtyAbs, nowIso),
      });
    }
  }
  return actions;
}

async function applyAction(action: ReconciliationAction): Promise<boolean> {
  const { error } = await supabase
    .from('ai_coach_positions')
    .update(action.patch)
    .eq('id', action.positionId)
    .eq('user_id', action.userId)
    .eq('status', 'open');

  if (error) {
    logger.warn('Tradier position reconciliation failed to apply position patch', {
      positionId: action.positionId,
      userId: action.userId,
      kind: action.kind,
      error: error.message,
    });
    return false;
  }

  return true;
}

export async function reconcileTradierBrokerLedger(input?: {
  userLimit?: number;
  positionLimit?: number;
}): Promise<BrokerLedgerReconciliationSummary> {
  const runtime = isTradierProductionRuntimeEnabled({
    baseEnabled: TRADIER_RECONCILIATION_ENABLED,
    productionEnableEnv: process.env.TRADIER_POSITION_RECONCILIATION_PRODUCTION_ENABLED,
  });
  if (!runtime.enabled) {
    return {
      enabled: false,
      disabledReason: runtime.reason,
      usersScanned: 0,
      usersWithCredentials: 0,
      usersWithBrokerErrors: 0,
      openPositionsScanned: 0,
      positionsForceClosed: 0,
      positionsQuantitySynced: 0,
    };
  }

  const userLimit = Math.max(1, Math.floor(input?.userLimit ?? DEFAULT_USER_LIMIT));
  const positionLimit = Math.max(1, Math.floor(input?.positionLimit ?? DEFAULT_POSITION_LIMIT));

  const { data: openRowsData, error: openRowsError } = await supabase
    .from('ai_coach_positions')
    .select('id,user_id,symbol,position_type,strike,expiry,quantity,entry_price,current_price,notes')
    .eq('status', 'open')
    .limit(positionLimit);

  if (openRowsError) {
    if (isMissingRelationError(openRowsError.message, 'ai_coach_positions')) {
      logger.warn('Tradier position reconciliation skipped because ai_coach_positions table is missing.');
      return {
        enabled: true,
        disabledReason: null,
        usersScanned: 0,
        usersWithCredentials: 0,
        usersWithBrokerErrors: 0,
        openPositionsScanned: 0,
        positionsForceClosed: 0,
        positionsQuantitySynced: 0,
      };
    }
    throw new Error(`Failed to load open positions for broker reconciliation: ${openRowsError.message}`);
  }

  const openRows = ((openRowsData || []) as OpenPositionRow[]).filter((row) => typeof row.user_id === 'string');
  if (openRows.length === 0) {
    return {
      enabled: true,
      disabledReason: null,
      usersScanned: 0,
      usersWithCredentials: 0,
      usersWithBrokerErrors: 0,
      openPositionsScanned: 0,
      positionsForceClosed: 0,
      positionsQuantitySynced: 0,
    };
  }

  const userIds = Array.from(new Set(openRows.map((row) => row.user_id))).slice(0, userLimit);
  const { data: credentialData, error: credentialError } = await supabase
    .from('broker_credentials')
    .select('user_id,broker_name,account_id,access_token_ciphertext,is_active')
    .in('user_id', userIds)
    .eq('broker_name', 'tradier')
    .eq('is_active', true);

  if (credentialError) {
    if (isMissingRelationError(credentialError.message, 'broker_credentials')) {
      logger.warn('Tradier position reconciliation skipped because broker_credentials table is missing.');
      return {
        enabled: true,
        disabledReason: null,
        usersScanned: userIds.length,
        usersWithCredentials: 0,
        usersWithBrokerErrors: 0,
        openPositionsScanned: openRows.length,
        positionsForceClosed: 0,
        positionsQuantitySynced: 0,
      };
    }
    throw new Error(`Failed to load active tradier credentials: ${credentialError.message}`);
  }

  const credentials = (credentialData || []) as BrokerCredentialRow[];
  const credentialByUserId = new Map<string, BrokerCredentialRow>();
  for (const credential of credentials) {
    if (!credential?.user_id) continue;
    credentialByUserId.set(credential.user_id, credential);
  }

  let positionsForceClosed = 0;
  let positionsQuantitySynced = 0;
  let usersWithBrokerErrors = 0;
  let usersWithCredentials = 0;

  for (const userId of userIds) {
    const credential = credentialByUserId.get(userId);
    if (!credential) continue;
    usersWithCredentials += 1;

    const userPositions = openRows.filter((row) => row.user_id === userId);
    if (userPositions.length === 0) continue;

    try {
      const tradier = new TradierClient({
        accountId: credential.account_id,
        accessToken: decryptTradierAccessToken(credential.access_token_ciphertext),
      });
      const brokerPositions = await tradier.getPositions();
      const exposureMap = buildBrokerPositionExposureMap(brokerPositions);
      const nowIso = new Date().toISOString();
      const actions = computeReconciliationActions(userPositions, exposureMap, nowIso);

      for (const action of actions) {
        const applied = await applyAction(action);
        if (!applied) continue;
        if (action.kind === 'force_close') {
          positionsForceClosed += 1;
        } else {
          positionsQuantitySynced += 1;
        }
      }
    } catch (error) {
      usersWithBrokerErrors += 1;
      logger.warn('Tradier position reconciliation failed for user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    enabled: true,
    disabledReason: null,
    usersScanned: userIds.length,
    usersWithCredentials,
    usersWithBrokerErrors,
    openPositionsScanned: openRows.length,
    positionsForceClosed,
    positionsQuantitySynced,
  };
}

export const __brokerLedgerReconciliationTestUtils = {
  buildInternalPositionKey,
  buildBrokerPositionKey,
  buildBrokerPositionExposureMap,
  computeReconciliationActions,
  buildForceClosePatch,
  buildQuantitySyncPatch,
};
