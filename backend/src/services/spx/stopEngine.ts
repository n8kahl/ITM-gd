import type { Regime, Setup, SetupType, SPXVixRegime } from './types';
import { round } from './utils';

const MIN_STOP_DISTANCE_POINTS = 0.35;
const DEFAULT_ATR_STOP_MULTIPLIER = 0.9;

const GEX_STOP_TIGHTEN_FACTOR = 0.9;
const GEX_STOP_WIDEN_FACTOR = 1.1;
const GEX_MEAN_REVERSION_FAMILIES = new Set<SetupType>([
  'mean_reversion',
  'fade_at_wall',
  'flip_reclaim',
]);

const MEAN_REVERSION_STOP_CONFIG: Record<Regime, { maxPoints: number; atrMultiple: number }> = {
  compression: { maxPoints: 8, atrMultiple: 0.8 },
  ranging: { maxPoints: 9, atrMultiple: 1.0 },
  trending: { maxPoints: 10, atrMultiple: 1.2 },
  breakout: { maxPoints: 12, atrMultiple: 1.5 },
};

export interface AdaptiveStopInput {
  direction: Setup['direction'];
  entryLow: number;
  entryHigh: number;
  baseStop: number;
  geometryStopScale: number;
  atr14?: number | null;
  atrStopFloorEnabled?: boolean;
  atrStopMultiplier?: number;
  netGex?: number | null;
  setupType?: SetupType | string;
  vixRegime?: SPXVixRegime | null;
  vixStopScalingEnabled?: boolean;
  gexDistanceBp?: number | null;
  gexMagnitudeScalingEnabled?: boolean;
  regime?: Regime | null;
}

export interface AdaptiveStopOutput {
  stop: number;
  riskPoints: number;
  scale: {
    geometry: number;
    vix: number;
    gexDirectional: number;
    gexMagnitude: number;
    total: number;
  };
  atrFloorPoints: number;
}

function clamp(value: number, min: number, max: number): number {
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

export function resolveVixStopScale(vixRegime: SPXVixRegime | null | undefined): number {
  if (vixRegime === 'elevated') return 1.3;
  if (vixRegime === 'extreme') return 1.6;
  return 1;
}

export function resolveGEXDirectionalScale(input: {
  netGex?: number | null;
  setupType?: SetupType | string;
}): number {
  const netGex = toFiniteNumber(input.netGex);
  if (netGex == null || netGex === 0) return 1;
  if (netGex > 0) return GEX_STOP_TIGHTEN_FACTOR;

  if (GEX_MEAN_REVERSION_FAMILIES.has((input.setupType ?? '') as SetupType)) {
    return GEX_STOP_WIDEN_FACTOR;
  }

  return 1;
}

export function resolveGEXMagnitudeScale(distanceBp: number | null | undefined): number {
  const distance = toFiniteNumber(distanceBp);
  if (distance == null || distance <= 0) return 1;

  if (distance > 500) return 1.2;
  if (distance > 200) return 1;
  return 0.7;
}

export function calculateMeanReversionStop(
  entryPrice: number,
  direction: Setup['direction'],
  atr: number,
  regime: Regime,
): number {
  const config = MEAN_REVERSION_STOP_CONFIG[regime] ?? MEAN_REVERSION_STOP_CONFIG.ranging;
  const normalizedAtr = Number.isFinite(atr) && atr > 0
    ? atr
    : config.maxPoints / Math.max(config.atrMultiple, 0.1);
  const atrStop = normalizedAtr * config.atrMultiple;
  const clampedStop = Math.min(atrStop, config.maxPoints);

  return direction === 'bullish'
    ? round(entryPrice - clampedStop, 2)
    : round(entryPrice + clampedStop, 2);
}

export function deriveNearestGEXDistanceBp(input: {
  referencePrice: number;
  callWall?: number | null;
  putWall?: number | null;
  flipPoint?: number | null;
}): number | null {
  if (!Number.isFinite(input.referencePrice) || input.referencePrice <= 0) {
    return null;
  }

  const distances = [input.callWall, input.putWall, input.flipPoint]
    .map((level) => toFiniteNumber(level))
    .filter((level): level is number => level != null)
    .map((level) => Math.abs(level - input.referencePrice));

  if (distances.length === 0) return null;
  const nearest = Math.min(...distances);
  return round((nearest / input.referencePrice) * 10_000, 2);
}

export function calculateAdaptiveStop(input: AdaptiveStopInput): AdaptiveStopOutput {
  const entryMid = (input.entryLow + input.entryHigh) / 2;
  const baseRisk = Math.max(MIN_STOP_DISTANCE_POINTS, Math.abs(entryMid - input.baseStop));

  const atrStopMultiplier = clamp(
    toFiniteNumber(input.atrStopMultiplier) ?? DEFAULT_ATR_STOP_MULTIPLIER,
    0.1,
    3,
  );
  const atrFloorPoints = (
    input.atrStopFloorEnabled
    && toFiniteNumber(input.atr14) != null
  )
    ? Math.max(0, (toFiniteNumber(input.atr14) as number) * atrStopMultiplier)
    : 0;
  const effectiveRisk = Math.max(baseRisk, atrFloorPoints);

  const geometryScale = clamp(input.geometryStopScale, 0.2, 4);
  const vixScale = input.vixStopScalingEnabled === false
    ? 1
    : resolveVixStopScale(input.vixRegime);
  const gexDirectionalScale = resolveGEXDirectionalScale({
    netGex: input.netGex,
    setupType: input.setupType,
  });
  const gexMagnitudeScale = input.gexMagnitudeScalingEnabled === false
    ? 1
    : resolveGEXMagnitudeScale(input.gexDistanceBp);

  const totalScale = clamp(
    geometryScale * vixScale * gexDirectionalScale * gexMagnitudeScale,
    0.2,
    5,
  );

  const uncappedRiskPoints = Math.max(MIN_STOP_DISTANCE_POINTS, effectiveRisk * totalScale);
  const meanReversionCapPoints = (() => {
    if (input.setupType !== 'mean_reversion') return null;
    const entryMid = (input.entryLow + input.entryHigh) / 2;
    const cappedStop = calculateMeanReversionStop(
      entryMid,
      input.direction,
      toFiniteNumber(input.atr14) ?? NaN,
      input.regime ?? 'ranging',
    );
    return Math.abs(entryMid - cappedStop);
  })();
  const riskPoints = round(
    meanReversionCapPoints != null
      ? Math.min(uncappedRiskPoints, meanReversionCapPoints)
      : uncappedRiskPoints,
    2,
  );
  const stop = input.direction === 'bullish'
    ? round(entryMid - riskPoints, 2)
    : round(entryMid + riskPoints, 2);

  return {
    stop,
    riskPoints,
    scale: {
      geometry: round(geometryScale, 4),
      vix: round(vixScale, 4),
      gexDirectional: round(gexDirectionalScale, 4),
      gexMagnitude: round(gexMagnitudeScale, 4),
      total: round(totalScale, 4),
    },
    atrFloorPoints: round(atrFloorPoints, 4),
  };
}
