"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankSignals = rankSignals;
/**
 * Ranks an array of signals and assigns their signalRank property directly.
 * Sorting priority:
 * 1. Confluence score (descending)
 * 2. Risk:Reward ratio (descending)
 * 3. Trend strength (descending)
 */
function rankSignals(signals) {
    const sorted = [...signals].sort((a, b) => {
        // 1. Confluence score
        if (a.confluenceZone.score !== b.confluenceZone.score) {
            return b.confluenceZone.score - a.confluenceZone.score;
        }
        // 2. Risk:Reward
        if (a.riskRewardRatio !== b.riskRewardRatio) {
            return b.riskRewardRatio - a.riskRewardRatio;
        }
        // 3. Trend strength
        return b.trendStrength - a.trendStrength;
    });
    // Assign ranks
    sorted.forEach((signal, index) => {
        signal.signalRank = index + 1;
    });
    return sorted;
}
//# sourceMappingURL=signal-ranker.js.map