export type DrillDirection = 'long' | 'short' | 'flat';
export type EngineDirection = 'bullish' | 'bearish' | 'neutral';

export interface DrillScoringInput {
  learnerDirection: DrillDirection;
  engineDirection: EngineDirection | null;
  strike: number | null;
  stopLevel: number | null;
  targetLevel: number | null;
  learnerPnlPct: number | null;
  actualPnlPct: number | null;
}

export interface DrillScoringResult {
  score: number;
  directionMatch: boolean;
  learnerRr: number | null;
  learnerPnlPct: number | null;
  feedbackSummary: string;
  components: {
    directionScore: number;
    riskDisciplineScore: number;
    pnlDeltaScore: number;
  };
}

function clampScore(value: number): number {
  const bounded = Math.max(0, Math.min(100, value));
  return Math.round(bounded);
}

function normalizeFiniteNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inferDirectionMatch(
  learnerDirection: DrillDirection,
  engineDirection: EngineDirection | null,
): boolean {
  if (engineDirection == null) return false;
  if (learnerDirection === 'flat') return engineDirection === 'neutral';
  if (learnerDirection === 'long') return engineDirection === 'bullish';
  return engineDirection === 'bearish';
}

function computeLearnerRr(
  learnerDirection: DrillDirection,
  strike: number | null,
  stopLevel: number | null,
  targetLevel: number | null,
): number | null {
  if (learnerDirection === 'flat') return null;
  if (strike == null || stopLevel == null || targetLevel == null) return null;

  const risk = learnerDirection === 'long'
    ? strike - stopLevel
    : stopLevel - strike;
  const reward = learnerDirection === 'long'
    ? targetLevel - strike
    : strike - targetLevel;

  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk <= 0 || reward <= 0) {
    return null;
  }

  return Number((reward / risk).toFixed(4));
}

function computeRiskDisciplineScore(learnerDirection: DrillDirection, learnerRr: number | null): number {
  if (learnerDirection === 'flat') return 30;
  if (learnerRr == null) return 0;

  if (learnerRr >= 1.2 && learnerRr <= 3.5) return 30;
  if ((learnerRr >= 0.9 && learnerRr < 1.2) || (learnerRr > 3.5 && learnerRr <= 5)) return 22;
  if (learnerRr >= 0.5 && learnerRr < 0.9) return 12;
  return 6;
}

function computePnlDeltaScore(deltaPct: number | null): number {
  if (deltaPct == null) return 10;
  if (deltaPct <= 2) return 20;
  if (deltaPct <= 5) return 18;
  if (deltaPct <= 10) return 15;
  if (deltaPct <= 20) return 10;
  if (deltaPct <= 35) return 5;
  return 0;
}

function summarizeFeedback(
  score: number,
  directionMatch: boolean,
  learnerRr: number | null,
  actualPnlPct: number | null,
  learnerPnlPct: number | null,
): string {
  const rrLabel = learnerRr == null ? 'n/a' : learnerRr.toFixed(2);
  const actualLabel = actualPnlPct == null ? 'n/a' : actualPnlPct.toFixed(2);
  const learnerLabel = learnerPnlPct == null ? 'n/a' : learnerPnlPct.toFixed(2);

  if (score >= 85) {
    return `Strong replay read. Direction aligned with engine context, risk was disciplined (R:R ${rrLabel}), and outcome drift stayed tight (learner ${learnerLabel}% vs actual ${actualLabel}%).`;
  }

  if (score >= 65) {
    const directionNote = directionMatch
      ? 'Direction aligned, but precision can improve.'
      : 'Direction missed engine context.';
    return `${directionNote} Keep tightening R:R planning (current ${rrLabel}) and reduce learner vs actual outcome drift (${learnerLabel}% vs ${actualLabel}%).`;
  }

  return `Reset needed. Direction and/or risk structure was off (R:R ${rrLabel}); learner outcome diverged materially from actual (${learnerLabel}% vs ${actualLabel}%). Re-anchor on trend context and asymmetric setups.`;
}

function inferLearnerPnlPct(
  learnerDirection: DrillDirection,
  engineDirection: EngineDirection | null,
  providedLearnerPnlPct: number | null,
  actualPnlPct: number | null,
): number | null {
  if (providedLearnerPnlPct != null) return providedLearnerPnlPct;
  if (actualPnlPct == null) return null;
  if (learnerDirection === 'flat') return 0;

  const sameDirection = inferDirectionMatch(learnerDirection, engineDirection);
  return sameDirection ? actualPnlPct : Number((-actualPnlPct).toFixed(4));
}

export function scoreReplayDrill(input: DrillScoringInput): DrillScoringResult {
  const actualPnlPct = normalizeFiniteNumber(input.actualPnlPct);
  const providedLearnerPnlPct = normalizeFiniteNumber(input.learnerPnlPct);
  const learnerRr = computeLearnerRr(
    input.learnerDirection,
    normalizeFiniteNumber(input.strike),
    normalizeFiniteNumber(input.stopLevel),
    normalizeFiniteNumber(input.targetLevel),
  );
  const directionMatch = inferDirectionMatch(input.learnerDirection, input.engineDirection);
  const learnerPnlPct = inferLearnerPnlPct(
    input.learnerDirection,
    input.engineDirection,
    providedLearnerPnlPct,
    actualPnlPct,
  );

  const directionScore = directionMatch ? 50 : (input.learnerDirection === 'flat' ? 10 : 0);
  const riskDisciplineScore = computeRiskDisciplineScore(input.learnerDirection, learnerRr);
  const pnlDeltaPct = (
    learnerPnlPct != null && actualPnlPct != null
      ? Math.abs(learnerPnlPct - actualPnlPct)
      : null
  );
  const pnlDeltaScore = computePnlDeltaScore(pnlDeltaPct);
  const score = clampScore(directionScore + riskDisciplineScore + pnlDeltaScore);

  return {
    score,
    directionMatch,
    learnerRr,
    learnerPnlPct,
    feedbackSummary: summarizeFeedback(score, directionMatch, learnerRr, actualPnlPct, learnerPnlPct),
    components: {
      directionScore,
      riskDisciplineScore,
      pnlDeltaScore,
    },
  };
}

export function normalizeEngineDirection(value: unknown): EngineDirection | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish' || normalized === 'long' || normalized === 'call') return 'bullish';
  if (normalized === 'bearish' || normalized === 'short' || normalized === 'put') return 'bearish';
  if (normalized === 'neutral' || normalized === 'flat') return 'neutral';
  return null;
}
