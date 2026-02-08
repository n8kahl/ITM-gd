import { fetchOptionsChain } from '../options/optionsChainFetcher';

/**
 * Options-based scanning algorithms for detecting trading opportunities
 */

export interface OptionsSetup {
  type: 'high_iv' | 'unusual_activity' | 'iv_crush' | 'high_prob_spread';
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

/**
 * Scan for high implied volatility (good for selling premium)
 */
export async function scanHighIV(symbol: string): Promise<OptionsSetup | null> {
  try {
    const chain = await fetchOptionsChain(symbol, undefined, 5);
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

    // Suggest iron condor for high IV
    const callStrike = Math.ceil(chain.currentPrice * 1.02 / 5) * 5;
    const putStrike = Math.floor(chain.currentPrice * 0.98 / 5) * 5;

    return {
      type: 'high_iv',
      symbol,
      direction: 'neutral',
      confidence,
      currentPrice: chain.currentPrice,
      description: `${symbol} ATM IV elevated at ${ivPct}% - favorable for premium selling`,
      suggestedTrade: {
        strategy: 'Iron Condor',
        strikes: [putStrike - 10, putStrike, callStrike, callStrike + 10],
        expiry: chain.expiry,
        maxProfit: 'Net credit received',
        maxLoss: 'Width of spread minus credit',
        probability: '>60%',
      },
      metadata: {
        avgIV: ivPct + '%',
        daysToExpiry: chain.daysToExpiry,
        ivRank: chain.ivRank,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Scan for unusual options activity (volume >> open interest)
 */
export async function scanUnusualActivity(symbol: string): Promise<OptionsSetup | null> {
  try {
    const chain = await fetchOptionsChain(symbol, undefined, 10);
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
  } catch {
    return null;
  }
}

/**
 * Scan for high-probability credit spread opportunities
 */
export async function scanHighProbSpreads(symbol: string): Promise<OptionsSetup | null> {
  try {
    const chain = await fetchOptionsChain(symbol, undefined, 15);
    if (!chain.options.puts.length || !chain.options.calls.length) return null;

    // Look for OTM put spreads with delta < 0.20 (>80% probability)
    const otmPuts = chain.options.puts
      .filter(p => p.delta && Math.abs(p.delta) < 0.20 && Math.abs(p.delta) > 0.05)
      .sort((a, b) => (b.strike) - (a.strike)); // highest strike first (closest to ATM)

    if (otmPuts.length < 2) return null;

    const shortPut = otmPuts[0]; // sell this
    const longPut = chain.options.puts
      .find(p => p.strike === shortPut.strike - 5 || p.strike === shortPut.strike - 10);

    if (!longPut) return null;

    const credit = (shortPut.bid - longPut.ask);
    if (credit <= 0) return null;

    const width = shortPut.strike - longPut.strike;
    const maxLoss = width - credit;
    const probability = shortPut.delta ? ((1 - Math.abs(shortPut.delta)) * 100).toFixed(0) : '80';

    return {
      type: 'high_prob_spread',
      symbol,
      direction: 'bullish',
      confidence: 0.65,
      currentPrice: chain.currentPrice,
      description: `${symbol} bull put spread: sell $${shortPut.strike}/$${longPut.strike} for $${credit.toFixed(2)} credit (~${probability}% prob)`,
      suggestedTrade: {
        strategy: 'Bull Put Spread',
        strikes: [longPut.strike, shortPut.strike],
        expiry: chain.expiry,
        estimatedCredit: credit,
        maxProfit: `$${(credit * 100).toFixed(0)}`,
        maxLoss: `$${(maxLoss * 100).toFixed(0)}`,
        probability: probability + '%',
      },
      metadata: {
        shortDelta: shortPut.delta?.toFixed(3),
        shortIV: (shortPut.impliedVolatility * 100).toFixed(1) + '%',
        daysToExpiry: chain.daysToExpiry,
        creditReceived: credit.toFixed(2),
        riskReward: (maxLoss / credit).toFixed(1),
      },
    };
  } catch {
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
    scanHighProbSpreads(symbol),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<OptionsSetup | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value!);
}
