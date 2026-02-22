import { calculateVWAP } from '../levels/calculators/vwap';
import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupDirection, SetupSignal, clampConfidence } from './types';

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function calculateVolumeWeightedStdDev(values: Array<{ price: number; volume: number }>, mean: number): number {
  const totalVolume = values.reduce((sum, item) => sum + item.volume, 0);
  if (totalVolume <= 0) return 0;

  const variance = values.reduce((sum, item) => {
    const distance = item.price - mean;
    return sum + item.volume * distance * distance;
  }, 0) / totalVolume;

  return Math.sqrt(variance);
}

function confirmMicrostructureDirection(snapshot: DetectorSnapshot, direction: SetupDirection): boolean {
  const micro = snapshot.microstructure;
  if (!micro || !micro.available) return true;

  const coverageOk = micro.quoteCoveragePct >= 35;
  const spreadOk = micro.avgSpreadBps == null || micro.avgSpreadBps <= 35;
  if (!coverageOk || !spreadOk) return false;

  const skew = micro.aggressorSkew ?? 0;
  const imbalance = micro.bidAskImbalance ?? 0;
  const ratio = micro.askBidSizeRatio;

  if (direction === 'long') {
    return skew >= 0.03 || imbalance >= 0.04 || (typeof ratio === 'number' && ratio < 1);
  }

  if (direction === 'short') {
    return skew <= -0.03 || imbalance <= -0.04 || (typeof ratio === 'number' && ratio > 1);
  }

  return true;
}

export function detectVWAPPlay(snapshot: DetectorSnapshot): SetupSignal | null {
  const bars = snapshot.intradayBars;
  if (bars.length < 20) return null;

  const vwap = calculateVWAP(bars);
  if (!vwap || !Number.isFinite(vwap)) return null;

  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);
  const lastBar = bars[bars.length - 1];
  const previousBar = bars[bars.length - 2];
  const baselineBars = bars.slice(-21, -1);
  const avgVolume = baselineBars.reduce((sum, bar) => sum + bar.v, 0) / Math.max(1, baselineBars.length);
  const volumeRatio = avgVolume > 0 ? lastBar.v / avgVolume : 0;

  const stdDev = calculateVolumeWeightedStdDev(
    bars.map((bar) => ({ price: bar.c, volume: bar.v })),
    vwap,
  );
  const deviation = lastBar.c - vwap;
  const deviationBand = stdDev > 0 ? deviation / stdDev : 0;

  if (previousBar.c <= vwap && lastBar.c > vwap && volumeRatio >= 1.1) {
    if (!confirmMicrostructureDirection(snapshot, 'long')) return null;
    const confidence = clampConfidence(63 + (volumeRatio - 1.1) * 25 + Math.min(10, Math.abs(deviationBand) * 4));
    return {
      type: 'vwap_cross',
      symbol: snapshot.symbol,
      direction: 'long',
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${snapshot.symbol} crossed above VWAP at $${roundPrice(vwap)} with ${volumeRatio.toFixed(2)}x volume`,
      dedupeKey: `vwap_cross:long:${roundPrice(vwap)}`,
      signalData: {
        vwapPrice: roundPrice(vwap),
        currentPrice: roundPrice(lastBar.c),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        deviationBand: Number(deviationBand.toFixed(2)),
        microstructure: snapshot.microstructure
          ? {
            available: snapshot.microstructure.available,
            quoteCoveragePct: snapshot.microstructure.quoteCoveragePct,
            askBidSizeRatio: snapshot.microstructure.askBidSizeRatio,
            bidAskImbalance: snapshot.microstructure.bidAskImbalance,
            aggressorSkew: snapshot.microstructure.aggressorSkew,
            avgSpreadBps: snapshot.microstructure.avgSpreadBps,
          }
          : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'vwap_cross',
        direction: 'long',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: vwap,
        range: Math.max(atr * 0.8, Math.abs(lastBar.c - vwap) + atr * 0.25),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  if (previousBar.c >= vwap && lastBar.c < vwap && volumeRatio >= 1.1) {
    if (!confirmMicrostructureDirection(snapshot, 'short')) return null;
    const confidence = clampConfidence(63 + (volumeRatio - 1.1) * 25 + Math.min(10, Math.abs(deviationBand) * 4));
    return {
      type: 'vwap_cross',
      symbol: snapshot.symbol,
      direction: 'short',
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${snapshot.symbol} crossed below VWAP at $${roundPrice(vwap)} with ${volumeRatio.toFixed(2)}x volume`,
      dedupeKey: `vwap_cross:short:${roundPrice(vwap)}`,
      signalData: {
        vwapPrice: roundPrice(vwap),
        currentPrice: roundPrice(lastBar.c),
        volumeRatio: Number(volumeRatio.toFixed(2)),
        deviationBand: Number(deviationBand.toFixed(2)),
        microstructure: snapshot.microstructure
          ? {
            available: snapshot.microstructure.available,
            quoteCoveragePct: snapshot.microstructure.quoteCoveragePct,
            askBidSizeRatio: snapshot.microstructure.askBidSizeRatio,
            bidAskImbalance: snapshot.microstructure.bidAskImbalance,
            aggressorSkew: snapshot.microstructure.aggressorSkew,
            avgSpreadBps: snapshot.microstructure.avgSpreadBps,
          }
          : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'vwap_cross',
        direction: 'short',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: vwap,
        range: Math.max(atr * 0.8, Math.abs(lastBar.c - vwap) + atr * 0.25),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  const recentBars = bars.slice(-8);
  const minRecentLow = Math.min(...recentBars.map((bar) => bar.l));
  const maxRecentHigh = Math.max(...recentBars.map((bar) => bar.h));

  if (minRecentLow <= vwap + atr * 0.1 && lastBar.c >= vwap + atr * 0.3) {
    if (!confirmMicrostructureDirection(snapshot, 'long')) return null;
    const confidence = clampConfidence(66 + Math.min(18, (lastBar.c - vwap) / Math.max(0.01, atr) * 12));
    return {
      type: 'vwap_bounce',
      symbol: snapshot.symbol,
      direction: 'long',
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${snapshot.symbol} bounced off VWAP and reclaimed momentum`,
      dedupeKey: `vwap_bounce:long:${roundPrice(vwap)}:${new Date(lastBar.t).toISOString().slice(0, 16)}`,
      signalData: {
        vwapPrice: roundPrice(vwap),
        currentPrice: roundPrice(lastBar.c),
        touchedAt: roundPrice(minRecentLow),
        deviationBand: Number(deviationBand.toFixed(2)),
        microstructure: snapshot.microstructure
          ? {
            available: snapshot.microstructure.available,
            quoteCoveragePct: snapshot.microstructure.quoteCoveragePct,
            askBidSizeRatio: snapshot.microstructure.askBidSizeRatio,
            bidAskImbalance: snapshot.microstructure.bidAskImbalance,
            aggressorSkew: snapshot.microstructure.aggressorSkew,
            avgSpreadBps: snapshot.microstructure.avgSpreadBps,
          }
          : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'vwap_bounce',
        direction: 'long',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: vwap,
        range: Math.max(atr * 0.7, Math.abs(lastBar.c - vwap)),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  if (maxRecentHigh >= vwap - atr * 0.1 && lastBar.c <= vwap - atr * 0.3) {
    if (!confirmMicrostructureDirection(snapshot, 'short')) return null;
    const confidence = clampConfidence(66 + Math.min(18, (vwap - lastBar.c) / Math.max(0.01, atr) * 12));
    return {
      type: 'vwap_bounce',
      symbol: snapshot.symbol,
      direction: 'short',
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${snapshot.symbol} rejected VWAP and resumed lower`,
      dedupeKey: `vwap_bounce:short:${roundPrice(vwap)}:${new Date(lastBar.t).toISOString().slice(0, 16)}`,
      signalData: {
        vwapPrice: roundPrice(vwap),
        currentPrice: roundPrice(lastBar.c),
        touchedAt: roundPrice(maxRecentHigh),
        deviationBand: Number(deviationBand.toFixed(2)),
        microstructure: snapshot.microstructure
          ? {
            available: snapshot.microstructure.available,
            quoteCoveragePct: snapshot.microstructure.quoteCoveragePct,
            askBidSizeRatio: snapshot.microstructure.askBidSizeRatio,
            bidAskImbalance: snapshot.microstructure.bidAskImbalance,
            aggressorSkew: snapshot.microstructure.aggressorSkew,
            avgSpreadBps: snapshot.microstructure.avgSpreadBps,
          }
          : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'vwap_bounce',
        direction: 'short',
        currentPrice: lastBar.c,
        atr,
        referenceLevel: vwap,
        range: Math.max(atr * 0.7, Math.abs(lastBar.c - vwap)),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  const deviationMagnitude = Math.abs(deviationBand);
  if (deviationMagnitude >= 2 || Math.abs(deviation) >= atr * 1.2) {
    const meanReversionDirection = deviation > 0 ? 'short' : 'long';
    if (!confirmMicrostructureDirection(snapshot, meanReversionDirection)) return null;
    const confidence = clampConfidence(62 + Math.min(25, deviationMagnitude * 8));

    return {
      type: 'vwap_deviation',
      symbol: snapshot.symbol,
      direction: meanReversionDirection,
      confidence,
      currentPrice: roundPrice(lastBar.c),
      description: `${snapshot.symbol} reached ${deviationMagnitude.toFixed(1)}σ from VWAP; mean reversion setup`,
      dedupeKey: `vwap_deviation:${meanReversionDirection}:${Math.round(deviationMagnitude)}`,
      signalData: {
        vwapPrice: roundPrice(vwap),
        currentPrice: roundPrice(lastBar.c),
        deviationBand: Number(deviationBand.toFixed(2)),
        microstructure: snapshot.microstructure
          ? {
            available: snapshot.microstructure.available,
            quoteCoveragePct: snapshot.microstructure.quoteCoveragePct,
            askBidSizeRatio: snapshot.microstructure.askBidSizeRatio,
            bidAskImbalance: snapshot.microstructure.bidAskImbalance,
            aggressorSkew: snapshot.microstructure.aggressorSkew,
            avgSpreadBps: snapshot.microstructure.avgSpreadBps,
          }
          : null,
      },
      tradeSuggestion: buildTradeSuggestion({
        setupType: 'vwap_deviation',
        direction: meanReversionDirection,
        currentPrice: lastBar.c,
        atr,
        referenceLevel: vwap,
        range: Math.max(atr, Math.abs(lastBar.c - vwap)),
      }),
      detectedAt: snapshot.detectedAt,
    };
  }

  return null;
}
