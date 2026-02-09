import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupDirection, SetupSignal, clampConfidence } from './types';

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function resolveDirection(
  barDirection: 'up' | 'down',
  potentialExhaustion: boolean,
): SetupDirection {
  if (!potentialExhaustion) {
    return barDirection === 'up' ? 'long' : 'short';
  }

  return barDirection === 'up' ? 'short' : 'long';
}

export function detectVolumeClimax(snapshot: DetectorSnapshot): SetupSignal | null {
  const bars = snapshot.intradayBars;
  if (bars.length < 22) {
    return null;
  }

  const lastBar = bars[bars.length - 1];
  const baselineBars = bars.slice(-21, -1);
  const avgVolume = baselineBars.reduce((sum, bar) => sum + bar.v, 0) / baselineBars.length;
  const avgRange = baselineBars.reduce((sum, bar) => sum + (bar.h - bar.l), 0) / baselineBars.length;

  if (avgVolume <= 0 || avgRange <= 0) {
    return null;
  }

  const volumeRatio = lastBar.v / avgVolume;
  if (volumeRatio < 3) {
    return null;
  }

  const barRange = Math.max(0.01, lastBar.h - lastBar.l);
  const body = Math.abs(lastBar.c - lastBar.o);
  const upperWick = lastBar.h - Math.max(lastBar.o, lastBar.c);
  const lowerWick = Math.min(lastBar.o, lastBar.c) - lastBar.l;
  const barDirection: 'up' | 'down' = lastBar.c >= lastBar.o ? 'up' : 'down';

  const potentialExhaustion =
    (barDirection === 'up' && upperWick > body * 1.2) ||
    (barDirection === 'down' && lowerWick > body * 1.2) ||
    barRange > avgRange * 1.8;

  const setupDirection = resolveDirection(barDirection, potentialExhaustion);
  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);

  const confidence = clampConfidence(
    66
      + Math.min(16, (volumeRatio - 3) * 9)
      + (potentialExhaustion ? 8 : 0),
  );

  return {
    type: 'volume_climax',
    symbol: snapshot.symbol,
    direction: setupDirection,
    confidence,
    currentPrice: roundPrice(lastBar.c),
    description: `${snapshot.symbol} volume climax at ${volumeRatio.toFixed(1)}x average volume (${barDirection} bar)`,
    dedupeKey: `volume_climax:${barDirection}:${new Date(lastBar.t).toISOString().slice(0, 16)}`,
    signalData: {
      volumeRatio: Number(volumeRatio.toFixed(2)),
      barDirection,
      potentialExhaustion,
      barRange: roundPrice(barRange),
      averageRange: roundPrice(avgRange),
    },
    tradeSuggestion: buildTradeSuggestion({
      setupType: 'volume_climax',
      direction: setupDirection,
      currentPrice: lastBar.c,
      atr,
      referenceLevel: barDirection === 'up' ? lastBar.h : lastBar.l,
      range: Math.max(atr * 0.8, barRange),
    }),
    detectedAt: snapshot.detectedAt,
  };
}
