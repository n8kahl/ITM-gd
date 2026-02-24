import { OptionContract, OptionsChainResponse } from '../options/types';

export interface FlowAnomalyFeatures {
  volumeOiZScore: number;
  premiumMomentum: number;
  spreadTighteningRatio: number;
  sweepIntensity: number;
  timeOfDayNormalizedVolume: number;
}

export interface FlowAnomalyCandidate {
  contract: OptionContract;
  direction: 'bullish' | 'bearish';
  anomalyScore: number;
  features: FlowAnomalyFeatures;
  volumeOIRatio: number;
}

export const FLOW_ANOMALY_THRESHOLD = 0.62;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return fallback;
  return numerator / denominator;
}

function computeSpreadPct(contract: OptionContract): number {
  const mid = (contract.bid + contract.ask) / 2;
  if (!Number.isFinite(mid) || mid <= 0) return 1;
  return clamp((contract.ask - contract.bid) / mid, 0, 1);
}

function sessionSeasonalityMultiplier(minuteOfSession: number): number {
  // U-shaped volume curve baseline: open/close naturally have higher flow.
  if (minuteOfSession < 60) return 1.5;
  if (minuteOfSession > 300) return 1.35;
  return 1;
}

function calculateFlowAnomalyScore(features: FlowAnomalyFeatures): number {
  const rawScore =
    (clamp(features.volumeOiZScore / 4, 0, 1) * 0.32)
    + (clamp(features.premiumMomentum, 0, 1) * 0.24)
    + (clamp(features.spreadTighteningRatio, 0, 1) * 0.15)
    + (clamp(features.sweepIntensity, 0, 1) * 0.17)
    + (clamp(features.timeOfDayNormalizedVolume, 0, 1.5) / 1.5 * 0.12);

  return clamp(rawScore, 0, 1);
}

function resolveMinuteOfSession(nowMs: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const hour = Number.parseInt(parts.find((part) => part.type === 'hour')?.value ?? '0', 10);
  const minute = Number.parseInt(parts.find((part) => part.type === 'minute')?.value ?? '0', 10);
  const minuteOfDay = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
  return Math.max(0, minuteOfDay - ((9 * 60) + 30));
}

export function detectFlowAnomaly(
  chain: OptionsChainResponse,
  nowMs: number = Date.now(),
): FlowAnomalyCandidate | null {
  const allOptions = [...chain.options.calls, ...chain.options.puts]
    .filter((contract) => contract.openInterest > 0 && contract.volume > 0);
  if (allOptions.length === 0) return null;

  const volumeBaseline = Math.max(1, allOptions.reduce((sum, contract) => sum + contract.volume, 0) / allOptions.length);
  const openInterestBaseline = Math.max(1, allOptions.reduce((sum, contract) => sum + contract.openInterest, 0) / allOptions.length);
  const premiumBaseline = Math.max(
    1,
    allOptions.reduce((sum, contract) => sum + ((contract.bid + contract.ask) / 2) * contract.volume, 0) / allOptions.length,
  );

  const minuteOfSession = resolveMinuteOfSession(nowMs);
  const seasonality = sessionSeasonalityMultiplier(minuteOfSession);

  const scoredCandidates = allOptions.map((contract) => {
    const spreadPct = computeSpreadPct(contract);
    const volumeOiRatio = safeDivide(contract.volume, contract.openInterest, 0);
    const baselineVolumeOiRatio = safeDivide(volumeBaseline, openInterestBaseline, 1);
    const relativeVolumeOiZ = safeDivide(
      volumeOiRatio - baselineVolumeOiRatio,
      Math.max(0.5, baselineVolumeOiRatio * 0.5),
      0,
    );
    const volumeOiZScore = Math.max(relativeVolumeOiZ, Math.max(0, volumeOiRatio - 1));

    const premium = ((contract.bid + contract.ask) / 2) * contract.volume;
    const premiumMomentum = clamp(safeDivide(premium, premiumBaseline, 0) - 1, 0, 2);
    const spreadTighteningRatio = clamp(1 - spreadPct, 0, 1);
    const sweepIntensity = clamp(volumeOiRatio / 6, 0, 1);
    const timeOfDayNormalizedVolume = clamp(safeDivide(contract.volume, volumeBaseline * seasonality, 0), 0, 2);

    const features: FlowAnomalyFeatures = {
      volumeOiZScore,
      premiumMomentum,
      spreadTighteningRatio,
      sweepIntensity,
      timeOfDayNormalizedVolume,
    };

    const anomalyScore = calculateFlowAnomalyScore(features);

    return {
      contract,
      direction: contract.type === 'call' ? 'bullish' : 'bearish' as const,
      anomalyScore,
      features,
      volumeOIRatio: volumeOiRatio,
    } satisfies FlowAnomalyCandidate;
  });

  scoredCandidates.sort((a, b) => b.anomalyScore - a.anomalyScore);
  const top = scoredCandidates[0];

  if (!top || top.anomalyScore < FLOW_ANOMALY_THRESHOLD) return null;
  return top;
}
