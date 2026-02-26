import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';

export interface ExecutionActiveState {
  id: string;
  userId: string;
  setupId: string;
  sessionDate: string;
  symbol: string;
  quantity: number;
  remainingQuantity: number;
  entryOrderId: string;
  runnerStopOrderId: string | null;
  entryLimitPrice: number;
  actualFillQty: number | null;
  avgFillPrice: number | null;
  status: 'active' | 'partial_fill' | 'filled' | 'failed' | 'closed';
  closeReason: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionStateRow {
  id: string;
  user_id: string;
  setup_id: string;
  session_date: string;
  symbol: string;
  quantity: number;
  remaining_quantity: number;
  entry_order_id: string;
  runner_stop_order_id: string | null;
  entry_limit_price: number | string;
  actual_fill_qty: number | null;
  avg_fill_price: number | string | null;
  status: string;
  close_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function rowToState(row: ExecutionStateRow): ExecutionActiveState {
  return {
    id: row.id,
    userId: row.user_id,
    setupId: row.setup_id,
    sessionDate: row.session_date,
    symbol: row.symbol,
    quantity: row.quantity,
    remainingQuantity: row.remaining_quantity,
    entryOrderId: row.entry_order_id,
    runnerStopOrderId: row.runner_stop_order_id,
    entryLimitPrice: toFiniteNumber(row.entry_limit_price),
    actualFillQty: row.actual_fill_qty,
    avgFillPrice: row.avg_fill_price != null ? toFiniteNumber(row.avg_fill_price) : null,
    status: row.status as ExecutionActiveState['status'],
    closeReason: row.close_reason,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert an execution state. Returns true if inserted, false if it already existed (duplicate prevention).
 */
export async function upsertExecutionState(input: {
  userId: string;
  setupId: string;
  sessionDate: string;
  symbol: string;
  quantity: number;
  remainingQuantity: number;
  entryOrderId: string;
  runnerStopOrderId?: string | null;
  entryLimitPrice: number;
}): Promise<{ inserted: boolean; state: ExecutionActiveState | null }> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .upsert(
      {
        user_id: input.userId,
        setup_id: input.setupId,
        session_date: input.sessionDate,
        symbol: input.symbol,
        quantity: input.quantity,
        remaining_quantity: input.remainingQuantity,
        entry_order_id: input.entryOrderId,
        runner_stop_order_id: input.runnerStopOrderId ?? null,
        entry_limit_price: input.entryLimitPrice,
        status: 'active',
        updated_at: now,
      },
      { onConflict: 'user_id,setup_id,session_date', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  if (error) {
    // If duplicate detected via constraint violation, return not inserted
    if (error.code === '23505') {
      return { inserted: false, state: null };
    }
    logger.error('Failed to upsert execution state', {
      userId: input.userId,
      setupId: input.setupId,
      error: error.message,
    });
    throw new Error(`Execution state upsert failed: ${error.message}`);
  }

  if (!data) {
    // ignoreDuplicates returns no data when skipped
    return { inserted: false, state: null };
  }

  return { inserted: true, state: rowToState(data as ExecutionStateRow) };
}

/**
 * Update fields on an existing execution state.
 */
export async function updateExecutionState(
  userId: string,
  setupId: string,
  sessionDate: string,
  updates: {
    remainingQuantity?: number;
    runnerStopOrderId?: string | null;
    actualFillQty?: number;
    avgFillPrice?: number;
    status?: ExecutionActiveState['status'];
  },
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.remainingQuantity !== undefined) payload.remaining_quantity = updates.remainingQuantity;
  if (updates.runnerStopOrderId !== undefined) payload.runner_stop_order_id = updates.runnerStopOrderId;
  if (updates.actualFillQty !== undefined) payload.actual_fill_qty = updates.actualFillQty;
  if (updates.avgFillPrice !== undefined) payload.avg_fill_price = updates.avgFillPrice;
  if (updates.status !== undefined) payload.status = updates.status;

  const { error } = await supabase
    .from('spx_execution_active_states')
    .update(payload)
    .eq('user_id', userId)
    .eq('setup_id', setupId)
    .eq('session_date', sessionDate);

  if (error) {
    logger.error('Failed to update execution state', { userId, setupId, error: error.message });
    throw new Error(`Execution state update failed: ${error.message}`);
  }
}

/**
 * Close an execution state with a reason.
 */
export async function closeExecutionState(
  userId: string,
  setupId: string,
  sessionDate: string,
  closeReason: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('spx_execution_active_states')
    .update({
      status: 'closed',
      close_reason: closeReason,
      closed_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('setup_id', setupId)
    .eq('session_date', sessionDate);

  if (error) {
    logger.error('Failed to close execution state', { userId, setupId, closeReason, error: error.message });
    throw new Error(`Execution state close failed: ${error.message}`);
  }
}

/**
 * Close all open states for a given user.
 */
export async function closeAllUserStates(
  userId: string,
  closeReason: string,
): Promise<number> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .update({
      status: 'closed',
      close_reason: closeReason,
      closed_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .is('closed_at', null)
    .select('id');

  if (error) {
    logger.error('Failed to close all user states', { userId, closeReason, error: error.message });
    throw new Error(`Close all user states failed: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Load all open (not closed) execution states. Used for startup rehydration.
 */
export async function loadOpenStates(): Promise<ExecutionActiveState[]> {
  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .select('*')
    .is('closed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('relation') && normalized.includes('does not exist')) {
      logger.warn('spx_execution_active_states table not found; skipping rehydration.');
      return [];
    }
    logger.error('Failed to load open execution states', { error: error.message });
    throw new Error(`Load open states failed: ${error.message}`);
  }

  return (data || []).map((row: Record<string, unknown>) => rowToState(row as unknown as ExecutionStateRow));
}

/**
 * Load open states for a specific user.
 */
export async function loadUserOpenStates(userId: string): Promise<ExecutionActiveState[]> {
  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .select('*')
    .eq('user_id', userId)
    .is('closed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to load user open states', { userId, error: error.message });
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => rowToState(row as unknown as ExecutionStateRow));
}

/**
 * Load all open states that have active order IDs (for kill switch cancellation).
 */
export async function loadOpenStatesWithOrders(userId: string): Promise<ExecutionActiveState[]> {
  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .select('*')
    .eq('user_id', userId)
    .is('closed_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to load open states with orders', { userId, error: error.message });
    return [];
  }

  return (data || [])
    .map((row: Record<string, unknown>) => rowToState(row as unknown as ExecutionStateRow))
    .filter((state: ExecutionActiveState) => state.entryOrderId || state.runnerStopOrderId);
}

/**
 * Returns the set of setup IDs with active (non-closed) execution states.
 * Used by the optimizer to isolate in-flight trades from profile changes.
 */
export async function getInFlightSetupIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('spx_execution_active_states')
    .select('setup_id')
    .is('closed_at', null)
    .in('status', ['active', 'partial_fill', 'filled']);

  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('relation') && normalized.includes('does not exist')) {
      return new Set();
    }
    logger.error('Failed to load in-flight setup IDs', { error: error.message });
    return new Set();
  }

  return new Set((data || []).map((row: { setup_id: string }) => row.setup_id));
}

/**
 * Mark an execution state as failed (e.g., order rejected).
 */
export async function markStateFailed(
  userId: string,
  setupId: string,
  sessionDate: string,
  closeReason: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('spx_execution_active_states')
    .update({
      status: 'failed',
      close_reason: closeReason,
      closed_at: now,
      updated_at: now,
    })
    .eq('user_id', userId)
    .eq('setup_id', setupId)
    .eq('session_date', sessionDate);

  if (error) {
    logger.error('Failed to mark state as failed', { userId, setupId, error: error.message });
  }
}
