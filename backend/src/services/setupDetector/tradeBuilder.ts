import { SetupDirection, SetupSignalType, SetupTradeSuggestion } from './types';

interface TradeBuilderInput {
  setupType: SetupSignalType;
  direction: SetupDirection;
  currentPrice: number;
  atr?: number | null;
  referenceLevel?: number;
  range?: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

export function buildTradeSuggestion(input: TradeBuilderInput): SetupTradeSuggestion | undefined {
  const { setupType, direction, currentPrice, atr, referenceLevel, range } = input;

  if (!Number.isFinite(currentPrice) || currentPrice <= 0 || direction === 'neutral') {
    return undefined;
  }

  const atrValue = atr && atr > 0 ? atr : Math.max(currentPrice * 0.004, 1);
  const setupRange = range && range > 0 ? range : atrValue * 0.6;

  if (direction === 'long') {
    const stopBuffer = Math.max(atrValue * 0.35, setupRange * 0.2);
    const stopLoss = referenceLevel !== undefined
      ? Math.min(referenceLevel - stopBuffer, currentPrice - stopBuffer)
      : currentPrice - stopBuffer;
    const target = currentPrice + Math.max(setupRange * 1.5, atrValue * 0.9);

    return {
      strategy: setupType.replace(/_/g, ' '),
      entry: roundPrice(currentPrice),
      stopLoss: roundPrice(stopLoss),
      target: roundPrice(target),
    };
  }

  const stopBuffer = Math.max(atrValue * 0.35, setupRange * 0.2);
  const stopLoss = referenceLevel !== undefined
    ? Math.max(referenceLevel + stopBuffer, currentPrice + stopBuffer)
    : currentPrice + stopBuffer;
  const target = currentPrice - Math.max(setupRange * 1.5, atrValue * 0.9);

  return {
    strategy: setupType.replace(/_/g, ' '),
    entry: roundPrice(currentPrice),
    stopLoss: roundPrice(stopLoss),
    target: roundPrice(target),
  };
}
