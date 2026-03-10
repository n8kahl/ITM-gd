"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRR = calculateRR;
/**
 * Calculates Entry, Stop, Target, Risk, and Reward based on
 * the patience candle limits and the next target level.
 * Implements section 8 of the execution spec.
 */
function calculateRR(params) {
    const { patienceCandle, direction, nextLevel, tickSize = 0.01 } = params;
    let entry = 0;
    let stop = 0;
    if (direction === 'long') {
        entry = patienceCandle.high + tickSize;
        stop = patienceCandle.low - tickSize;
    }
    else {
        entry = patienceCandle.low - tickSize;
        stop = patienceCandle.high + tickSize;
    }
    const risk = Math.abs(entry - stop);
    const reward = Math.abs(nextLevel - entry);
    // Guard against divide by zero (0 risk)
    const riskRewardRatio = risk > 0 ? reward / risk : 0;
    return {
        entry: Number(entry.toFixed(2)),
        stop: Number(stop.toFixed(2)),
        target: Number(nextLevel.toFixed(2)),
        risk: Number(risk.toFixed(2)),
        reward: Number(reward.toFixed(2)),
        riskRewardRatio: Number(riskRewardRatio.toFixed(2)),
        isValid: riskRewardRatio >= 2.0
    };
}
//# sourceMappingURL=rr-calculator.js.map