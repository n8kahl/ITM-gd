import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { toEasternTime } from '../services/marketHours';
import { publishCoachMessage } from '../services/coachPushChannel';
import { loadOpenStates, closeExecutionState } from '../services/spx/executionStateStore';
import { TradierClient } from '../services/broker/tradier/client';
import { decryptTradierAccessToken } from '../services/broker/tradier/credentials';
import { buildTradierMarketExitOrder } from '../services/broker/tradier/orderRouter';
import { recordExecutionFill } from '../services/spx/executionReconciliation';

const AUTO_FLATTEN_ENABLED = String(process.env.SPX_AUTO_FLATTEN_ENABLED || 'false').toLowerCase() === 'true';
const FLATTEN_MINUTE_ET = (() => {
  const parsed = Number.parseInt(process.env.SPX_AUTO_FLATTEN_MINUTE_ET || '955', 10);
  return Number.isFinite(parsed) ? parsed : 955; // 3:55 PM ET = 15*60+55 = 955
})();
const SAFETY_NET_MINUTE_ET = FLATTEN_MINUTE_ET + 4; // 3:59 PM ET
const EXECUTION_SANDBOX_DEFAULT = String(process.env.TRADIER_EXECUTION_SANDBOX || 'true').toLowerCase() !== 'false';

let flattenIntervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Check if it's time to auto-flatten. Runs every 30 seconds.
 */
async function checkAutoFlatten(): Promise<void> {
  if (!AUTO_FLATTEN_ENABLED) return;

  const now = toEasternTime(new Date());
  const currentMinuteET = now.hour * 60 + now.minute;

  if (currentMinuteET === FLATTEN_MINUTE_ET || currentMinuteET === SAFETY_NET_MINUTE_ET) {
    const isSafetyNet = currentMinuteET === SAFETY_NET_MINUTE_ET;
    await runAutoFlatten(isSafetyNet);
  }
}

/**
 * Flatten all open SPX positions by placing market exit orders.
 */
async function runAutoFlatten(isSafetyNet: boolean): Promise<void> {
  const label = isSafetyNet ? 'safety_net' : 'scheduled';
  logger.info(`Auto-flatten ${label}: checking for open positions`);

  try {
    const openStates = await loadOpenStates();
    if (openStates.length === 0) {
      logger.info(`Auto-flatten ${label}: no open positions found`);
      return;
    }

    logger.info(`Auto-flatten ${label}: found ${openStates.length} open position(s) to flatten`);

    for (const state of openStates) {
      if (state.remainingQuantity <= 0) {
        await closeExecutionState(state.userId, state.setupId, state.sessionDate, 'auto_flatten').catch(() => undefined);
        continue;
      }

      try {
        const { data: credentialRow } = await supabase
          .from('broker_credentials')
          .select('account_id,access_token_ciphertext,metadata')
          .eq('user_id', state.userId)
          .eq('broker_name', 'tradier')
          .eq('is_active', true)
          .maybeSingle();

        if (!credentialRow) {
          logger.warn('Auto-flatten: no active credentials for user', { userId: state.userId });
          continue;
        }

        const row = credentialRow as {
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

        // Cancel any existing runner stop first
        if (state.runnerStopOrderId) {
          await tradier.cancelOrder(state.runnerStopOrderId).catch(() => false);
        }

        // Place market exit order
        const exitOrder = await tradier.placeOrder(buildTradierMarketExitOrder({
          symbol: state.symbol,
          quantity: state.remainingQuantity,
          tag: `spx:${state.setupId}:${state.sessionDate}:auto_flatten`,
        }));

        await closeExecutionState(state.userId, state.setupId, state.sessionDate, 'auto_flatten');

        await recordExecutionFill({
          setupId: state.setupId,
          side: 'exit',
          phase: 'invalidated',
          source: 'broker_tradier',
          fillPrice: 0,
          executedAt: new Date().toISOString(),
          brokerOrderId: exitOrder.id,
          userId: state.userId,
        }).catch(() => undefined);

        publishCoachMessage({
          userId: state.userId,
          generatedAt: new Date().toISOString(),
          source: 'broker_execution',
          message: {
            id: `auto_flatten_${state.userId}_${state.setupId}_${Date.now()}`,
            type: 'alert',
            priority: 'alert',
            setupId: state.setupId,
            timestamp: new Date().toISOString(),
            content: `0DTE Auto-Flatten: Position ${state.symbol} (${state.remainingQuantity} contract${state.remainingQuantity > 1 ? 's' : ''}) market exited at 3:55 PM ET.`,
            structuredData: {
              source: 'auto_flatten',
              orderId: exitOrder.id,
              symbol: state.symbol,
              quantity: state.remainingQuantity,
              safetyNet: isSafetyNet,
            },
          },
        });

        logger.info('Auto-flatten: position exited', {
          userId: state.userId,
          setupId: state.setupId,
          symbol: state.symbol,
          quantity: state.remainingQuantity,
          safetyNet: isSafetyNet,
        });
      } catch (error) {
        logger.error('Auto-flatten: failed to exit position', {
          userId: state.userId,
          setupId: state.setupId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error('Auto-flatten job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Start the auto-flatten polling loop.
 */
export function startAutoFlattenJob(): void {
  if (flattenIntervalHandle) return;
  if (!AUTO_FLATTEN_ENABLED) {
    logger.info('Auto-flatten job disabled (SPX_AUTO_FLATTEN_ENABLED=false)');
    return;
  }

  flattenIntervalHandle = setInterval(checkAutoFlatten, 30_000);
  logger.info('Auto-flatten job started', { flattenMinuteET: FLATTEN_MINUTE_ET });
}

/**
 * Stop the auto-flatten polling loop.
 */
export function stopAutoFlattenJob(): void {
  if (flattenIntervalHandle) {
    clearInterval(flattenIntervalHandle);
    flattenIntervalHandle = null;
  }
}

export function getAutoFlattenStatus(): {
  enabled: boolean;
  flattenMinuteET: number;
  safetyNetMinuteET: number;
  running: boolean;
} {
  return {
    enabled: AUTO_FLATTEN_ENABLED,
    flattenMinuteET: FLATTEN_MINUTE_ET,
    safetyNetMinuteET: SAFETY_NET_MINUTE_ET,
    running: flattenIntervalHandle !== null,
  };
}
