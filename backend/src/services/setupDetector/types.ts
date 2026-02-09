import { MassiveAggregate } from '../../config/massive';
import { LevelsResponse } from '../levels';

export type SetupSignalType =
  | 'orb_breakout'
  | 'break_retest'
  | 'vwap_cross'
  | 'vwap_bounce'
  | 'vwap_deviation'
  | 'gap_fill';

export type SetupDirection = 'long' | 'short' | 'neutral';

export interface SetupTradeSuggestion {
  strategy: string;
  entry: number;
  stopLoss: number;
  target: number;
}

export interface SetupSignal {
  type: SetupSignalType;
  symbol: string;
  direction: SetupDirection;
  confidence: number; // 0-100
  currentPrice: number;
  description: string;
  dedupeKey: string;
  signalData: Record<string, unknown>;
  tradeSuggestion?: SetupTradeSuggestion;
  detectedAt: string;
}

export interface DetectorSnapshot {
  symbol: string;
  intradayBars: MassiveAggregate[];
  dailyBars: MassiveAggregate[];
  levels: LevelsResponse;
  detectedAt: string;
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toShortDirection(direction: SetupDirection): 'bullish' | 'bearish' | 'neutral' {
  if (direction === 'long') return 'bullish';
  if (direction === 'short') return 'bearish';
  return 'neutral';
}
