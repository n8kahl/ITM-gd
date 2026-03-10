import { ConfluenceLevel, ConfluenceZone } from './types';
/**
 * Returns the proximity tolerance based on current price and timeframe.
 * Spec 4.4:
 * 2-min: ±0.15% of price
 * 5-min: ±0.20% of price
 * 10-min: ±0.25% of price
 */
export declare function getLevelProximityTolerance(price: number, timeframe?: '2m' | '5m' | '10m'): number;
/**
 * Clusters an array of disparate indicator levels into scored confluence zones.
 * Filters out any zone with a score < 2.0 per spec 5.2.
 */
export declare function buildConfluenceZones(levels: ConfluenceLevel[], referencePrice: number, timeframe?: '2m' | '5m' | '10m'): ConfluenceZone[];
//# sourceMappingURL=confluence-detector.d.ts.map