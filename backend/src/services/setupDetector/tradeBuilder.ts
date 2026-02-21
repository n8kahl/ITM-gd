import { SetupDirection, SetupSignalType, SetupTradeSuggestion } from './types';

interface TradeBuilderInput {
  setupType: SetupSignalType;
  direction: SetupDirection;
  currentPrice: number;
  atr?: number | null;
  referenceLevel?: number;
  range?: number;
  minRiskReward?: number;
  maxFeasibleMove?: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

export function buildTradeSuggestion(input: TradeBuilderInput): SetupTradeSuggestion | undefined {
  const {
    setupType,
    direction,
    currentPrice,
    atr,
    referenceLevel,
    range,
    minRiskReward = 2,
    maxFeasibleMove,
  } = input;

  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || direction === 'neutral') {
    return undefined;
  }

  const atrValue = atr && atr > 0 ? atr : Math.max(currentPrice * 0.004, 1);
  const setupRange = range && range > 0 ? range : atrValue * 0.6;
  const structureStopBuffer = Math.max(atrValue * 0.28, setupRange * 0.18);
  const targetCap = Number.isFinite(maxFeasibleMove) && (maxFeasibleMove as number) > 0
    ? (maxFeasibleMove as number)
    : Math.max(atrValue * 2.4, setupRange * 2.2);
  const minRisk = Math.max(atrValue * 0.14, setupRange * 0.12, 0.2);

  if (direction === 'long') {
    const stopLoss = referenceLevel !== undefined
      ? Math.min(referenceLevel - structureStopBuffer, currentPrice - minRisk)
      : currentPrice - structureStopBuffer;
    const risk = currentPrice - stopLoss;
    if (!Number.isFinite(risk) || risk <= minRisk) return undefined;

    const requiredReward = risk * Math.max(1.4, minRiskReward);
    const proposedReward = Math.max(requiredReward, setupRange * 1.6, atrValue * 1.0);
    if (proposedReward > targetCap) return undefined;

    const target = currentPrice + proposedReward;

    return {
      strategy: setupType.replace(/_/g, ' '),
      entry: roundPrice(currentPrice),
      stopLoss: roundPrice(stopLoss),
      target: roundPrice(target),
      riskReward: roundPrice(proposedReward / risk),
      rrQualified: true,
    };
  }

  const stopLoss = referenceLevel !== undefined
    ? Math.max(referenceLevel + structureStopBuffer, currentPrice + minRisk)
    : currentPrice + structureStopBuffer;
  const risk = stopLoss - currentPrice;
  if (!Number.isFinite(risk) || risk <= minRisk) return undefined;

  const requiredReward = risk * Math.max(1.4, minRiskReward);
  const proposedReward = Math.max(requiredReward, setupRange * 1.6, atrValue * 1.0);
  if (proposedReward > targetCap) return undefined;
  const target = currentPrice - proposedReward;

  return {
    strategy: setupType.replace(/_/g, ' '),
    entry: roundPrice(currentPrice),
    stopLoss: roundPrice(stopLoss),
    target: roundPrice(target),
    riskReward: roundPrice(proposedReward / risk),
    rrQualified: true,
  };
}
