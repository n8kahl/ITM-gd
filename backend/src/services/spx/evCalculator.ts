import { round } from './utils';

export interface AdaptiveEVInput {
  pWin: number;
  target1R: number;
  target2R: number;
  vixValue?: number | null;
  minutesSinceOpen?: number | null;
  slippageR?: number | null;
  partialAtT1Pct?: number | null;
  lossDistribution?: Array<{
    rLoss: number;
    probability: number;
  }> | null;
}

export interface AdaptiveEVResult {
  evR: number;
  adjustedPWin: number;
  blendedWinR: number;
  expectedLossR: number;
  t1Weight: number;
  t2Weight: number;
  slippageR: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeLossDistribution(
  input?: AdaptiveEVInput['lossDistribution'],
): Array<{ rLoss: number; probability: number }> {
  const fallback = [
    { rLoss: 0.5, probability: 0.20 },
    { rLoss: 0.75, probability: 0.35 },
    { rLoss: 1.0, probability: 0.35 },
    { rLoss: 1.25, probability: 0.10 },
  ];
  if (!Array.isArray(input) || input.length === 0) return fallback;

  const cleaned = input
    .filter((row) => Number.isFinite(row.rLoss) && Number.isFinite(row.probability) && row.probability > 0)
    .map((row) => ({
      rLoss: Math.max(0.1, row.rLoss),
      probability: Math.max(0, row.probability),
    }));

  if (cleaned.length === 0) return fallback;
  const total = cleaned.reduce((sum, row) => sum + row.probability, 0);
  if (total <= 0) return fallback;
  return cleaned.map((row) => ({
    rLoss: row.rLoss,
    probability: row.probability / total,
  }));
}

function resolveTargetWeights(input: {
  vixValue?: number | null;
  partialAtT1Pct?: number | null;
}): { t1Weight: number; t2Weight: number } {
  const vix = input.vixValue;
  let t1Weight = 0.65;
  let t2Weight = 0.35;

  if (Number.isFinite(vix)) {
    if ((vix as number) > 25) {
      t1Weight = 0.72;
      t2Weight = 0.28;
    } else if ((vix as number) < 15) {
      t1Weight = 0.58;
      t2Weight = 0.42;
    }
  }

  if (Number.isFinite(input.partialAtT1Pct)) {
    const partial = clamp(input.partialAtT1Pct as number, 0.25, 0.9);
    t1Weight = clamp((t1Weight * 0.6) + (partial * 0.4), 0.3, 0.85);
    t2Weight = 1 - t1Weight;
  }

  return {
    t1Weight: round(t1Weight, 4),
    t2Weight: round(t2Weight, 4),
  };
}

export function calculateAdaptiveEV(input: AdaptiveEVInput): AdaptiveEVResult {
  const pWinBase = clamp(input.pWin, 0.05, 0.95);
  const minutesSinceOpen = input.minutesSinceOpen;
  const post2pmPenalty = Number.isFinite(minutesSinceOpen) && (minutesSinceOpen as number) >= 270 ? 0.05 : 0;
  const adjustedPWin = clamp(pWinBase - post2pmPenalty, 0.03, 0.95);

  const { t1Weight, t2Weight } = resolveTargetWeights({
    vixValue: input.vixValue,
    partialAtT1Pct: input.partialAtT1Pct,
  });
  const blendedWinR = (t1Weight * Math.max(0.1, input.target1R)) + (t2Weight * Math.max(0.1, input.target2R));

  const lossDistribution = normalizeLossDistribution(input.lossDistribution);
  const expectedLossR = lossDistribution.reduce(
    (sum, row) => sum + (row.rLoss * row.probability),
    0,
  );

  const slippageR = clamp(input.slippageR ?? 0.05, 0, 0.5);
  const evR = (adjustedPWin * blendedWinR) - ((1 - adjustedPWin) * expectedLossR) - slippageR;

  return {
    evR: round(evR, 4),
    adjustedPWin: round(adjustedPWin, 4),
    blendedWinR: round(blendedWinR, 4),
    expectedLossR: round(expectedLossR, 4),
    t1Weight: round(t1Weight, 4),
    t2Weight: round(t2Weight, 4),
    slippageR: round(slippageR, 4),
  };
}
