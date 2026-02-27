import type { ChartBar, ParsedTrade, TradeEvaluation } from './types';

const DEFAULT_RISK_PCT = 20;
const MOMENTUM_THRESHOLD = 0.5;
const CONFIDENCE_TREND_THRESHOLD = 1;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseEpochSeconds(timestamp: string): number | null {
  const epochMs = Date.parse(timestamp);
  if (!Number.isFinite(epochMs)) return null;
  return Math.floor(epochMs / 1000);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function directionalSign(trade: ParsedTrade): number {
  return trade.contract.type === 'call' ? 1 : -1;
}

function findNearestBarIndex(bars: ChartBar[], targetTimeSec: number): number {
  if (!bars.length) return -1;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < bars.length; index += 1) {
    const distance = Math.abs(bars[index].time - targetTimeSec);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function averageClose(bars: ChartBar[], startIndex: number, endIndex: number): number | null {
  if (!bars.length || endIndex < startIndex) return null;
  const values: number[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const bar = bars[index];
    if (!bar) continue;
    if (!Number.isFinite(bar.close)) continue;
    values.push(bar.close);
  }

  return average(values);
}

function extractStopRiskPct(trade: ParsedTrade): number {
  const stopPercentages = trade.exitEvents
    .filter((event) => event.type === 'stop' || event.type === 'trail_stop' || event.type === 'breakeven_stop')
    .map((event) => (typeof event.percentage === 'number' ? Math.abs(event.percentage) : null))
    .filter((value): value is number => Boolean(value && Number.isFinite(value) && value > 0));

  return average(stopPercentages) ?? DEFAULT_RISK_PCT;
}

export function scoreTrade(
  trade: ParsedTrade,
  sessionBars: ChartBar[],
  pnlPercent?: number | null,
): TradeEvaluation {
  const drivers: string[] = [];
  const risks: string[] = [];
  const sign = directionalSign(trade);

  let alignmentScore = 50;

  if (sessionBars.length >= 2) {
    const sessionMove = sessionBars[sessionBars.length - 1].close - sessionBars[0].open;
    const directionalSessionMove = sign * sessionMove;
    if (directionalSessionMove > 0) {
      alignmentScore += 12;
      drivers.push(`Session trend favored ${trade.contract.type.toUpperCase()} positioning.`);
    } else if (directionalSessionMove < 0) {
      alignmentScore -= 12;
      risks.push(`Session trend moved against ${trade.contract.type.toUpperCase()} positioning.`);
    }
  } else {
    risks.push('Limited bar history reduced trend alignment confidence.');
  }

  const entryTimeSec = parseEpochSeconds(trade.entryTimestamp);
  const entryIndex = entryTimeSec == null ? -1 : findNearestBarIndex(sessionBars, entryTimeSec);

  if (entryIndex >= 0) {
    const entryBar = sessionBars[entryIndex];
    const strikeDistance = Math.abs(trade.contract.strike - entryBar.close);

    if (strikeDistance <= 80) {
      alignmentScore += 8;
      drivers.push('Strike selection was close to spot at entry.');
    } else if (strikeDistance >= 250) {
      alignmentScore -= 8;
      risks.push('Strike selection was far from spot at entry.');
    }

    const beforeAvg = averageClose(sessionBars, Math.max(0, entryIndex - 5), Math.max(0, entryIndex - 1));
    const afterAvg = averageClose(
      sessionBars,
      Math.min(sessionBars.length - 1, entryIndex + 1),
      Math.min(sessionBars.length - 1, entryIndex + 10),
    );
    if (beforeAvg != null && afterAvg != null) {
      const postEntryMomentum = (afterAvg - beforeAvg) * sign;
      if (postEntryMomentum > MOMENTUM_THRESHOLD) {
        alignmentScore += 14;
        drivers.push('Post-entry momentum confirmed trade direction.');
      } else if (postEntryMomentum < -MOMENTUM_THRESHOLD) {
        alignmentScore -= 14;
        risks.push('Post-entry momentum faded shortly after entry.');
      }
    }
  } else {
    risks.push('Could not align entry timestamp to a nearby market bar.');
  }

  const hasStops = trade.stopLevels.length > 0 || trade.exitEvents.some((event) => event.type.includes('stop'));
  if (hasStops) {
    alignmentScore += 8;
    drivers.push('Stop management signals were present.');
  } else {
    alignmentScore -= 8;
    risks.push('No explicit stop management was captured.');
  }

  const hasTrim = trade.exitEvents.some((event) => event.type === 'trim');
  if (hasTrim) {
    alignmentScore += 6;
    drivers.push('Trim behavior suggests active risk reduction.');
  }

  if (trade.sizing === 'light') {
    alignmentScore += 4;
    drivers.push('Light sizing reduced capital at risk.');
  }

  if (typeof pnlPercent === 'number' && Number.isFinite(pnlPercent)) {
    if (pnlPercent > 0) {
      alignmentScore += 10;
      drivers.push(`Recorded outcome closed green (${round(pnlPercent, 1)}%).`);
    } else if (pnlPercent < 0) {
      alignmentScore -= 10;
      risks.push(`Recorded outcome closed red (${round(pnlPercent, 1)}%).`);
    }
  }

  alignmentScore = clamp(Math.round(alignmentScore), 0, 100);

  let confidence = 35;
  if (sessionBars.length >= 30) {
    confidence += 20;
  } else if (sessionBars.length > 0) {
    confidence += 10;
  } else {
    confidence -= 10;
  }
  if (entryIndex >= 0) confidence += 15;
  if (trade.exitEvents.length > 0) confidence += 10;
  if (typeof pnlPercent === 'number' && Number.isFinite(pnlPercent)) confidence += 15;
  if (hasStops) confidence += 5;
  confidence += Math.round(Math.abs(alignmentScore - 50) / 6);
  confidence = clamp(Math.round(confidence), 0, 100);

  let confidenceTrend: 'up' | 'flat' | 'down' = 'flat';
  if (entryIndex >= 0) {
    const entryClose = sessionBars[entryIndex]?.close;
    const lookaheadClose = sessionBars[Math.min(sessionBars.length - 1, entryIndex + 15)]?.close;
    if (Number.isFinite(entryClose) && Number.isFinite(lookaheadClose)) {
      const directionalMove = (lookaheadClose - entryClose) * sign;
      if (directionalMove > CONFIDENCE_TREND_THRESHOLD) {
        confidenceTrend = 'up';
      } else if (directionalMove < -CONFIDENCE_TREND_THRESHOLD) {
        confidenceTrend = 'down';
      }
    }
  }

  const assumedRiskPct = extractStopRiskPct(trade);
  const rewardPct = (typeof pnlPercent === 'number' && Number.isFinite(pnlPercent))
    ? pnlPercent
    : (alignmentScore - 50) / 2;
  const expectedValueR = round(rewardPct / assumedRiskPct, 2);

  if (!drivers.length) {
    drivers.push('Score derived from baseline replay heuristics.');
  }
  if (!risks.length) {
    risks.push('No major deterministic risk flags were detected.');
  }

  return {
    alignmentScore,
    confidence,
    confidenceTrend,
    expectedValueR,
    drivers: drivers.slice(0, 6),
    risks: risks.slice(0, 6),
  };
}
