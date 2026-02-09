import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupSignal, clampConfidence } from './types';

export interface OrbOptions {
  periodMinutes?: 5 | 15 | 30;
  minVolumeRatio?: number;
}

function toRounded(value: number): number {
  return Number(value.toFixed(2));
}

export function detectOrbBreakout(snapshot: DetectorSnapshot, options?: OrbOptions): SetupSignal | null {
  const periodMinutes = options?.periodMinutes ?? 15;
  const minVolumeRatio = options?.minVolumeRatio ?? 1.2;

  const bars = snapshot.intradayBars;
  if (bars.length < periodMinutes + 2) {
    return null;
  }

  const openingRangeBars = bars.slice(0, periodMinutes);
  const orbHigh = Math.max(...openingRangeBars.map((bar) => bar.h));
  const orbLow = Math.min(...openingRangeBars.map((bar) => bar.l));
  const orbWidth = orbHigh - orbLow;

  if (orbWidth <= 0) {
    return null;
  }

  const lastBar = bars[bars.length - 1];
  const previousBar = bars[bars.length - 2];

  const postRangeBars = bars.slice(periodMinutes, -1);
  const baselineBars = (postRangeBars.length > 0 ? postRangeBars : openingRangeBars).slice(-20);
  const avgVolume = baselineBars.reduce((sum, bar) => sum + bar.v, 0) / baselineBars.length;
  const volumeRatio = avgVolume > 0 ? lastBar.v / avgVolume : 0;
  const atr = snapshot.levels.levels.indicators.atr14 ?? null;
  const atrRatio = atr && atr > 0 ? orbWidth / atr : null;

  if (volumeRatio < minVolumeRatio) {
    return null;
  }

  if (lastBar.c > orbHigh && previousBar.c <= orbHigh) {
    const breakoutDistance = lastBar.c - orbHigh;
    const confidence = clampConfidence(62 + (volumeRatio - minVolumeRatio) * 30 + (atrRatio ? Math.max(0, 1.5 - atrRatio) * 8 : 0));

    return {
      type: 'orb_breakout',
      symbol: snapshot.symbol,
      direction: 'long',
      confidence,
      currentPrice: toRounded(lastBar.c),
      description: `${snapshot.symbol} broke above ${periodMinutes}m ORB high at $${toRounded(orbHigh)} on ${volumeRatio.toFixed(2)}x volume`,
      dedupeKey: `orb:${periodMinutes}:long:${toRounded(orbHigh)}:${toRounded(orbLow)}`,
      signalData: {
        orbPeriodMinutes: periodMinutes,
        orbHigh: toRounded(orbHigh),
        orbLow: toRounded(orbLow),
        orbWidth: toRounded(orbWidth),
        breakoutPrice: toRounded(lastBar.c),
        breakoutDistance: toRounded(breakoutDistance),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        atrRatio: atrRatio ? Number(atrRatio.toFixed(2)) : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'orb_breakout',
        direction: 'long',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: orbLow,
        range: orbWidth,
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  if (lastBar.c < orbLow && previousBar.c >= orbLow) {
    const breakoutDistance = orbLow - lastBar.c;
    const confidence = clampConfidence(62 + (volumeRatio - minVolumeRatio) * 30 + (atrRatio ? Math.max(0, 1.5 - atrRatio) * 8 : 0));

    return {
      type: 'orb_breakout',
      symbol: snapshot.symbol,
      direction: 'short',
      confidence,
      currentPrice: toRounded(lastBar.c),
      description: `${snapshot.symbol} broke below ${periodMinutes}m ORB low at $${toRounded(orbLow)} on ${volumeRatio.toFixed(2)}x volume`,
      dedupeKey: `orb:${periodMinutes}:short:${toRounded(orbHigh)}:${toRounded(orbLow)}`,
      signalData: {
        orbPeriodMinutes: periodMinutes,
        orbHigh: toRounded(orbHigh),
        orbLow: toRounded(orbLow),
        orbWidth: toRounded(orbWidth),
        breakoutPrice: toRounded(lastBar.c),
        breakoutDistance: toRounded(breakoutDistance),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        atrRatio: atrRatio ? Number(atrRatio.toFixed(2)) : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'orb_breakout',
        direction: 'short',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: orbHigh,
        range: orbWidth,
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  return null;
}
