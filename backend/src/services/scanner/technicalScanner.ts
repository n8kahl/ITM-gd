import { MassiveAggregate } from '../../config/massive';
import { fetchDailyData, fetchIntradayData } from '../levels/fetcher';
import { calculateLevels } from '../levels';

/**
 * Technical scanning algorithms for detecting trading setups
 */

export interface TechnicalSetup {
  type: 'support_bounce' | 'resistance_rejection' | 'breakout' | 'breakdown' | 'ma_crossover' | 'rsi_divergence' | 'volume_spike';
  symbol: string;
  direction: 'bullish' | 'bearish';
  confidence: number; // 0-1
  currentPrice: number;
  triggerPrice: number;
  description: string;
  levels?: {
    entry: number;
    stopLoss: number;
    target: number;
  };
  metadata: Record<string, any>;
}

/**
 * Scan for support bounce: price approaching support with buying pressure
 */
export async function scanSupportBounce(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const levelsData = await calculateLevels(symbol, 'intraday');
    const { currentPrice, levels } = levelsData;
    const atr = levels.indicators.atr14 || 0;

    if (!atr || levels.support.length === 0) return null;

    // Find nearest support level within 0.5 ATR
    const nearestSupport = levels.support[0];
    const distancePct = Math.abs(currentPrice - nearestSupport.price) / currentPrice * 100;

    if (nearestSupport.distancePct != null && Math.abs(nearestSupport.distancePct) > 0.5) return null;
    if (distancePct > 0.5) return null;

    // Check if price is above support (bounce scenario)
    if (currentPrice < nearestSupport.price) return null;

    const confidence = Math.max(0.3, Math.min(0.9, 1 - (distancePct / 0.5)));

    return {
      type: 'support_bounce',
      symbol,
      direction: 'bullish',
      confidence,
      currentPrice,
      triggerPrice: nearestSupport.price,
      description: `${symbol} near ${nearestSupport.type} support at $${nearestSupport.price.toFixed(2)} (${distancePct.toFixed(2)}% away)`,
      levels: {
        entry: currentPrice,
        stopLoss: nearestSupport.price - atr * 0.5,
        target: currentPrice + atr * 1.5,
      },
      metadata: {
        levelType: nearestSupport.type,
        levelPrice: nearestSupport.price,
        atr,
        distancePct,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Scan for resistance rejection: price approaching resistance with selling pressure
 */
export async function scanResistanceRejection(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const levelsData = await calculateLevels(symbol, 'intraday');
    const { currentPrice, levels } = levelsData;
    const atr = levels.indicators.atr14 || 0;

    if (!atr || levels.resistance.length === 0) return null;

    const nearestResistance = levels.resistance[0];
    const distancePct = Math.abs(currentPrice - nearestResistance.price) / currentPrice * 100;

    if (distancePct > 0.5) return null;

    // Price should be below resistance
    if (currentPrice > nearestResistance.price) return null;

    const confidence = Math.max(0.3, Math.min(0.9, 1 - (distancePct / 0.5)));

    return {
      type: 'resistance_rejection',
      symbol,
      direction: 'bearish',
      confidence,
      currentPrice,
      triggerPrice: nearestResistance.price,
      description: `${symbol} near ${nearestResistance.type} resistance at $${nearestResistance.price.toFixed(2)} (${distancePct.toFixed(2)}% away)`,
      levels: {
        entry: currentPrice,
        stopLoss: nearestResistance.price + atr * 0.5,
        target: currentPrice - atr * 1.5,
      },
      metadata: {
        levelType: nearestResistance.type,
        levelPrice: nearestResistance.price,
        atr,
        distancePct,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Scan for volume spike: unusual volume relative to average
 */
export async function scanVolumeSpike(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const intradayData = await fetchIntradayData(symbol);
    if (intradayData.length < 20) return null;

    // Calculate average volume over last 20 bars
    const recentBars = intradayData.slice(-20);
    const avgVolume = recentBars.reduce((sum, b) => sum + b.v, 0) / recentBars.length;

    // Check last bar volume vs average
    const lastBar = intradayData[intradayData.length - 1];
    const volumeRatio = lastBar.v / avgVolume;

    if (volumeRatio < 2.0) return null; // Need at least 2x average volume

    const direction = lastBar.c > lastBar.o ? 'bullish' : 'bearish';
    const confidence = Math.min(0.9, 0.3 + (volumeRatio - 2) * 0.15);

    return {
      type: 'volume_spike',
      symbol,
      direction,
      confidence,
      currentPrice: lastBar.c,
      triggerPrice: lastBar.c,
      description: `${symbol} volume spike: ${volumeRatio.toFixed(1)}x average volume (${direction} candle)`,
      metadata: {
        volumeRatio,
        avgVolume: Math.round(avgVolume),
        lastVolume: lastBar.v,
        priceChange: ((lastBar.c - lastBar.o) / lastBar.o * 100).toFixed(2) + '%',
      },
    };
  } catch {
    return null;
  }
}

/**
 * Scan for breakout: price breaking above resistance with momentum
 */
export async function scanBreakout(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const levelsData = await calculateLevels(symbol, 'intraday');
    const { currentPrice, levels } = levelsData;
    const atr = levels.indicators.atr14 || 0;

    if (!atr) return null;

    // Check if price is above the nearest resistance (just broke through)
    for (const resistance of levels.resistance.slice(0, 3)) {
      const distanceAbove = currentPrice - resistance.price;
      const distancePct = distanceAbove / currentPrice * 100;

      // Price is 0-0.3% above resistance = potential breakout
      if (distancePct > 0 && distancePct < 0.3) {
        const confidence = Math.max(0.4, Math.min(0.8, 0.5 + distancePct));

        return {
          type: 'breakout',
          symbol,
          direction: 'bullish',
          confidence,
          currentPrice,
          triggerPrice: resistance.price,
          description: `${symbol} breaking above ${resistance.type} at $${resistance.price.toFixed(2)}`,
          levels: {
            entry: currentPrice,
            stopLoss: resistance.price - atr * 0.3,
            target: currentPrice + atr * 2,
          },
          metadata: {
            levelType: resistance.type,
            levelPrice: resistance.price,
            distanceAbove: distanceAbove.toFixed(2),
            atr,
          },
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Scan for breakdown: price breaking below support with momentum
 */
export async function scanBreakdown(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const levelsData = await calculateLevels(symbol, 'intraday');
    const { currentPrice, levels } = levelsData;
    const atr = levels.indicators.atr14 || 0;

    if (!atr) return null;

    for (const support of levels.support.slice(0, 3)) {
      const distanceBelow = support.price - currentPrice;
      const distancePct = distanceBelow / currentPrice * 100;

      if (distancePct > 0 && distancePct < 0.3) {
        const confidence = Math.max(0.4, Math.min(0.8, 0.5 + distancePct));

        return {
          type: 'breakdown',
          symbol,
          direction: 'bearish',
          confidence,
          currentPrice,
          triggerPrice: support.price,
          description: `${symbol} breaking below ${support.type} at $${support.price.toFixed(2)}`,
          levels: {
            entry: currentPrice,
            stopLoss: support.price + atr * 0.3,
            target: currentPrice - atr * 2,
          },
          metadata: {
            levelType: support.type,
            levelPrice: support.price,
            distanceBelow: distanceBelow.toFixed(2),
            atr,
          },
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate simple moving average from daily data
 */
function calculateSMA(data: MassiveAggregate[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((sum, bar) => sum + bar.c, 0) / period;
}

/**
 * Calculate RSI from daily data
 */
function calculateRSI(data: MassiveAggregate[], period: number = 14): number | null {
  if (data.length < period + 1) return null;

  const changes = [];
  for (let i = data.length - period; i < data.length; i++) {
    changes.push(data[i].c - data[i - 1].c);
  }

  const gains = changes.filter(c => c > 0);
  const losses = changes.filter(c => c < 0).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, l) => s + l, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Scan for MA crossover (9 EMA crossing 21 EMA)
 */
export async function scanMACrossover(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const dailyData = await fetchDailyData(symbol, 30);
    if (dailyData.length < 22) return null;

    const sma9 = calculateSMA(dailyData, 9);
    const sma21 = calculateSMA(dailyData, 21);

    // Also calculate for previous day to detect crossover
    const prevData = dailyData.slice(0, -1);
    const prevSma9 = calculateSMA(prevData, 9);
    const prevSma21 = calculateSMA(prevData, 21);

    if (!sma9 || !sma21 || !prevSma9 || !prevSma21) return null;

    const currentPrice = dailyData[dailyData.length - 1].c;

    // Golden cross: 9 SMA crosses above 21 SMA
    if (prevSma9 <= prevSma21 && sma9 > sma21) {
      return {
        type: 'ma_crossover',
        symbol,
        direction: 'bullish',
        confidence: 0.6,
        currentPrice,
        triggerPrice: sma21,
        description: `${symbol} 9-day SMA crossed above 21-day SMA (bullish crossover)`,
        metadata: {
          sma9: sma9.toFixed(2),
          sma21: sma21.toFixed(2),
          crossoverType: 'golden',
        },
      };
    }

    // Death cross: 9 SMA crosses below 21 SMA
    if (prevSma9 >= prevSma21 && sma9 < sma21) {
      return {
        type: 'ma_crossover',
        symbol,
        direction: 'bearish',
        confidence: 0.6,
        currentPrice,
        triggerPrice: sma21,
        description: `${symbol} 9-day SMA crossed below 21-day SMA (bearish crossover)`,
        metadata: {
          sma9: sma9.toFixed(2),
          sma21: sma21.toFixed(2),
          crossoverType: 'death',
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Scan for RSI extremes (oversold/overbought)
 */
export async function scanRSIDivergence(symbol: string): Promise<TechnicalSetup | null> {
  try {
    const dailyData = await fetchDailyData(symbol, 30);
    if (dailyData.length < 16) return null;

    const rsi = calculateRSI(dailyData, 14);
    if (rsi === null) return null;

    const currentPrice = dailyData[dailyData.length - 1].c;

    // Oversold (RSI < 30)
    if (rsi < 30) {
      return {
        type: 'rsi_divergence',
        symbol,
        direction: 'bullish',
        confidence: Math.min(0.8, 0.5 + (30 - rsi) * 0.02),
        currentPrice,
        triggerPrice: currentPrice,
        description: `${symbol} RSI oversold at ${rsi.toFixed(1)} - potential reversal`,
        metadata: {
          rsi: rsi.toFixed(1),
          condition: 'oversold',
        },
      };
    }

    // Overbought (RSI > 70)
    if (rsi > 70) {
      return {
        type: 'rsi_divergence',
        symbol,
        direction: 'bearish',
        confidence: Math.min(0.8, 0.5 + (rsi - 70) * 0.02),
        currentPrice,
        triggerPrice: currentPrice,
        description: `${symbol} RSI overbought at ${rsi.toFixed(1)} - potential reversal`,
        metadata: {
          rsi: rsi.toFixed(1),
          condition: 'overbought',
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Run all technical scanners for a symbol
 */
export async function runTechnicalScan(symbol: string): Promise<TechnicalSetup[]> {
  const results = await Promise.allSettled([
    scanSupportBounce(symbol),
    scanResistanceRejection(symbol),
    scanBreakout(symbol),
    scanBreakdown(symbol),
    scanVolumeSpike(symbol),
    scanMACrossover(symbol),
    scanRSIDivergence(symbol),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<TechnicalSetup | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}
