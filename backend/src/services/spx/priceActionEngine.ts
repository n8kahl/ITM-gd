import type { ClusterZone, Setup, SetupTriggerPattern } from './types';
import { round } from './utils';

export interface PriceActionBar {
  c: number;
  o?: number;
  h?: number;
  l?: number;
  v?: number;
  t: number;
}

function toEpochMs(value: string | null | undefined): number {
  if (!value) return Date.now();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function barOpen(bar: PriceActionBar): number {
  return Number.isFinite(bar.o) ? (bar.o as number) : bar.c;
}

function barHigh(bar: PriceActionBar): number {
  if (Number.isFinite(bar.h)) return bar.h as number;
  return Math.max(barOpen(bar), bar.c);
}

function barLow(bar: PriceActionBar): number {
  if (Number.isFinite(bar.l)) return bar.l as number;
  return Math.min(barOpen(bar), bar.c);
}

export function detectCandlePattern(input: {
  currentBar: PriceActionBar;
  priorBar: PriceActionBar | null;
}): SetupTriggerPattern {
  const current = input.currentBar;
  const prior = input.priorBar;

  const currentOpen = barOpen(current);
  const currentHigh = barHigh(current);
  const currentLow = barLow(current);
  const currentBody = Math.abs(current.c - currentOpen);
  const currentRange = Math.max(0.01, currentHigh - currentLow);
  const upperWick = Math.max(0, currentHigh - Math.max(current.c, currentOpen));
  const lowerWick = Math.max(0, Math.min(current.c, currentOpen) - currentLow);

  if (prior) {
    const priorOpen = barOpen(prior);
    if (
      current.c > currentOpen
      && prior.c < priorOpen
      && current.c >= priorOpen
      && currentOpen <= prior.c
    ) {
      return 'engulfing_bull';
    }

    if (
      current.c < currentOpen
      && prior.c > priorOpen
      && current.c <= priorOpen
      && currentOpen >= prior.c
    ) {
      return 'engulfing_bear';
    }
  }

  if (currentBody <= currentRange * 0.18 && upperWick >= currentBody * 1.2 && lowerWick >= currentBody * 1.2) {
    return 'doji';
  }

  if (lowerWick >= Math.max(currentBody * 2, currentRange * 0.35) && upperWick <= currentRange * 0.2) {
    return 'hammer';
  }

  if (upperWick >= Math.max(currentBody * 2, currentRange * 0.35) && lowerWick <= currentRange * 0.2) {
    return 'inverted_hammer';
  }

  return 'none';
}

export function calculatePenetrationDepth(input: {
  direction: Setup['direction'];
  zone: ClusterZone;
  triggerBar: PriceActionBar;
}): number {
  const low = barLow(input.triggerBar);
  const high = barHigh(input.triggerBar);

  if (input.direction === 'bullish') {
    return round(Math.max(0, input.zone.priceLow - low), 2);
  }
  return round(Math.max(0, high - input.zone.priceHigh), 2);
}

export function classifyApproachSpeed(input: {
  pointsMoved: number;
  secondsToLevel: number;
}): 'slow' | 'moderate' | 'fast' {
  const seconds = Math.max(1, input.secondsToLevel);
  const speed = Math.abs(input.pointsMoved) / seconds;
  if (speed >= 0.25) return 'fast';
  if (speed >= 0.08) return 'moderate';
  return 'slow';
}

export function isVolumeSpike(input: {
  currentVolume: number;
  priorVolumes: number[];
  spikeMultiplier?: number;
}): boolean {
  const current = Math.max(0, input.currentVolume);
  const prior = input.priorVolumes.filter((value) => Number.isFinite(value) && value > 0);
  if (prior.length === 0) return false;

  const baseline = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  if (!Number.isFinite(baseline) || baseline <= 0) return false;

  const multiplier = Number.isFinite(input.spikeMultiplier)
    ? Math.max(1.1, input.spikeMultiplier as number)
    : 1.6;
  return current >= baseline * multiplier;
}

export function buildTriggerContext(input: {
  previous: Setup['triggerContext'] | undefined;
  setupStatus: Setup['status'];
  triggeredAt: string | null;
  evaluationTimestamp: string;
  direction: Setup['direction'];
  zone: ClusterZone;
  latestBar: PriceActionBar | null;
  priorBar: PriceActionBar | null;
}): Setup['triggerContext'] | undefined {
  const prior = input.previous;
  if (input.setupStatus !== 'triggered' && input.setupStatus !== 'invalidated' && input.setupStatus !== 'expired') {
    return prior;
  }

  const triggerTimestamp = input.triggeredAt || prior?.triggerBarTimestamp;
  if (!triggerTimestamp) return prior;

  const evaluationMs = toEpochMs(input.evaluationTimestamp);
  const triggerMs = toEpochMs(triggerTimestamp);
  const triggerLatencyMs = Math.max(0, evaluationMs - triggerMs);

  if (prior) {
    return {
      ...prior,
      triggerLatencyMs,
    };
  }

  const latestBar = input.latestBar;
  const priorBar = input.priorBar;
  if (!latestBar) {
    return {
      triggerBarTimestamp: triggerTimestamp,
      triggerBarPatternType: 'none',
      triggerBarVolume: 0,
      penetrationDepth: 0,
      triggerLatencyMs,
    };
  }

  const pattern = detectCandlePattern({
    currentBar: latestBar,
    priorBar,
  });
  const barTimestamp = new Date(latestBar.t).toISOString();
  const normalizedTriggerMs = toEpochMs(barTimestamp);

  return {
    triggerBarTimestamp: barTimestamp,
    triggerBarPatternType: pattern,
    triggerBarVolume: Math.max(0, round(Number.isFinite(latestBar.v) ? (latestBar.v as number) : 0, 2)),
    penetrationDepth: calculatePenetrationDepth({
      direction: input.direction,
      zone: input.zone,
      triggerBar: latestBar,
    }),
    triggerLatencyMs: Math.max(0, evaluationMs - normalizedTriggerMs),
  };
}
