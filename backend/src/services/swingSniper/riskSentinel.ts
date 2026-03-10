import { logger } from '../../lib/logger';
import { analyzePosition, analyzePortfolio, getUserPositions } from '../options/positionAnalyzer';
import { analyzeIVProfile } from '../options/ivAnalysis';
import { ExitAdvisor } from '../positions/exitAdvisor';
import { getSwingSniperWatchlistState } from './persistence';
import type {
  SwingSniperEdgeState,
  SwingSniperExitBias,
  SwingSniperMonitoringAlert,
  SwingSniperMonitoringPositionAdvice,
  SwingSniperMonitoringResponse,
  SwingSniperMonitoringSnapshot,
  SwingSniperMonitoringStatus,
  SwingSniperPortfolioExposureSummary,
  SwingSniperSavedThesisMonitoringSnapshot,
  SwingSniperSavedThesisRecord,
} from './types';
import { buildEdgeState, clamp, round } from './utils';

const RISK_SENTINEL_REFRESH_INTERVAL_MINUTES = 4;

function toMonitoringStatus(edgeState: SwingSniperEdgeState, healthScore: number): SwingSniperMonitoringStatus {
  if (edgeState === 'invalidated' || healthScore <= 30) return 'invalidated';
  if (edgeState === 'narrowing' || healthScore <= 55) return 'degrading';
  if (healthScore >= 70) return 'active';
  return 'forming';
}

function toExitBias(status: SwingSniperMonitoringStatus, healthScore: number): SwingSniperExitBias {
  if (status === 'invalidated') return 'close';
  if (status === 'degrading' && healthScore <= 45) return 'trim';
  if (status === 'degrading') return 'roll';
  if (status === 'active' && healthScore >= 88) return 'take_profit';
  return 'hold';
}

function computeHealthScore(input: {
  direction: SwingSniperSavedThesisRecord['direction'];
  ivRankAtSave: number | null;
  ivRankNow: number | null;
  edgeState: SwingSniperEdgeState;
}): number {
  const baseline = 68;
  if (input.ivRankAtSave == null || input.ivRankNow == null) {
    return input.edgeState === 'invalidated' ? 28 : baseline;
  }

  const drift = input.ivRankNow - input.ivRankAtSave;
  let directionalDriftScore = 0;

  if (input.direction === 'long_vol') {
    directionalDriftScore = clamp(-drift * 1.7, -36, 30);
  } else if (input.direction === 'short_vol') {
    directionalDriftScore = clamp(drift * 1.7, -36, 30);
  } else {
    directionalDriftScore = clamp(-Math.abs(drift) * 1.2, -28, 10);
  }

  const edgeAdjustment = (
    input.edgeState === 'improving' ? 15
    : input.edgeState === 'stable' ? 6
    : input.edgeState === 'narrowing' ? -18
    : -34
  );

  return round(clamp(baseline + directionalDriftScore + edgeAdjustment, 1, 99), 1);
}

function buildPrimaryRisk(input: {
  direction: SwingSniperSavedThesisRecord['direction'];
  edgeState: SwingSniperEdgeState;
  ivRankAtSave: number | null;
  ivRankNow: number | null;
}): string | null {
  if (input.edgeState === 'invalidated') {
    return 'Current volatility state is no longer aligned with the original thesis conditions.';
  }

  if (input.ivRankAtSave == null || input.ivRankNow == null) {
    return 'Current IV rank could not be refreshed, so drift risk is partially unknown.';
  }

  const drift = round(input.ivRankNow - input.ivRankAtSave, 1);

  if (input.direction === 'long_vol' && drift >= 8) {
    return `IV rank drifted +${drift}, which compresses the original long-vol edge.`;
  }

  if (input.direction === 'short_vol' && drift <= -8) {
    return `IV rank drifted ${drift}, increasing stress on the short-vol thesis.`;
  }

  if (Math.abs(drift) >= 8) {
    return `IV rank moved ${drift >= 0 ? '+' : ''}${drift}, and the setup now needs tighter monitoring.`;
  }

  return null;
}

function buildMonitoringNote(status: SwingSniperMonitoringStatus, exitBias: SwingSniperExitBias): string {
  if (status === 'invalidated') {
    return 'Edge is invalidated against save-time conditions. Prioritize de-risking over new exposure.';
  }
  if (status === 'degrading') {
    return exitBias === 'roll'
      ? 'Thesis is degrading. Consider rolling structure/timing before edge quality drops further.'
      : 'Thesis is degrading. Consider trimming size until conditions stabilize.';
  }
  if (status === 'active') {
    return exitBias === 'take_profit'
      ? 'Thesis remains active with strong health. Partial profit-taking can reduce giveback risk.'
      : 'Thesis remains active and within expected volatility drift.';
  }
  return 'Thesis is still forming. Keep sizing controlled until edge quality improves.';
}

function buildThesisMonitoringSnapshot(input: {
  thesis: SwingSniperSavedThesisRecord;
  ivRankNow: number | null;
  currentPrice: number | null;
}): SwingSniperSavedThesisMonitoringSnapshot {
  const edgeState = buildEdgeState(input.thesis.direction, input.thesis.ivRankAtSave, input.ivRankNow);
  const healthScore = computeHealthScore({
    direction: input.thesis.direction,
    ivRankAtSave: input.thesis.ivRankAtSave,
    ivRankNow: input.ivRankNow,
    edgeState,
  });
  const status = toMonitoringStatus(edgeState, healthScore);
  const exitBias = toExitBias(status, healthScore);
  const primaryRisk = buildPrimaryRisk({
    direction: input.thesis.direction,
    edgeState,
    ivRankAtSave: input.thesis.ivRankAtSave,
    ivRankNow: input.ivRankNow,
  });

  const monitoring: SwingSniperMonitoringSnapshot = {
    status,
    healthScore,
    primaryRisk,
    exitBias,
    note: buildMonitoringNote(status, exitBias),
  };

  return {
    symbol: input.thesis.symbol,
    savedAt: input.thesis.savedAt,
    score: input.thesis.score,
    setupLabel: input.thesis.setupLabel,
    direction: input.thesis.direction,
    thesis: input.thesis.thesis,
    ivRankAtSave: input.thesis.ivRankAtSave,
    ivRankNow: input.ivRankNow,
    edgeState,
    monitorNote: input.thesis.monitorNote,
    monitoring,
    currentPrice: input.currentPrice,
  };
}

function adviceSeverityFromUrgency(urgency: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  return urgency;
}

function summarizeAction(action: Record<string, unknown>): string {
  const kind = typeof action.action === 'string' ? action.action : 'review';
  const closePct = typeof action.closePct === 'number' ? `${action.closePct}%` : null;
  if (closePct) return `${kind} (${closePct})`;
  return kind;
}

function buildPortfolioExposureSummaryFromEmpty(): SwingSniperPortfolioExposureSummary {
  return {
    openPositions: 0,
    totalPnl: 0,
    totalPnlPct: 0,
    riskLevel: 'low',
    warnings: ['No open positions found.'],
    netGreeks: {
      delta: 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    },
    symbolExposure: [],
  };
}

function mergeAlerts(
  thesisSnapshots: SwingSniperSavedThesisMonitoringSnapshot[],
  positionAdvice: SwingSniperMonitoringPositionAdvice[],
): SwingSniperMonitoringAlert[] {
  const thesisAlerts: SwingSniperMonitoringAlert[] = thesisSnapshots
    .filter((snapshot) => snapshot.monitoring.status === 'invalidated' || snapshot.monitoring.status === 'degrading')
    .map((snapshot) => ({
      id: `thesis-${snapshot.symbol}`,
      source: 'thesis',
      symbol: snapshot.symbol,
      severity: snapshot.monitoring.status === 'invalidated' ? 'high' : 'medium',
      title: `${snapshot.symbol} thesis ${snapshot.monitoring.status}`,
      message: snapshot.monitoring.note,
      suggestedAction: snapshot.monitoring.exitBias,
    }));

  const positionAlerts: SwingSniperMonitoringAlert[] = positionAdvice.map((advice) => ({
    id: `position-${advice.positionId}`,
    source: 'position',
    symbol: advice.symbol,
    severity: advice.severity,
    title: `${advice.symbol} ${advice.type.replace('_', ' ')}`,
    message: advice.message,
    suggestedAction: advice.suggestedAction,
  }));

  return [...thesisAlerts, ...positionAlerts]
    .sort((left, right) => {
      const severityRank = { high: 0, medium: 1, low: 2 } as const;
      return severityRank[left.severity] - severityRank[right.severity];
    })
    .slice(0, 12);
}

export async function buildSwingSniperRiskSentinel(userId: string): Promise<SwingSniperMonitoringResponse> {
  const [watchlistState, positions] = await Promise.all([
    getSwingSniperWatchlistState(userId),
    getUserPositions(userId),
  ]);

  const savedTheses = watchlistState.savedTheses.slice(0, 12);

  const savedThesisSnapshots = await Promise.all(
    savedTheses.map(async (thesis) => {
      let ivRankNow: number | null = null;
      let currentPrice: number | null = null;

      try {
        const ivProfile = await analyzeIVProfile(thesis.symbol, {
          strikeRange: 12,
          maxExpirations: 3,
        });
        ivRankNow = ivProfile.ivRank.ivRank;
        currentPrice = ivProfile.currentPrice;
      } catch (error) {
        logger.warn('Risk Sentinel IV refresh failed', {
          userId,
          symbol: thesis.symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return buildThesisMonitoringSnapshot({
        thesis,
        ivRankNow,
        currentPrice,
      });
    }),
  );

  const notes: string[] = [
    'Risk Sentinel compares save-time IV state against current IV rank drift to score thesis health.',
    'Exit guidance is advisory only and does not trigger broker-side automation.',
  ];

  if (positions.length === 0) {
    const alerts = mergeAlerts(savedThesisSnapshots, []);
    const generatedAt = new Date().toISOString();
    const nextEvaluationAt = new Date(Date.now() + (RISK_SENTINEL_REFRESH_INTERVAL_MINUTES * 60 * 1000)).toISOString();
    return {
      generatedAt,
      cadence: {
        mode: 'on_demand_cached',
        refreshIntervalMinutes: RISK_SENTINEL_REFRESH_INTERVAL_MINUTES,
        nextEvaluationAt,
      },
      savedTheses: savedThesisSnapshots,
      portfolio: buildPortfolioExposureSummaryFromEmpty(),
      positionAdvice: [],
      alerts,
      notes,
    };
  }

  let analyses: Awaited<ReturnType<typeof analyzePosition>>[] = [];
  let portfolioAnalysis: Awaited<ReturnType<typeof analyzePortfolio>> | null = null;
  let advice: ReturnType<ExitAdvisor['generateAdvice']> = [];

  try {
    analyses = await Promise.all(positions.map((position) => analyzePosition(position)));
    portfolioAnalysis = await analyzePortfolio(positions);
    const advisor = new ExitAdvisor();
    advice = advisor.generateAdvice(analyses);
  } catch (error) {
    logger.warn('Risk Sentinel portfolio analytics degraded', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    notes.push('Portfolio analytics degraded for this refresh; thesis-level monitoring remains available.');
  }

  const positionAdvice: SwingSniperMonitoringPositionAdvice[] = advice.slice(0, 12).map((item) => {
    const matching = analyses.find((analysis) => {
      const id = analysis.position.id || `${analysis.position.symbol}-${analysis.position.type}-${analysis.position.entryDate}`;
      return id === item.positionId;
    });

    return {
      positionId: item.positionId,
      symbol: matching?.position.symbol ?? 'Unknown',
      severity: adviceSeverityFromUrgency(item.urgency),
      type: item.type,
      message: item.message,
      suggestedAction: summarizeAction(item.suggestedAction),
    };
  });

  const symbolExposureMap = new Map<string, {
    symbol: string;
    positionCount: number;
    pnl: number;
    costBasis: number;
    netDelta: number;
    netTheta: number;
  }>();

  for (const analysis of analyses) {
    const symbol = analysis.position.symbol.toUpperCase();
    const existing = symbolExposureMap.get(symbol) || {
      symbol,
      positionCount: 0,
      pnl: 0,
      costBasis: 0,
      netDelta: 0,
      netTheta: 0,
    };

    existing.positionCount += 1;
    existing.pnl += analysis.pnl;
    existing.costBasis += Math.abs(analysis.costBasis);
    existing.netDelta += analysis.greeks?.delta ?? 0;
    existing.netTheta += analysis.greeks?.theta ?? 0;

    symbolExposureMap.set(symbol, existing);
  }

  const symbolExposure = Array.from(symbolExposureMap.values())
    .map((item) => ({
      symbol: item.symbol,
      positionCount: item.positionCount,
      pnl: round(item.pnl, 2),
      pnlPct: item.costBasis > 0 ? round((item.pnl / item.costBasis) * 100, 2) : 0,
      netDelta: round(item.netDelta, 2),
      netTheta: round(item.netTheta, 2),
    }))
    .sort((left, right) => Math.abs(right.pnl) - Math.abs(left.pnl))
    .slice(0, 8);

  const portfolio: SwingSniperPortfolioExposureSummary = portfolioAnalysis
    ? {
      openPositions: positions.length,
      totalPnl: round(portfolioAnalysis.portfolio.totalPnl, 2),
      totalPnlPct: round(portfolioAnalysis.portfolio.totalPnlPct, 2),
      riskLevel: portfolioAnalysis.portfolio.riskAssessment.overall,
      warnings: portfolioAnalysis.portfolio.riskAssessment.warnings,
      netGreeks: {
        delta: round(portfolioAnalysis.portfolio.portfolioGreeks.delta, 2),
        gamma: round(portfolioAnalysis.portfolio.portfolioGreeks.gamma, 4),
        theta: round(portfolioAnalysis.portfolio.portfolioGreeks.theta, 2),
        vega: round(portfolioAnalysis.portfolio.portfolioGreeks.vega, 2),
        rho: round(portfolioAnalysis.portfolio.portfolioGreeks.rho ?? 0, 2),
      },
      symbolExposure,
    }
    : {
      openPositions: positions.length,
      totalPnl: 0,
      totalPnlPct: 0,
      riskLevel: 'moderate',
      warnings: ['Portfolio analytics are temporarily degraded.'],
      netGreeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
      },
      symbolExposure,
    };

  if (portfolio.warnings.length === 0) {
    notes.push('Portfolio risk checks did not surface major concentration/theta/gamma warnings in this snapshot.');
  }

  const alerts = mergeAlerts(savedThesisSnapshots, positionAdvice);
  const generatedAt = new Date().toISOString();
  const nextEvaluationAt = new Date(Date.now() + (RISK_SENTINEL_REFRESH_INTERVAL_MINUTES * 60 * 1000)).toISOString();

  return {
    generatedAt,
    cadence: {
      mode: 'on_demand_cached',
      refreshIntervalMinutes: RISK_SENTINEL_REFRESH_INTERVAL_MINUTES,
      nextEvaluationAt,
    },
    savedTheses: savedThesisSnapshots,
    portfolio,
    positionAdvice,
    alerts,
    notes,
  };
}
