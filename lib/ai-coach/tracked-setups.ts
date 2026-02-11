import type { TrackedSetup, TrackedSetupStatus } from '@/lib/api/ai-coach'

export type TrackedSetupsView = 'active' | 'history'
export type ActiveStatusFilter = 'all' | 'active' | 'triggered'
export type HistoryStatusFilter = 'all' | 'archived'
export type TrackedSetupsSortMode = 'newest' | 'highest_score' | 'closest_to_trigger'

export interface TrackedSetupsPreferences {
  view: TrackedSetupsView
  activeStatusFilter: ActiveStatusFilter
  historyStatusFilter: HistoryStatusFilter
  sortMode: TrackedSetupsSortMode
}

export const DEFAULT_TRACKED_SETUPS_PREFERENCES: TrackedSetupsPreferences = {
  view: 'active',
  activeStatusFilter: 'active',
  historyStatusFilter: 'all',
  sortMode: 'newest',
}

const STORAGE_PREFIX = 'ai-coach-tracked-setups-preferences-v1'

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === 'object' && !Array.isArray(value))
    ? value as Record<string, unknown>
    : {}
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.+-]/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getTrackedTimestamp(setup: TrackedSetup): number {
  const trackedAt = Date.parse(setup.tracked_at)
  if (Number.isFinite(trackedAt)) return trackedAt
  const createdAt = Date.parse(setup.created_at)
  return Number.isFinite(createdAt) ? createdAt : 0
}

export function getSetupScore(setup: TrackedSetup): number {
  const opportunity = asRecord(setup.opportunity_data)
  const score = toNumber(opportunity.score)
  return score ?? 0
}

export function getSetupEntryPrice(setup: TrackedSetup): number | null {
  const opportunity = asRecord(setup.opportunity_data)
  const suggestedTrade = asRecord(opportunity.suggestedTrade)
  return (
    toNumber(suggestedTrade.entry)
    ?? toNumber(opportunity.entry)
    ?? null
  )
}

export function getSetupCurrentPrice(setup: TrackedSetup): number | null {
  const opportunity = asRecord(setup.opportunity_data)
  return (
    toNumber(opportunity.currentPrice)
    ?? toNumber(opportunity.current_price)
    ?? null
  )
}

export function getSetupDistanceToTrigger(setup: TrackedSetup): number {
  const entry = getSetupEntryPrice(setup)
  const currentPrice = getSetupCurrentPrice(setup)

  if (entry == null || currentPrice == null || currentPrice === 0) {
    return Number.POSITIVE_INFINITY
  }

  return Math.abs((entry - currentPrice) / currentPrice)
}

export function matchesTrackedSetupsFilter(
  status: TrackedSetupStatus,
  view: TrackedSetupsView,
  activeStatusFilter: ActiveStatusFilter,
  historyStatusFilter: HistoryStatusFilter,
): boolean {
  if (view === 'active') {
    if (status !== 'active' && status !== 'triggered') return false
    if (activeStatusFilter === 'all') return true
    return status === activeStatusFilter
  }

  if (status !== 'archived') return false
  if (historyStatusFilter === 'all') return true
  return status === historyStatusFilter
}

export function filterTrackedSetups(
  setups: TrackedSetup[],
  view: TrackedSetupsView,
  activeStatusFilter: ActiveStatusFilter,
  historyStatusFilter: HistoryStatusFilter,
): TrackedSetup[] {
  return setups.filter((setup) => matchesTrackedSetupsFilter(
    setup.status,
    view,
    activeStatusFilter,
    historyStatusFilter,
  ))
}

export function sortTrackedSetups(
  setups: TrackedSetup[],
  sortMode: TrackedSetupsSortMode,
): TrackedSetup[] {
  const sorted = [...setups]

  sorted.sort((a, b) => {
    if (sortMode === 'highest_score') {
      const scoreDiff = getSetupScore(b) - getSetupScore(a)
      if (scoreDiff !== 0) return scoreDiff
      return getTrackedTimestamp(b) - getTrackedTimestamp(a)
    }

    if (sortMode === 'closest_to_trigger') {
      const distanceDiff = getSetupDistanceToTrigger(a) - getSetupDistanceToTrigger(b)
      if (distanceDiff !== 0) return distanceDiff
      const scoreDiff = getSetupScore(b) - getSetupScore(a)
      if (scoreDiff !== 0) return scoreDiff
      return getTrackedTimestamp(b) - getTrackedTimestamp(a)
    }

    return getTrackedTimestamp(b) - getTrackedTimestamp(a)
  })

  return sorted
}

function normalizeView(value: unknown): TrackedSetupsView {
  if (value === 'active' || value === 'history') return value
  return DEFAULT_TRACKED_SETUPS_PREFERENCES.view
}

function normalizeActiveStatusFilter(value: unknown): ActiveStatusFilter {
  if (value === 'all' || value === 'active' || value === 'triggered') return value
  return DEFAULT_TRACKED_SETUPS_PREFERENCES.activeStatusFilter
}

function normalizeHistoryStatusFilter(value: unknown): HistoryStatusFilter {
  if (value === 'all' || value === 'archived') return value
  return DEFAULT_TRACKED_SETUPS_PREFERENCES.historyStatusFilter
}

function normalizeSortMode(value: unknown): TrackedSetupsSortMode {
  if (value === 'newest' || value === 'highest_score' || value === 'closest_to_trigger') return value
  return DEFAULT_TRACKED_SETUPS_PREFERENCES.sortMode
}

export function normalizeTrackedSetupsPreferences(value: unknown): TrackedSetupsPreferences {
  if (!value || typeof value !== 'object') {
    return DEFAULT_TRACKED_SETUPS_PREFERENCES
  }

  const raw = value as Partial<TrackedSetupsPreferences>
  return {
    view: normalizeView(raw.view),
    activeStatusFilter: normalizeActiveStatusFilter(raw.activeStatusFilter),
    historyStatusFilter: normalizeHistoryStatusFilter(raw.historyStatusFilter),
    sortMode: normalizeSortMode(raw.sortMode),
  }
}

export function getTrackedSetupsPreferencesStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function loadTrackedSetupsPreferences(userId: string): TrackedSetupsPreferences {
  if (typeof window === 'undefined' || !userId) {
    return DEFAULT_TRACKED_SETUPS_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(getTrackedSetupsPreferencesStorageKey(userId))
    if (!raw) return DEFAULT_TRACKED_SETUPS_PREFERENCES
    return normalizeTrackedSetupsPreferences(JSON.parse(raw))
  } catch {
    return DEFAULT_TRACKED_SETUPS_PREFERENCES
  }
}

export function saveTrackedSetupsPreferences(userId: string, preferences: TrackedSetupsPreferences): void {
  if (typeof window === 'undefined' || !userId) return

  try {
    const normalized = normalizeTrackedSetupsPreferences(preferences)
    window.localStorage.setItem(
      getTrackedSetupsPreferencesStorageKey(userId),
      JSON.stringify(normalized),
    )
  } catch {
    // Ignore storage write errors (private mode/quota).
  }
}
