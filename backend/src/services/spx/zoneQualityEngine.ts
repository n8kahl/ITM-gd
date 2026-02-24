import type { ClusterZone, Regime, SPXVixRegime } from './types';
import { round } from './utils';

export interface ZoneQualityScore {
  zoneId: string;
  fortressScore: number;
  structureScore: number;
  touchHistoryScore: number;
  compositeScore: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function directionalDistanceScore(distancePoints: number): number {
  if (!Number.isFinite(distancePoints)) return 0;
  if (distancePoints <= 2) return 100;
  if (distancePoints <= 5) return 82;
  if (distancePoints <= 10) return 64;
  if (distancePoints <= 16) return 45;
  return 28;
}

function typeBaseScore(zoneType: ClusterZone['type']): number {
  if (zoneType === 'fortress') return 92;
  if (zoneType === 'defended') return 76;
  if (zoneType === 'moderate') return 58;
  return 42;
}

export function scoreZoneQuality(input: {
  zone: ClusterZone;
  currentPrice: number;
}): ZoneQualityScore {
  const zoneCenter = (input.zone.priceLow + input.zone.priceHigh) / 2;
  const zoneWidth = Math.max(0.25, Math.abs(input.zone.priceHigh - input.zone.priceLow));
  const zoneDistance = Math.abs(zoneCenter - input.currentPrice);

  const clusterStrength = clamp((toFiniteNumber(input.zone.clusterScore) || 0) * 20);
  const baseTypeScore = typeBaseScore(input.zone.type);
  const fortressScore = round(clamp((clusterStrength * 0.7) + (baseTypeScore * 0.3)));

  const sourceDepth = clamp((input.zone.sources.length / 5) * 100);
  const widthPenalty = clamp((zoneWidth - 1.5) * 12, 0, 22);
  const structureScore = round(clamp(
    (directionalDistanceScore(zoneDistance) * 0.55)
    + (sourceDepth * 0.35)
    + (clusterStrength * 0.10)
    - widthPenalty,
  ));

  const tests = Math.max(0, toFiniteNumber(input.zone.testCount) || 0);
  const holdRate = clamp(toFiniteNumber(input.zone.holdRate) || 50);
  const recencyBonus = input.zone.lastTestAt ? 7 : 0;
  const sampleConfidence = tests >= 8 ? 100 : tests >= 4 ? 75 : tests >= 2 ? 55 : tests >= 1 ? 40 : 25;
  const touchHistoryScore = round(clamp(
    (holdRate * 0.65)
    + (sampleConfidence * 0.30)
    + recencyBonus,
  ));

  const compositeScore = round(clamp(
    (fortressScore * 0.40)
    + (structureScore * 0.35)
    + (touchHistoryScore * 0.25),
  ));

  return {
    zoneId: input.zone.id,
    fortressScore,
    structureScore,
    touchHistoryScore,
    compositeScore,
  };
}

export function minZoneQualityThreshold(input: {
  regime: Regime;
  vixRegime: SPXVixRegime;
}): number {
  let threshold = 45;
  if (input.regime === 'breakout' || input.regime === 'trending') {
    threshold = 42;
  }
  if (input.regime === 'compression') {
    threshold = Math.max(threshold, 50);
  }

  if (input.vixRegime === 'elevated') {
    threshold = Math.max(threshold, 52);
  } else if (input.vixRegime === 'extreme') {
    threshold = Math.max(threshold, 60);
  }

  return threshold;
}

export function selectBestZonesForEntry(input: {
  zones: ClusterZone[];
  currentPrice: number;
  regime: Regime;
  vixRegime: SPXVixRegime;
  maxZones?: number;
}): Array<{ zone: ClusterZone; quality: ZoneQualityScore }> {
  const maxZones = Number.isFinite(input.maxZones)
    ? Math.max(1, Math.floor(input.maxZones as number))
    : 3;
  const minQuality = minZoneQualityThreshold({
    regime: input.regime,
    vixRegime: input.vixRegime,
  });

  const scored = input.zones.map((zone) => ({
    zone,
    quality: scoreZoneQuality({
      zone,
      currentPrice: input.currentPrice,
    }),
  }));

  const filtered = scored
    .filter((item) => item.quality.compositeScore >= minQuality)
    .sort((a, b) => {
      if (b.quality.compositeScore !== a.quality.compositeScore) {
        return b.quality.compositeScore - a.quality.compositeScore;
      }
      return b.zone.clusterScore - a.zone.clusterScore;
    })
    .slice(0, maxZones);

  if (filtered.length > 0) {
    return filtered;
  }

  return scored
    .sort((a, b) => b.quality.compositeScore - a.quality.compositeScore)
    .slice(0, maxZones);
}
