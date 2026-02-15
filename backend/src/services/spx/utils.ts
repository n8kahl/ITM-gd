import { createHash, randomUUID } from 'crypto';
import type { LevelCategory, Regime, ZoneType } from './types';

export const CLUSTER_RADIUS_POINTS = 3;

export const CATEGORY_WEIGHT: Record<LevelCategory, number> = {
  structural: 1.5,
  tactical: 1.2,
  intraday: 1.0,
  options: 1.3,
  spy_derived: 1.1,
  fibonacci: 1.2,
};

export function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uuid(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function stableId(prefix: string, seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 24);
  return `${prefix}_${digest}`;
}

export function classifyZoneType(score: number): ZoneType {
  if (score >= 5) return 'fortress';
  if (score >= 3.5) return 'defended';
  if (score >= 2) return 'moderate';
  return 'minor';
}

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let current = values[0];
  for (let i = 1; i < values.length; i += 1) {
    current = values[i] * k + current * (1 - k);
  }
  return current;
}

export function zscore(values: number[], value: number): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance = values.reduce((sum, item) => sum + ((item - mean) ** 2), 0) / values.length;
  const std = Math.sqrt(variance);
  if (std <= 0) return 0;

  return (value - mean) / std;
}

export function normalizeProbabilities(parts: Array<[string, number]>): Record<string, number> {
  const bounded = parts.map(([key, value]) => [key, Math.max(0, value)] as const);
  const sum = bounded.reduce((acc, [, value]) => acc + value, 0);
  if (sum <= 0) {
    return Object.fromEntries(bounded.map(([key]) => [key, 0]));
  }

  return Object.fromEntries(
    bounded.map(([key, value]) => [key, round((value / sum) * 100, 2)]),
  );
}

export function classifyRegimeFromSignals(input: {
  netGex: number;
  volumeTrend: 'rising' | 'flat' | 'falling';
  rangeCompression: number;
  breakoutStrength: number;
  zoneContainment: number;
}): Regime {
  if (input.breakoutStrength >= 0.7 && input.volumeTrend === 'rising') {
    return 'breakout';
  }

  if (input.rangeCompression >= 0.65 && input.volumeTrend !== 'rising') {
    return 'compression';
  }

  if (input.netGex < 0 && (input.breakoutStrength >= 0.45 || input.volumeTrend === 'rising')) {
    return 'trending';
  }

  if (input.zoneContainment >= 0.55 && input.netGex >= 0) {
    return 'ranging';
  }

  return input.netGex < 0 ? 'trending' : 'ranging';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
