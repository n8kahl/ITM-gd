'use client'

import type { ChartTimeframe } from '@/lib/api/ai-coach'
import type { IndicatorConfig } from './chart-indicators'
import { DEFAULT_INDICATOR_CONFIG } from './chart-indicators'
import {
  DEFAULT_LEVEL_VISIBILITY,
  type LevelVisibilityConfig,
} from './chart-level-groups'

export interface AICoachPreferences {
  riskPerTradePct: number
  orbMinutes: 5 | 15 | 30
  defaultChartTimeframe: ChartTimeframe
  autoSyncWorkflowSymbol: boolean
  notificationsEnabled: boolean
  defaultOptionsStrikeRange: 5 | 10 | 15 | 20 | 30
  defaultShowGex: boolean
  defaultShowVolAnalytics: boolean
  defaultIndicators: IndicatorConfig
  defaultLevelVisibility: LevelVisibilityConfig
  lastActiveView?: PersistentCenterView
  lastChartSymbol?: string
  lastChartTimeframe?: ChartTimeframe
}

export type PersistentCenterView =
  | 'welcome'
  | 'chart'
  | 'options'
  | 'position'
  | 'screenshot'
  | 'journal'
  | 'alerts'
  | 'brief'
  | 'scanner'
  | 'tracked'
  | 'leaps'
  | 'earnings'
  | 'macro'
  | 'watchlist'
  | 'preferences'

export const AI_COACH_PREFERENCES_STORAGE_KEY = 'ai-coach-preferences-v2'

export const DEFAULT_AI_COACH_PREFERENCES: AICoachPreferences = {
  riskPerTradePct: 1,
  orbMinutes: 15,
  defaultChartTimeframe: '5m',
  autoSyncWorkflowSymbol: false,
  notificationsEnabled: true,
  defaultOptionsStrikeRange: 10,
  defaultShowGex: true,
  defaultShowVolAnalytics: true,
  defaultIndicators: DEFAULT_INDICATOR_CONFIG,
  defaultLevelVisibility: DEFAULT_LEVEL_VISIBILITY,
  lastActiveView: undefined,
  lastChartSymbol: undefined,
  lastChartTimeframe: undefined,
}

function toChartTimeframe(value: unknown): ChartTimeframe {
  if (value === '1m' || value === '5m' || value === '15m' || value === '1h' || value === '4h' || value === '1D') {
    return value
  }
  return DEFAULT_AI_COACH_PREFERENCES.defaultChartTimeframe
}

function toOptionalChartTimeframe(value: unknown): ChartTimeframe | undefined {
  if (value === undefined || value === null) return undefined
  if (value === '1m' || value === '5m' || value === '15m' || value === '1h' || value === '4h' || value === '1D') {
    return value
  }
  return undefined
}

function toOrbMinutes(value: unknown): 5 | 15 | 30 {
  if (value === 5 || value === 15 || value === 30) return value
  return DEFAULT_AI_COACH_PREFERENCES.orbMinutes
}

function toStrikeRange(value: unknown): 5 | 10 | 15 | 20 | 30 {
  if (value === 5 || value === 10 || value === 15 || value === 20 || value === 30) return value
  return DEFAULT_AI_COACH_PREFERENCES.defaultOptionsStrikeRange
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function toPersistentCenterView(value: unknown): PersistentCenterView | undefined {
  if (
    value === 'welcome'
    || value === 'chart'
    || value === 'options'
    || value === 'position'
    || value === 'screenshot'
    || value === 'journal'
    || value === 'alerts'
    || value === 'brief'
    || value === 'scanner'
    || value === 'tracked'
    || value === 'leaps'
    || value === 'earnings'
    || value === 'macro'
    || value === 'watchlist'
    || value === 'preferences'
  ) {
    return value
  }
  return undefined
}

function toSymbol(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized.length > 12) return undefined
  return normalized
}

function toRiskPct(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_AI_COACH_PREFERENCES.riskPerTradePct
  }

  return Math.max(0.25, Math.min(5, Number(value.toFixed(2))))
}

function toIndicators(value: unknown): IndicatorConfig {
  const defaults = DEFAULT_AI_COACH_PREFERENCES.defaultIndicators
  if (!value || typeof value !== 'object') return defaults
  const maybe = value as Partial<IndicatorConfig>
  return {
    ema8: toBoolean(maybe.ema8, defaults.ema8),
    ema21: toBoolean(maybe.ema21, defaults.ema21),
    vwap: toBoolean(maybe.vwap, defaults.vwap),
    openingRange: toBoolean(maybe.openingRange, defaults.openingRange),
    rsi: toBoolean(maybe.rsi, defaults.rsi),
    macd: toBoolean(maybe.macd, defaults.macd),
  }
}

function toLevelVisibility(value: unknown): LevelVisibilityConfig {
  const defaults = DEFAULT_AI_COACH_PREFERENCES.defaultLevelVisibility
  if (!value || typeof value !== 'object') return defaults

  const maybe = value as Partial<LevelVisibilityConfig>
  return {
    fib: toBoolean(maybe.fib, defaults.fib),
    pivot: toBoolean(maybe.pivot, defaults.pivot),
    supportResistance: toBoolean(maybe.supportResistance, defaults.supportResistance),
    vwap: toBoolean(maybe.vwap, defaults.vwap),
    gex: toBoolean(maybe.gex, defaults.gex),
    openingRange: toBoolean(maybe.openingRange, defaults.openingRange),
    position: toBoolean(maybe.position, defaults.position),
    other: toBoolean(maybe.other, defaults.other),
  }
}

export function normalizeAICoachPreferences(value: unknown): AICoachPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_AI_COACH_PREFERENCES
  }

  const raw = value as Partial<AICoachPreferences>
  return {
    riskPerTradePct: toRiskPct(raw.riskPerTradePct),
    orbMinutes: toOrbMinutes(raw.orbMinutes),
    defaultChartTimeframe: toChartTimeframe(raw.defaultChartTimeframe),
    autoSyncWorkflowSymbol: toBoolean(raw.autoSyncWorkflowSymbol, DEFAULT_AI_COACH_PREFERENCES.autoSyncWorkflowSymbol),
    notificationsEnabled: toBoolean(raw.notificationsEnabled, DEFAULT_AI_COACH_PREFERENCES.notificationsEnabled),
    defaultOptionsStrikeRange: toStrikeRange(raw.defaultOptionsStrikeRange),
    defaultShowGex: toBoolean(raw.defaultShowGex, DEFAULT_AI_COACH_PREFERENCES.defaultShowGex),
    defaultShowVolAnalytics: toBoolean(raw.defaultShowVolAnalytics, DEFAULT_AI_COACH_PREFERENCES.defaultShowVolAnalytics),
    defaultIndicators: toIndicators(raw.defaultIndicators),
    defaultLevelVisibility: toLevelVisibility(raw.defaultLevelVisibility),
    lastActiveView: toPersistentCenterView(raw.lastActiveView),
    lastChartSymbol: toSymbol(raw.lastChartSymbol),
    lastChartTimeframe: toOptionalChartTimeframe(raw.lastChartTimeframe),
  }
}

export function loadAICoachPreferences(): AICoachPreferences {
  if (typeof window === 'undefined') return DEFAULT_AI_COACH_PREFERENCES

  try {
    const raw = window.localStorage.getItem(AI_COACH_PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_AI_COACH_PREFERENCES
    return normalizeAICoachPreferences(JSON.parse(raw))
  } catch {
    return DEFAULT_AI_COACH_PREFERENCES
  }
}

export function saveAICoachPreferences(preferences: AICoachPreferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      AI_COACH_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeAICoachPreferences(preferences)),
    )
  } catch {
    // Ignore storage write errors (private mode/quota).
  }
}
