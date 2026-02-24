import { fetchOptionsChain } from '../options/optionsChainFetcher';
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

    const allOptions = [...chain.options.calls, ...chain.options.puts];

    // Find options where volume > 3x open interest (unusual)
    const unusual = allOptions.filter(o =>
      o.openInterest > 0 &&
      o.volume > 0 &&
      o.volume / o.openInterest > 3
    );

    if (unusual.length === 0) return null;

    // Sort by volume/OI ratio
    unusual.sort((a, b) => (b.volume / b.openInterest) - (a.volume / a.openInterest));

    const top = unusual[0];
    const ratio = (top.volume / top.openInterest).toFixed(1);
    const direction = top.type === 'call' ? 'bullish' : 'bearish';

    return {
      type: 'unusual_activity',
      symbol,
      direction,
      confidence: Math.min(0.75, 0.35 + (top.volume / top.openInterest - 3) * 0.1),
      currentPrice: chain.currentPrice,
      description: `${symbol} unusual ${top.type} activity: $${top.strike} strike has ${ratio}x volume/OI ratio`,
      metadata: {
        contractType: top.type,
        strike: top.strike,
        expiry: top.expiry,
        volume: top.volume,
        openInterest: top.openInterest,
        volumeOIRatio: ratio,
        iv: (top.impliedVolatility * 100).toFixed(1) + '%',
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
