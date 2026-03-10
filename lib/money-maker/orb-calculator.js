"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeORB = computeORB;
exports.determineRegime = determineRegime;
/**
 * Computes Original Range Breakout (ORB) given the first 15 mins of bars.
 * Expected input: Bars strictly from 9:30 to 9:45 ET.
 */
function computeORB(bars) {
    if (bars.length === 0)
        return null;
    let high = -Infinity;
    let low = Infinity;
    for (const bar of bars) {
        if (bar.high > high)
            high = bar.high;
        if (bar.low < low)
            low = bar.low;
    }
    return { high, low };
}
/**
 * Determines the current market regime based on price and ORB.
 * Re-evaluated on every bar close (not cached) per spec.
 */
function determineRegime(currentPrice, orb) {
    if (!orb)
        return 'choppy'; // default to choppy if no ORB is established yet
    if (currentPrice > orb.high) {
        return 'trending_up';
    }
    else if (currentPrice < orb.low) {
        return 'trending_down';
    }
    else {
        // If inside the ORB levels (inclusive)
        return 'choppy';
    }
}
//# sourceMappingURL=orb-calculator.js.map