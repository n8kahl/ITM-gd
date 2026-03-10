"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLevelProximityTolerance = getLevelProximityTolerance;
exports.buildConfluenceZones = buildConfluenceZones;
/**
 * Returns the proximity tolerance based on current price and timeframe.
 * Spec 4.4:
 * 2-min: ±0.15% of price
 * 5-min: ±0.20% of price
 * 10-min: ±0.25% of price
 */
function getLevelProximityTolerance(price, timeframe = '5m') {
    switch (timeframe) {
        case '2m': return price * 0.0015;
        case '5m': return price * 0.0020;
        case '10m': return price * 0.0025;
        default: return price * 0.0020;
    }
}
/**
 * Clusters an array of disparate indicator levels into scored confluence zones.
 * Filters out any zone with a score < 2.0 per spec 5.2.
 */
function buildConfluenceZones(levels, referencePrice, timeframe = '5m') {
    if (levels.length === 0)
        return [];
    const tolerance = getLevelProximityTolerance(referencePrice, timeframe);
    // Sort ascending by price
    const sorted = [...levels].sort((a, b) => a.price - b.price);
    const zones = [];
    let currentZoneLevels = [sorted[0]];
    let currentZoneMax = sorted[0].price;
    for (let i = 1; i < sorted.length; i++) {
        const level = sorted[i];
        // Cluster if the distance from the new level to the highest level in the current zone is within tolerance
        if (level.price - currentZoneMax <= tolerance) {
            currentZoneLevels.push(level);
            currentZoneMax = level.price;
        }
        else {
            // Finalize current zone, start a new one
            zones.push(finalizeZone(currentZoneLevels));
            currentZoneLevels = [level];
            currentZoneMax = level.price;
        }
    }
    // Add the last zone
    zones.push(finalizeZone(currentZoneLevels));
    // Filter out any zone with score < 2.0 per spec 5.2
    return zones.filter(z => z.score >= 2.0);
}
function finalizeZone(levels) {
    const score = levels.reduce((acc, l) => acc + l.weight, 0);
    const isKingQueen = levels.some(l => l.source === 'VWAP' || l.source.includes('VWAP'));
    let label = 'moderate';
    if (score >= 4.0) {
        label = 'fortress';
    }
    else if (score >= 3.0) {
        label = 'strong';
    }
    return {
        priceLow: Math.min(...levels.map(l => l.price)),
        priceHigh: Math.max(...levels.map(l => l.price)),
        score: Number(score.toFixed(1)), // Fix precision issues
        label,
        levels: [...levels],
        isKingQueen
    };
}
//# sourceMappingURL=confluence-detector.js.map