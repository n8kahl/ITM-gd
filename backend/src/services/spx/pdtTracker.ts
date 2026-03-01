import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import { publishCoachMessage } from '../coachPushChannel';

const PDT_TRACKING_ENABLED = String(process.env.SPX_PDT_TRACKING_ENABLED || 'false').toLowerCase() === 'true';
const PDT_ROUND_TRIP_LIMIT = 3;
const PDT_EQUITY_THRESHOLD = 25_000;

interface PDTStatus {
  allowed: boolean;
  roundTripsToday: number;
  limit: number;
  totalEquity: number;
  equityThreshold: number;
  reason: string | null;
}

async function fetchLatestPortfolioEquity(userId: string): Promise<number> {
  const { data: snapshot, error } = await supabase
    .from('portfolio_snapshots')
    .select('total_equity')
    .eq('user_id', userId)
    .order('snapshot_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn('PDT tracker: failed to fetch latest equity snapshot', { userId, error: error.message });
    return 0;
  }

  const maybeSnapshot = snapshot as Record<string, unknown> | null;
  return typeof maybeSnapshot?.total_equity === 'number' ? maybeSnapshot.total_equity as number : 0;
}

/**
 * Check if a user can place a new entry trade today (PDT gate).
 * Returns true if the trade is allowed, false if blocked by PDT rules.
 */
export async function canTrade(userId: string): Promise<PDTStatus> {
  if (!PDT_TRACKING_ENABLED) {
    return {
      allowed: true,
      roundTripsToday: 0,
      limit: PDT_ROUND_TRIP_LIMIT,
      totalEquity: 0,
      equityThreshold: PDT_EQUITY_THRESHOLD,
      reason: null,
    };
  }

  const sessionDate = toEasternTime(new Date()).dateStr;

  // Count today's entry fills
  const { data: entryFills, error: fillError } = await supabase
    .from('spx_setup_execution_fills')
    .select('id')
    .eq('reported_by_user_id', userId)
    .eq('side', 'entry')
    .gte('executed_at', `${sessionDate}T00:00:00Z`)
    .lt('executed_at', `${sessionDate}T23:59:59Z`);

  if (fillError) {
    logger.error('PDT tracker: failed to count fills', { userId, error: fillError.message });

    const totalEquity = await fetchLatestPortfolioEquity(userId);
    if (totalEquity >= PDT_EQUITY_THRESHOLD) {
      return {
        allowed: true,
        roundTripsToday: 0,
        limit: PDT_ROUND_TRIP_LIMIT,
        totalEquity,
        equityThreshold: PDT_EQUITY_THRESHOLD,
        reason: null,
      };
    }

    return {
      allowed: false,
      roundTripsToday: PDT_ROUND_TRIP_LIMIT,
      limit: PDT_ROUND_TRIP_LIMIT,
      totalEquity,
      equityThreshold: PDT_EQUITY_THRESHOLD,
      reason: 'PDT protection: unable to validate today\'s round-trip count; blocking entry until tracking data is available.',
    };
  }

  const roundTripsToday = entryFills?.length ?? 0;

  if (roundTripsToday < PDT_ROUND_TRIP_LIMIT) {
    return {
      allowed: true,
      roundTripsToday,
      limit: PDT_ROUND_TRIP_LIMIT,
      totalEquity: 0,
      equityThreshold: PDT_EQUITY_THRESHOLD,
      reason: null,
    };
  }

  // At or above limit - check equity
  const totalEquity = await fetchLatestPortfolioEquity(userId);

  if (totalEquity >= PDT_EQUITY_THRESHOLD) {
    // Above PDT threshold - unlimited day trades
    return {
      allowed: true,
      roundTripsToday,
      limit: PDT_ROUND_TRIP_LIMIT,
      totalEquity,
      equityThreshold: PDT_EQUITY_THRESHOLD,
      reason: null,
    };
  }

  // Blocked by PDT
  const reason = `PDT limit reached: ${roundTripsToday}/${PDT_ROUND_TRIP_LIMIT} round-trips today with equity $${totalEquity.toLocaleString()} (threshold: $${PDT_EQUITY_THRESHOLD.toLocaleString()})`;

  return {
    allowed: false,
    roundTripsToday,
    limit: PDT_ROUND_TRIP_LIMIT,
    totalEquity,
    equityThreshold: PDT_EQUITY_THRESHOLD,
    reason,
  };
}

/**
 * Publish a PDT block coach message.
 */
export function publishPDTBlockMessage(userId: string, status: PDTStatus): void {
  publishCoachMessage({
    userId,
    generatedAt: new Date().toISOString(),
    source: 'broker_execution',
    message: {
      id: `pdt_block_${userId}_${Date.now()}`,
      type: 'alert',
      priority: 'alert',
      setupId: null,
      timestamp: new Date().toISOString(),
      content: `PDT Protection: Trade blocked. You have ${status.roundTripsToday} of ${status.limit} allowed round-trips today. Account equity ($${status.totalEquity.toLocaleString()}) is below the $${status.equityThreshold.toLocaleString()} PDT threshold.`,
      structuredData: {
        source: 'pdt_tracker',
        roundTripsToday: status.roundTripsToday,
        limit: status.limit,
        totalEquity: status.totalEquity,
        equityThreshold: status.equityThreshold,
      },
    },
  });
}

export function getPDTTrackingStatus(): { enabled: boolean; limit: number; equityThreshold: number } {
  return {
    enabled: PDT_TRACKING_ENABLED,
    limit: PDT_ROUND_TRIP_LIMIT,
    equityThreshold: PDT_EQUITY_THRESHOLD,
  };
}
