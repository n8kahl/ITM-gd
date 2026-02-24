import { fetchOptionsChain } from '../options/optionsChainFetcher';
import { detectFlowAnomaly } from './flowAnomalyScanner';
import { logger } from '../../lib/logger';

/**
 * Options-based scanning algorithms for detecting trading opportunities
 */

export interface OptionsSetup {
  type: 'high_iv' | 'unusual_activity' | 'iv_crush';
  symbol: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-1
  currentPrice: number;
  description: string;
  suggestedTrade?: {
    strategy: string;
    strikes: number[];
    expiry: string;
    estimatedCredit?: number;
    estimatedDebit?: number;
    maxProfit?: string;
    maxLoss?: string;
    probability?: string;
  };
  metadata: Record<string, any>;
}

const SCANNER_TIMEOUT_MS = 5000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Scan for high implied volatility (use with caution for long premium)
 */
export async function scanHighIV(symbol: string): Promise<OptionsSetup | null> {
  try {
    const chain = await withTimeout(
      fetchOptionsChain(symbol, undefined, 5),
      SCANNER_TIMEOUT_MS,
      `scanHighIV chain ${symbol}`,
    );
    if (!chain.options.calls.length && !chain.options.puts.length) return null;

    // Calculate average IV across ATM options
    const atmCalls = chain.options.calls.filter(c => Math.abs(c.strike - chain.currentPrice) / chain.currentPrice < 0.01);
    const atmPuts = chain.options.puts.filter(p => Math.abs(p.strike - chain.currentPrice) / chain.currentPrice < 0.01);

    const allATM = [...atmCalls, ...atmPuts];
    if (allATM.length === 0) return null;

    const avgIV = allATM.reduce((sum, o) => sum + o.impliedVolatility, 0) / allATM.length;

    // High IV threshold: > 25% for indices
    if (avgIV < 0.25) return null;

    const ivPct = (avgIV * 100).toFixed(1);
    const confidence = Math.min(0.85, 0.4 + (avgIV - 0.25) * 2);

    // TITM only trades single-leg options and stock.
    // When IV is elevated we still surface the signal, but avoid spread/condor suggestions.
    const nearestStrike = Math.round(chain.currentPrice / 5) * 5;

    return {
      type: 'high_iv',
      symbol,
      direction: 'neutral',
      confidence,
      currentPrice: chain.currentPrice,
      description: `${symbol} ATM IV elevated at ${ivPct}% - favor high-conviction directional setups with tighter risk`,
      suggestedTrade: {
        strategy: 'Single-Leg Momentum Option',
        strikes: [nearestStrike],
        expiry: chain.expiry,
        maxProfit: 'Manage with scaling/trailing stops',
        maxLoss: 'Premium paid',
      },
      metadata: {
        avgIV: ivPct + '%',
        daysToExpiry: chain.daysToExpiry,
        ivRank: chain.ivRank,
      },
    };
  } catch (error) {
    logger.warn('Scanner failed: scanHighIV', {
      scanner: 'scanHighIV',
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Scan for unusual options activity (volume >> open interest)
 */
export async function scanUnusualActivity(symbol: string): Promise<OptionsSetup | null> {
  try {
    const chain = await withTimeout(
      fetchOptionsChain(symbol, undefined, 10),
      SCANNER_TIMEOUT_MS,
      `scanUnusualActivity chain ${symbol}`,
    );
    if (!chain.options.calls.length && !chain.options.puts.length) return null;

    const anomaly = detectFlowAnomaly(chain);
    if (!anomaly) return null;

    const ratio = anomaly.volumeOIRatio.toFixed(1);
    const direction = anomaly.direction;
    const confidence = Math.min(0.88, 0.35 + (anomaly.anomalyScore * 0.6));

    return {
      type: 'unusual_activity',
      symbol,
      direction,
      confidence,
      currentPrice: chain.currentPrice,
      description: `${symbol} ${anomaly.contract.type} flow anomaly: $${anomaly.contract.strike} strike scored ${(anomaly.anomalyScore * 100).toFixed(0)} anomaly percentile`,
      metadata: {
        contractType: anomaly.contract.type,
        strike: anomaly.contract.strike,
        expiry: anomaly.contract.expiry,
        volume: anomaly.contract.volume,
        openInterest: anomaly.contract.openInterest,
        volumeOIRatio: ratio,
        iv: (anomaly.contract.impliedVolatility * 100).toFixed(1) + '%',
        anomalyScore: Number(anomaly.anomalyScore.toFixed(4)),
        anomalyFeatures: {
          volumeOiZScore: Number(anomaly.features.volumeOiZScore.toFixed(4)),
          premiumMomentum: Number(anomaly.features.premiumMomentum.toFixed(4)),
          spreadTighteningRatio: Number(anomaly.features.spreadTighteningRatio.toFixed(4)),
          sweepIntensity: Number(anomaly.features.sweepIntensity.toFixed(4)),
          timeOfDayNormalizedVolume: Number(anomaly.features.timeOfDayNormalizedVolume.toFixed(4)),
        },
      },
    };
  } catch (error) {
    logger.warn('Scanner failed: scanUnusualActivity', {
      scanner: 'scanUnusualActivity',
      symbol,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Run all options scanners for a symbol
 */
export async function runOptionsScan(symbol: string): Promise<OptionsSetup[]> {
  const results = await Promise.allSettled([
    scanHighIV(symbol),
    scanUnusualActivity(symbol),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<OptionsSetup | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}
