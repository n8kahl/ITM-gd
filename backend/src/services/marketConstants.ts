
import { logger } from '../lib/logger';

// Cache for API-fetched values
let cachedRiskFreeRate: number | null = null;
const cachedDividendYields: Map<string, number> = new Map();
let lastRateRefresh: number = 0; // Initialize to 0 so first call refreshes
const lastDividendRefresh: number = 0;

const RATE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DIVIDEND_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Fallback values (used if API unavailable)
const FALLBACK_RISK_FREE_RATE = 0.045;
const FALLBACK_DIVIDEND_YIELDS: Record<string, number> = {
    'SPX': 0.014, 'NDX': 0.007, 'QQQ': 0.006,
    'SPY': 0.013, 'IWM': 0.012, 'DIA': 0.018,
    'AAPL': 0.005, 'MSFT': 0.007, 'AMZN': 0.0,
    'GOOGL': 0.005, 'META': 0.004, 'TSLA': 0.0,
    'NVDA': 0.0003,
};
const DEFAULT_DIVIDEND_YIELD = 0.005;

/**
 * Get current risk-free rate.
 * Phase 1: Returns hardcoded fallback.
 * Phase 2+: Will fetch from Treasury yield endpoint if available.
 */
export async function getRiskFreeRate(): Promise<number> {
    if (cachedRiskFreeRate && (Date.now() - lastRateRefresh) < RATE_REFRESH_INTERVAL_MS) {
        return cachedRiskFreeRate;
    }

    try {
        // TODO Phase 5: Fetch from Massive.com Treasury Yields endpoint
        // const yields = await getTreasuryYields();
        // cachedRiskFreeRate = yields.tenYear / 100;
        cachedRiskFreeRate = FALLBACK_RISK_FREE_RATE;
        lastRateRefresh = Date.now();
        return cachedRiskFreeRate;
    } catch (error) {
        logger.warn('Failed to fetch risk-free rate, using fallback', { error });
        return FALLBACK_RISK_FREE_RATE;
    }
}

/**
 * Get dividend yield for a symbol.
 * Phase 0: Returns from static map.
 * Phase 1+: Fetches from Massive.com Dividends Reference endpoint.
 */
export async function getDividendYield(symbol: string): Promise<number> {
    const normalizedSymbol = symbol.replace('I:', '').toUpperCase();

    // Check cache first
    if (cachedDividendYields.has(normalizedSymbol) &&
        (Date.now() - lastDividendRefresh) < DIVIDEND_REFRESH_INTERVAL_MS) {
        return cachedDividendYields.get(normalizedSymbol)!;
    }

    // Fallback to static map
    return FALLBACK_DIVIDEND_YIELDS[normalizedSymbol] ?? DEFAULT_DIVIDEND_YIELD;
}

/**
 * Batch refresh dividend yields from API.
 * Called on startup and periodically.
 */
export async function refreshDividendYields(symbols: string[]): Promise<void> {
    // Implementation in Phase 1, Task 1.5
    // For now, this is a placeholder
    logger.info(`Refreshing dividend yields for ${symbols.length} symbols (placeholder)`);
    return Promise.resolve();
}

export { FALLBACK_RISK_FREE_RATE, DEFAULT_DIVIDEND_YIELD };
