import { DetectorSnapshot, SetupSignal, SetupDirection, clampConfidence } from './types';

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function getGapDirection(gapSize: number): SetupDirection {
  if (gapSize > 0) return 'short';
  if (gapSize < 0) return 'long';
  return 'neutral';
}

export function detectGapFill(snapshot: DetectorSnapshot): SetupSignal | null {
  if (snapshot.intradayBars.length < 2 || snapshot.dailyBars.length < 2) {
    return null;
  }

  const todayOpen = snapshot.intradayBars[0].o;
  const currentPrice = snapshot.intradayBars[snapshot.intradayBars.length - 1].c;
  const previousClose = snapshot.dailyBars[snapshot.dailyBars.length - 2].c;

  if (!Number.isFinite(todayOpen) || !Number.isFinite(previousClose) || previousClose <= 0) {
    return null;
  }

  const gapSize = todayOpen - previousClose;
  const gapPct = (gapSize / previousClose) * 100;
  if (Math.abs(gapPct) < 0.2) {
    return null;
  }

  const totalGapPoints = Math.abs(gapSize);
  if (totalGapPoints <= 0) {
    return null;
  }

  const fillPoints = gapSize > 0
    ? todayOpen - currentPrice
    : currentPrice - todayOpen;
  const fillPctRaw = (fillPoints / totalGapPoints) * 100;
  const fillPct = clampPercent(fillPctRaw);

  const stage = fillPct >= 100 ? 'full' : fillPct >= 50 ? 'half' : null;
  if (!stage) {
    return null;
  }

  const direction = getGapDirection(gapSize);
  if (direction === 'neutral') {
    return null;
  }

  const confidenceBase = stage === 'full' ? 80 : 66;
  const confidence = clampConfidence(confidenceBase + Math.min(12, Math.abs(gapPct) * 2));

  const target = stage === 'half'
    ? todayOpen - gapSize * 0.25
    : previousClose;

  const stopLoss = direction === 'long'
    ? Math.min(todayOpen, currentPrice) - totalGapPoints * 0.25
    : Math.max(todayOpen, currentPrice) + totalGapPoints * 0.25;

  return {
    type: 'gap_fill',
    symbol: snapshot.symbol,
    direction,
    confidence,
    currentPrice: roundPrice(currentPrice),
    description: `${snapshot.symbol} ${stage === 'full' ? 'completed' : 'reached 50%'} gap fill (${roundPrice(fillPct)}%)`,
    dedupeKey: `gap_fill:${stage}:${roundPrice(previousClose)}:${roundPrice(todayOpen)}`,
    signalData: {
      gapSize: roundPrice(gapSize),
      gapPct: roundPrice(gapPct),
      fillPct: roundPrice(fillPct),
      previousClose: roundPrice(previousClose),
      todayOpen: roundPrice(todayOpen),
      currentPrice: roundPrice(currentPrice),
      stage,
    },
    tradeSuggestion: {
      strategy: 'gap fill',
      entry: roundPrice(currentPrice),
      stopLoss: roundPrice(stopLoss),
      target: roundPrice(target),
    },
    detectedAt: snapshot.detectedAt,
  };
}
