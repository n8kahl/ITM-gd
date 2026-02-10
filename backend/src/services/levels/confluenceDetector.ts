import type { FibonacciRetracement } from './calculators/fibonacciRetracement';
import type { LevelsResponse } from './index';

export interface ConfluenceZone {
  priceCenter: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  levelsInZone: Array<{
    type: string;
    price: number;
    source: 'key_levels' | 'fibonacci' | 'gex';
  }>;
  strength: 'strong' | 'moderate' | 'weak';
  side: 'resistance' | 'support';
  description: string;
}

interface ConfluencePoint {
  type: string;
  price: number;
  source: 'key_levels' | 'fibonacci' | 'gex';
}

const CONFLUENCE_THRESHOLD_PCT = 0.003; // 0.3%

/**
 * Detect zones where multiple independent levels cluster in price.
 *
 * @param levels - Core key-level response.
 * @param fib - Optional Fibonacci levels.
 * @param gexLevels - Optional GEX anchors.
 * @param currentPrice - Current price for support/resistance side assignment.
 * @returns Sorted confluence zones (strongest first).
 */
export function detectConfluence(
  levels: LevelsResponse,
  fib?: FibonacciRetracement | null,
  gexLevels?: { flipPoint: number | null; maxGEXStrike: number | null } | null,
  currentPrice?: number,
): ConfluenceZone[] {
  const allPoints: ConfluencePoint[] = [];

  for (const level of levels.levels.resistance) {
    allPoints.push({ type: level.type, price: level.price, source: 'key_levels' });
  }
  for (const level of levels.levels.support) {
    allPoints.push({ type: level.type, price: level.price, source: 'key_levels' });
  }

  if (fib) {
    for (const [levelName, levelPrice] of Object.entries(fib.levels)) {
      const ratioName = levelName.replace('level_', '');
      allPoints.push({
        type: `Fib ${ratioName}%`,
        price: levelPrice,
        source: 'fibonacci',
      });
    }
  }

  if (gexLevels?.flipPoint != null) {
    allPoints.push({ type: 'GEX Flip', price: gexLevels.flipPoint, source: 'gex' });
  }
  if (gexLevels?.maxGEXStrike != null) {
    allPoints.push({ type: 'GEX Max', price: gexLevels.maxGEXStrike, source: 'gex' });
  }

  allPoints.sort((a, b) => a.price - b.price);

  const zones: ConfluenceZone[] = [];
  const usedIndexes = new Set<number>();

  for (let i = 0; i < allPoints.length; i += 1) {
    if (usedIndexes.has(i)) continue;

    const anchor = allPoints[i];
    const cluster: ConfluencePoint[] = [anchor];
    usedIndexes.add(i);

    for (let j = i + 1; j < allPoints.length; j += 1) {
      if (usedIndexes.has(j)) continue;
      const point = allPoints[j];
      const pctDistance = Math.abs(point.price - anchor.price) / Math.max(anchor.price, 0.01);
      if (pctDistance <= CONFLUENCE_THRESHOLD_PCT) {
        cluster.push(point);
        usedIndexes.add(j);
      }
    }

    if (cluster.length < 2) {
      continue;
    }

    const prices = cluster.map((point) => point.price);
    const center = prices.reduce((sum, value) => sum + value, 0) / prices.length;
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    const strength: ConfluenceZone['strength'] = cluster.length >= 4
      ? 'strong'
      : cluster.length >= 3
        ? 'moderate'
        : 'weak';

    const side: ConfluenceZone['side'] = currentPrice != null
      ? (center >= currentPrice ? 'resistance' : 'support')
      : 'resistance';

    zones.push({
      priceCenter: Number(center.toFixed(2)),
      priceRangeLow: Number(low.toFixed(2)),
      priceRangeHigh: Number(high.toFixed(2)),
      levelsInZone: cluster.map((point) => ({
        type: point.type,
        price: Number(point.price.toFixed(2)),
        source: point.source,
      })),
      strength,
      side,
      description: `${cluster.length}-way confluence near $${center.toFixed(2)}`,
    });
  }

  const strengthScore: Record<ConfluenceZone['strength'], number> = {
    strong: 3,
    moderate: 2,
    weak: 1,
  };

  return zones.sort((a, b) => strengthScore[b.strength] - strengthScore[a.strength]);
}

/**
 * Format confluence zones into concise bullet text for AI response context.
 */
export function formatConfluenceForAI(zones: ConfluenceZone[]): string {
  if (zones.length === 0) {
    return 'No significant confluence zones detected.';
  }

  const lines = zones.map((zone) => {
    const members = zone.levelsInZone
      .map((level) => `${level.type} ($${level.price.toFixed(2)})`)
      .join(', ');

    return `• ${zone.strength.toUpperCase()} ${zone.side} near $${zone.priceCenter.toFixed(2)} (${zone.levelsInZone.length} levels): ${members}`;
  });

  return `CONFLUENCE ZONES:\n${lines.join('\n')}`;
}

