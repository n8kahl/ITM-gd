import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import {
  analyzePosition,
  getUserPositions,
} from '../options/positionAnalyzer';
import { PositionAnalysis } from '../options/types';

export interface LivePositionSnapshot {
  id: string;
  symbol: string;
  type: PositionAnalysis['position']['type'];
  strike?: number;
  expiry?: string;
  quantity: number;
  entryPrice: number;
  entryDate: string;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  pnl: number;
  pnlPct: number;
  daysHeld: number;
  daysToExpiry?: number;
  breakeven?: number;
  maxGain?: number | string;
  maxLoss?: number | string;
  riskRewardRatio?: number;
  greeks?: PositionAnalysis['greeks'];
  updatedAt: string;
}

function inferCurrentPrice(analysis: PositionAnalysis): number {
  const multiplier = analysis.position.type === 'stock' ? 1 : 100;
  const quantity = Math.max(1, Math.abs(analysis.position.quantity));
  return Number((analysis.currentValue / (quantity * multiplier)).toFixed(4));
}

function toSnapshot(analysis: PositionAnalysis, updatedAt: string): LivePositionSnapshot {
  return {
    id: analysis.position.id || `${analysis.position.symbol}-${analysis.position.type}-${analysis.position.entryDate}`,
    symbol: analysis.position.symbol,
    type: analysis.position.type,
    strike: analysis.position.strike,
    expiry: analysis.position.expiry,
    quantity: analysis.position.quantity,
    entryPrice: analysis.position.entryPrice,
    entryDate: analysis.position.entryDate,
    currentPrice: inferCurrentPrice(analysis),
    currentValue: Number(analysis.currentValue.toFixed(2)),
    costBasis: Number(analysis.costBasis.toFixed(2)),
    pnl: Number(analysis.pnl.toFixed(2)),
    pnlPct: Number(analysis.pnlPct.toFixed(2)),
    daysHeld: analysis.daysHeld,
    daysToExpiry: analysis.daysToExpiry,
    breakeven: analysis.breakeven,
    maxGain: analysis.maxGain,
    maxLoss: analysis.maxLoss,
    riskRewardRatio: analysis.riskRewardRatio,
    greeks: analysis.greeks,
    updatedAt,
  };
}

async function persistSnapshot(userId: string, snapshot: LivePositionSnapshot): Promise<void> {
  const { error } = await supabase
    .from('ai_coach_positions')
    .update({
      current_price: Number(snapshot.currentPrice.toFixed(2)),
      current_value: snapshot.currentValue,
      pnl: snapshot.pnl,
      pnl_pct: snapshot.pnlPct,
      greeks: snapshot.greeks || null,
      updated_at: snapshot.updatedAt,
    })
    .eq('id', snapshot.id)
    .eq('user_id', userId)
    .eq('status', 'open');

  if (error) {
    logger.warn('Live tracker: failed to persist position snapshot', {
      userId,
      positionId: snapshot.id,
      error: error.message,
      code: (error as { code?: string }).code,
    });
  }
}

export class LivePositionTracker {
  async recalculateForUser(userId: string): Promise<LivePositionSnapshot[]> {
    const positions = await getUserPositions(userId);
    if (positions.length === 0) return [];

    const analyses = await Promise.all(positions.map((position) => analyzePosition(position)));
    const updatedAt = new Date().toISOString();
    const snapshots = analyses.map((analysis) => toSnapshot(analysis, updatedAt));

    await Promise.all(snapshots.map((snapshot) => persistSnapshot(userId, snapshot)));

    return snapshots;
  }

  async recalculateAllOpenPositions(limit: number = 500): Promise<Map<string, LivePositionSnapshot[]>> {
    const { data, error } = await supabase
      .from('ai_coach_positions')
      .select('user_id')
      .eq('status', 'open')
      .limit(limit);

    if (error) {
      logger.error('Live tracker: failed to fetch open-position users', {
        error: error.message,
        code: (error as { code?: string }).code,
      });
      return new Map();
    }

    const userIds = Array.from(new Set((data || []).map((row: { user_id: string }) => row.user_id).filter(Boolean)));
    const userSnapshots = new Map<string, LivePositionSnapshot[]>();

    await Promise.all(
      userIds.map(async (userId) => {
        const snapshots = await this.recalculateForUser(userId);
        if (snapshots.length > 0) {
          userSnapshots.set(userId, snapshots);
        }
      }),
    );

    return userSnapshots;
  }
}
