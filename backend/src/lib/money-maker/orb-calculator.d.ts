import { CandleBar } from './types';
export interface ORBData {
    high: number;
    low: number;
}
export type ORBRegime = 'trending_up' | 'trending_down' | 'choppy';
/**
 * Computes Original Range Breakout (ORB) given the first 15 mins of bars.
 * Expected input: Bars strictly from 9:30 to 9:45 ET.
 */
export declare function computeORB(bars: CandleBar[]): ORBData | null;
/**
 * Determines the current market regime based on price and ORB.
 * Re-evaluated on every bar close (not cached) per spec.
 */
export declare function determineRegime(currentPrice: number, orb: ORBData | null): ORBRegime;
//# sourceMappingURL=orb-calculator.d.ts.map