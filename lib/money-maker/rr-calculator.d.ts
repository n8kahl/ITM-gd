import { CandleBar } from './types';
export interface RRCalculatorParams {
    patienceCandle: CandleBar;
    direction: 'long' | 'short';
    nextLevel: number;
    tickSize?: number;
}
export interface RRResult {
    entry: number;
    stop: number;
    target: number;
    risk: number;
    reward: number;
    riskRewardRatio: number;
    isValid: boolean;
}
/**
 * Calculates Entry, Stop, Target, Risk, and Reward based on
 * the patience candle limits and the next target level.
 * Implements section 8 of the execution spec.
 */
export declare function calculateRR(params: RRCalculatorParams): RRResult;
//# sourceMappingURL=rr-calculator.d.ts.map