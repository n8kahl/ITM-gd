import crypto from 'crypto';
import { runTechnicalScan, TechnicalSetup } from './technicalScanner';
import { runOptionsScan, OptionsSetup } from './optionsScanner';
import { POPULAR_SYMBOLS } from '../../lib/symbols';
import { logger } from '../../lib/logger';

/**
 * Opportunity Scanner - orchestrates all scanning algorithms
 * and scores results for relevance
 */

export interface Opportunity {
  id: string;
  type: 'technical' | 'options';
  setupType: string;
  symbol: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  score: number; // 0-100
  confidence: number;
  currentPrice: number;
  description: string;
  suggestedTrade?: {
    strategy: string;
    strikes?: number[];
    expiry?: string;
    entry?: number;
    stopLoss?: number;
    target?: number;
    estimatedCredit?: number;
    estimatedDebit?: number;
    maxProfit?: string;
    maxLoss?: string;
    probability?: string;
  };
  metadata: Record<string, any>;
  scannedAt: string;
}

export interface ScanResult {
  opportunities: Opportunity[];
  symbols: string[];
  scanDurationMs: number;
  scannedAt: string;
}

class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.current = Math.max(0, this.current - 1);
  }
}

const DEFAULT_SCANNER_CONCURRENCY = 5;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function resolveScannerConcurrency(): number {
  const parsed = Number.parseInt(process.env.SCANNER_CONCURRENCY ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_SCANNER_CONCURRENCY;
  return parsed;
}

/**
 * Score a technical setup based on confidence, type, and levels
 */
function scoreTechnicalSetup(setup: TechnicalSetup): number {
  let score = setup.confidence * 60; // Base score from confidence (0-54)

  // Bonus for setups with clear entry/exit levels
  if (setup.levels) score += 15;

  // Bonus by setup type (some are more actionable)
  const typeBonus: Record<string, number> = {
    breakout: 10,
    breakdown: 10,
    support_bounce: 8,
    resistance_rejection: 8,
    volume_spike: 12,
    ma_crossover: 5,
    rsi_divergence: 7,
  };
  score += typeBonus[setup.type] || 0;

  return Math.min(100, Math.round(score));
}

/**
 * Score an options setup
 */
function scoreOptionsSetup(setup: OptionsSetup): number {
  let score = setup.confidence * 60;

  if (setup.suggestedTrade) score += 15;
  if (setup.suggestedTrade?.probability) {
    const prob = parseFloat(setup.suggestedTrade.probability);
    if (prob > 70) score += 10;
  }

  const typeBonus: Record<string, number> = {
    high_iv: 8,
    unusual_activity: 12,
    iv_crush: 6,
  };
  score += typeBonus[setup.type] || 0;

  const anomalyScore = setup.metadata?.anomalyScore;
  const anomalyDirection = typeof setup.metadata?.anomalyDirection === 'string'
    ? setup.metadata.anomalyDirection
    : null;
  if (
    typeof anomalyScore === 'number'
    && Number.isFinite(anomalyScore)
    && (anomalyDirection == null || anomalyDirection === setup.direction)
  ) {
    score += clamp(Math.round(anomalyScore * 12), 0, 12);
  }

  return Math.min(100, Math.round(score));
}

/**
 * Convert technical setup to unified Opportunity format
 */
function technicalToOpportunity(setup: TechnicalSetup): Opportunity {
  return {
    id: `tech-${setup.symbol}-${setup.type}-${crypto.randomUUID()}`,
    type: 'technical',
    setupType: setup.type,
    symbol: setup.symbol,
    direction: setup.direction,
    score: scoreTechnicalSetup(setup),
    confidence: setup.confidence,
    currentPrice: setup.currentPrice,
    description: setup.description,
    suggestedTrade: setup.levels ? {
      strategy: setup.type.replace(/_/g, ' '),
      entry: setup.levels.entry,
      stopLoss: setup.levels.stopLoss,
      target: setup.levels.target,
    } : undefined,
    metadata: setup.metadata,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Convert options setup to unified Opportunity format
 */
function optionsToOpportunity(setup: OptionsSetup): Opportunity {
  return {
    id: `opt-${setup.symbol}-${setup.type}-${crypto.randomUUID()}`,
    type: 'options',
    setupType: setup.type,
    symbol: setup.symbol,
    direction: setup.direction,
    score: scoreOptionsSetup(setup),
    confidence: setup.confidence,
    currentPrice: setup.currentPrice,
    description: setup.description,
    suggestedTrade: setup.suggestedTrade,
    metadata: setup.metadata,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Run full scan across symbols
 */
export async function scanOpportunities(
  symbols: string[] = [...POPULAR_SYMBOLS],
  includeOptions: boolean = true,
): Promise<ScanResult> {
  const startTime = Date.now();
  const opportunities: Opportunity[] = [];
  const semaphore = new Semaphore(resolveScannerConcurrency());

  // Run scans with bounded symbol-level concurrency
  const scanPromises = symbols.map(async (symbol) => {
    await semaphore.acquire();
    const symbolOpps: Opportunity[] = [];

    try {
      // Technical scans
      const technicalSetups = await runTechnicalScan(symbol);
      for (const setup of technicalSetups) {
        symbolOpps.push(technicalToOpportunity(setup));
      }

      // Options scans (optional, more expensive)
      if (includeOptions) {
        const optionsSetups = await runOptionsScan(symbol);
        for (const setup of optionsSetups) {
          symbolOpps.push(optionsToOpportunity(setup));
        }
      }
    } finally {
      semaphore.release();
    }

    return symbolOpps;
  });

  const results = await Promise.allSettled(scanPromises);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      opportunities.push(...result.value);
    } else {
      logger.warn('Symbol scan failed', {
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  // Sort by score descending
  opportunities.sort((a, b) => b.score - a.score);

  return {
    opportunities,
    symbols,
    scanDurationMs: Date.now() - startTime,
    scannedAt: new Date().toISOString(),
  };
}
