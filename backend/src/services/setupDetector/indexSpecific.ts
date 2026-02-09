import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupSignal, clampConfidence } from './types';

const INDEX_SYMBOLS = new Set(['SPX', 'NDX']);

interface IndexSpecificOptions {
  orbPeriodMinutes?: 5 | 15 | 30;
  minVolumeRatio?: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function isHigherLowSequence(bars: Array<{ l: number }>, tolerance: number): boolean {
  for (let i = 1; i < bars.length; i += 1) {
    if (bars[i].l + tolerance < bars[i - 1].l) {
      return false;
    }
  }
  return true;
}

function isLowerHighSequence(bars: Array<{ h: number }>, tolerance: number): boolean {
  for (let i = 1; i < bars.length; i += 1) {
    if (bars[i].h - tolerance > bars[i - 1].h) {
      return false;
    }
  }
  return true;
}

export function detectIndexOpeningDrive(snapshot: DetectorSnapshot, options?: IndexSpecificOptions): SetupSignal | null {
  const symbol = snapshot.symbol.toUpperCase();
  if (!INDEX_SYMBOLS.has(symbol)) {
    return null;
  }

  const bars = snapshot.intradayBars;
  const orbPeriod = options?.orbPeriodMinutes ?? 15;
  const minVolumeRatio = options?.minVolumeRatio ?? 1.2;
  const minTrendExtensionAtr = 0.15;

  if (bars.length < orbPeriod + 8) {
    return null;
  }

  const orbBars = bars.slice(0, orbPeriod);
  const orbHigh = Math.max(...orbBars.map((bar) => bar.h));
  const orbLow = Math.min(...orbBars.map((bar) => bar.l));
  const orbWidth = orbHigh - orbLow;

  if (!Number.isFinite(orbWidth) || orbWidth <= 0) {
    return null;
  }

  const vwap = snapshot.levels.levels.indicators.vwap;
  if (!vwap || !Number.isFinite(vwap)) {
    return null;
  }

  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);
  const lastBar = bars[bars.length - 1];
  const priorBars = bars.slice(-6, -1);
  const baselineBars = bars.slice(-25, -5);

  if (priorBars.length < 4 || baselineBars.length < 5) {
    return null;
  }

  const avgVolume = baselineBars.reduce((sum, bar) => sum + bar.v, 0) / baselineBars.length;
  const volumeRatio = avgVolume > 0 ? lastBar.v / avgVolume : 0;
  const tolerance = Math.max(atr * 0.05, snapshot.levels.currentPrice * 0.0005);

  const openingReference = bars[Math.min(orbPeriod, bars.length - 1)].c;
  const trendExtensionAtr = (lastBar.c - openingReference) / Math.max(0.01, atr);

  const longCondition =
    lastBar.c > orbHigh &&
    lastBar.c > vwap &&
    volumeRatio >= minVolumeRatio &&
    isHigherLowSequence(priorBars, tolerance) &&
    trendExtensionAtr >= minTrendExtensionAtr;

  if (longCondition) {
    const confidence = clampConfidence(
      68 + Math.min(12, (volumeRatio - minVolumeRatio) * 20) + Math.min(10, trendExtensionAtr * 8),
    );
    const setupType = symbol === 'SPX' ? 'spx_opening_drive' : 'ndx_opening_drive';

    return {
      type: setupType,
      symbol,
      direction: 'long',
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${symbol} opening drive above ${orbPeriod}m ORB with VWAP support`,
      dedupeKey: `${setupType}:long:${orbPeriod}:${roundPrice(orbHigh)}:${roundPrice(orbLow)}`,
      signalData: {
        orbPeriodMinutes: orbPeriod,
        orbHigh: roundPrice(orbHigh),
        orbLow: roundPrice(orbLow),
        orbWidth: roundPrice(orbWidth),
        vwapPrice: roundPrice(vwap),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        trendExtensionAtr: Number(trendExtensionAtr.toFixed(2)),
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType,
        direction: 'long',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: Math.min(vwap, orbHigh),
        range: Math.max(atr * 0.9, orbWidth),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  const shortCondition =
    lastBar.c < orbLow &&
    lastBar.c < vwap &&
    volumeRatio >= minVolumeRatio &&
    isLowerHighSequence(priorBars, tolerance) &&
    trendExtensionAtr <= -minTrendExtensionAtr;

  if (!shortCondition) {
    return null;
  }

  const confidence = clampConfidence(
    68 + Math.min(12, (volumeRatio - minVolumeRatio) * 20) + Math.min(10, Math.abs(trendExtensionAtr) * 8),
  );
  const setupType = symbol === 'SPX' ? 'spx_opening_drive' : 'ndx_opening_drive';

  return {
    type: setupType,
    symbol,
    direction: 'short',
    confidence,
    currentPrice: roundPrice(lastBar.c),
    description: `${symbol} opening drive below ${orbPeriod}m ORB with VWAP rejection`,
    dedupeKey: `${setupType}:short:${orbPeriod}:${roundPrice(orbHigh)}:${roundPrice(orbLow)}`,
    signalData: {
      orbPeriodMinutes: orbPeriod,
      orbHigh: roundPrice(orbHigh),
      orbLow: roundPrice(orbLow),
      orbWidth: roundPrice(orbWidth),
      vwapPrice: roundPrice(vwap),
      volumeRatio: Number(volumeRatio.toFixed(2)),
      trendExtensionAtr: Number(trendExtensionAtr.toFixed(2)),
    },
    tradeSuggestion: buildTradeSuggestion({
      setupType,
      direction: 'short',
      currentPrice: lastBar.c,
      atr,
      referenceLevel: Math.max(vwap, orbLow),
      range: Math.max(atr * 0.9, orbWidth),
    }),
    detectedAt: snapshot.detectedAt,
  };
}
