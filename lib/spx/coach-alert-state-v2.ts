'use client'

import type { CoachMessage } from '@/lib/types/spx-command-center'

export const COACH_ALERT_LIFECYCLE_STORAGE_KEY = 'spx.coach.alert.lifecycle.v2'
export const COACH_ALERT_LIFECYCLE_EVENT = 'spx:coach-alert-lifecycle-updated'

const LEGACY_DISMISSED_STORAGE_KEY = 'spx.coach.dismissed_alert_ids.v1'
const COACH_ALERT_LIFECYCLE_TTL_MS = 72 * 60 * 60 * 1000

export type CoachAlertSeverity = 'routine' | 'warning' | 'critical'
export type CoachAlertLifecycleStatus = 'new' | 'seen' | 'snoozed' | 'muted' | 'expired'

export interface CoachAlertLifecycleRecord {
  id: string
  setupId: string | null
  severity: CoachAlertSeverity
  status: CoachAlertLifecycleStatus
  seenAt?: string
  snoozedUntil?: string
  mutedUntil?: string
  updatedAt: string
}

export type CoachAlertLifecycleState = Record<string, CoachAlertLifecycleRecord>

function toEpoch(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isAlertTone(message: CoachMessage): boolean {
  return message.priority === 'alert' || message.priority === 'setup'
}

export function resolveCoachAlertSeverity(message: CoachMessage): CoachAlertSeverity {
  const candidate = isObject(message.structuredData)
    ? message.structuredData.severity
    : null
  if (candidate === 'critical' || candidate === 'warning' || candidate === 'routine') {
    return candidate
  }
  if (message.priority === 'alert') return 'warning'
  return 'routine'
}

function normalizeRecord(value: unknown): CoachAlertLifecycleRecord | null {
  if (!isObject(value)) return null
  if (typeof value.id !== 'string' || !value.id) return null

  const severity = value.severity === 'critical' || value.severity === 'warning' || value.severity === 'routine'
    ? value.severity
    : 'routine'
  const status = value.status === 'new'
    || value.status === 'seen'
    || value.status === 'snoozed'
    || value.status === 'muted'
    || value.status === 'expired'
    ? value.status
    : 'new'

  return {
    id: value.id,
    setupId: typeof value.setupId === 'string' ? value.setupId : null,
    severity,
    status,
    seenAt: typeof value.seenAt === 'string' ? value.seenAt : undefined,
    snoozedUntil: typeof value.snoozedUntil === 'string' ? value.snoozedUntil : undefined,
    mutedUntil: typeof value.mutedUntil === 'string' ? value.mutedUntil : undefined,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

function pruneState(state: CoachAlertLifecycleState, nowEpoch: number): CoachAlertLifecycleState {
  const next: CoachAlertLifecycleState = {}
  for (const record of Object.values(state)) {
    const updatedEpoch = toEpoch(record.updatedAt)
    if (updatedEpoch > 0 && nowEpoch - updatedEpoch > COACH_ALERT_LIFECYCLE_TTL_MS) {
      continue
    }

    if (record.status === 'snoozed' && toEpoch(record.snoozedUntil) > 0 && toEpoch(record.snoozedUntil) <= nowEpoch) {
      next[record.id] = {
        ...record,
        status: 'expired',
        updatedAt: new Date(nowEpoch).toISOString(),
      }
      continue
    }

    if (record.status === 'muted' && toEpoch(record.mutedUntil) > 0 && toEpoch(record.mutedUntil) <= nowEpoch) {
      next[record.id] = {
        ...record,
        status: 'expired',
        updatedAt: new Date(nowEpoch).toISOString(),
      }
      continue
    }

    next[record.id] = record
  }

  return next
}

function loadLegacyDismissedIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(LEGACY_DISMISSED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
  } catch {
    return []
  }
}

function migrateLegacyDismissedIds(state: CoachAlertLifecycleState): CoachAlertLifecycleState {
  const legacyIds = loadLegacyDismissedIds()
  if (legacyIds.length === 0) return state

  const nowIso = new Date().toISOString()
  const next: CoachAlertLifecycleState = { ...state }
  for (const id of legacyIds) {
    if (next[id]) continue
    next[id] = {
      id,
      setupId: null,
      severity: 'routine',
      status: 'seen',
      seenAt: nowIso,
      updatedAt: nowIso,
    }
  }
  return next
}

export function loadCoachAlertLifecycleState(): CoachAlertLifecycleState {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(COACH_ALERT_LIFECYCLE_STORAGE_KEY)
    const nowEpoch = Date.now()

    if (!raw) {
      const migrated = pruneState(migrateLegacyDismissedIds({}), nowEpoch)
      if (Object.keys(migrated).length > 0) {
        persistCoachAlertLifecycleState(migrated)
      }
      return migrated
    }

    const parsed = JSON.parse(raw)
    const next: CoachAlertLifecycleState = {}
    if (isObject(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        const normalized = normalizeRecord(value)
        if (!normalized) continue
        next[key] = normalized
      }
    }

    const withMigration = migrateLegacyDismissedIds(next)
    const pruned = pruneState(withMigration, nowEpoch)
    return pruned
  } catch {
    return {}
  }
}

export function persistCoachAlertLifecycleState(state: CoachAlertLifecycleState): void {
  if (typeof window === 'undefined') return

  const pruned = pruneState(state, Date.now())
  try {
    window.localStorage.setItem(COACH_ALERT_LIFECYCLE_STORAGE_KEY, JSON.stringify(pruned))
    window.dispatchEvent(new CustomEvent(COACH_ALERT_LIFECYCLE_EVENT, {
      detail: { state: pruned },
    }))
  } catch {
    // Ignore storage write failures.
  }
}

function upsertRecord(
  state: CoachAlertLifecycleState,
  message: CoachMessage,
  patch: Partial<CoachAlertLifecycleRecord>,
): CoachAlertLifecycleState {
  const nowIso = new Date().toISOString()
  const existing = state[message.id]
  const nextRecord: CoachAlertLifecycleRecord = {
    id: message.id,
    setupId: message.setupId || null,
    severity: resolveCoachAlertSeverity(message),
    status: existing?.status || 'new',
    ...existing,
    ...patch,
    updatedAt: nowIso,
  }

  const next = {
    ...state,
    [message.id]: nextRecord,
  }
  persistCoachAlertLifecycleState(next)
  return next
}

export function markCoachAlertSeen(
  state: CoachAlertLifecycleState,
  message: CoachMessage,
): CoachAlertLifecycleState {
  return upsertRecord(state, message, {
    status: 'seen',
    seenAt: new Date().toISOString(),
  })
}

export function snoozeCoachAlert(
  state: CoachAlertLifecycleState,
  message: CoachMessage,
  durationMs: number,
): CoachAlertLifecycleState {
  return upsertRecord(state, message, {
    status: 'snoozed',
    snoozedUntil: new Date(Date.now() + Math.max(durationMs, 1_000)).toISOString(),
  })
}

export function muteCoachAlert(
  state: CoachAlertLifecycleState,
  message: CoachMessage,
  durationMs: number,
): CoachAlertLifecycleState {
  return upsertRecord(state, message, {
    status: 'muted',
    mutedUntil: new Date(Date.now() + Math.max(durationMs, 1_000)).toISOString(),
  })
}

export function acknowledgeCoachAlertCritical(
  state: CoachAlertLifecycleState,
  message: CoachMessage,
): CoachAlertLifecycleState {
  return upsertRecord(state, message, {
    status: 'seen',
    seenAt: new Date().toISOString(),
  })
}

function isLifecycleBlocked(record: CoachAlertLifecycleRecord | undefined, nowEpoch: number): boolean {
  if (!record) return false

  if (record.status === 'muted') {
    const mutedUntilEpoch = toEpoch(record.mutedUntil)
    if (mutedUntilEpoch === 0 || mutedUntilEpoch > nowEpoch) return true
  }

  if (record.status === 'snoozed') {
    const snoozedUntilEpoch = toEpoch(record.snoozedUntil)
    if (snoozedUntilEpoch === 0 || snoozedUntilEpoch > nowEpoch) return true
  }

  return false
}

export function shouldAutoMarkAlertSeen(
  message: CoachMessage,
  state: CoachAlertLifecycleState,
): boolean {
  if (!isAlertTone(message)) return false
  const severity = resolveCoachAlertSeverity(message)
  if (severity === 'critical') return false

  const record = state[message.id]
  if (!record) return true
  if (record.status === 'seen') return false
  if (record.status === 'muted' || record.status === 'snoozed') return false
  return true
}

const PRIORITY_RANK: Record<CoachMessage['priority'], number> = {
  alert: 0,
  setup: 1,
  guidance: 2,
  behavioral: 3,
}

const SEVERITY_RANK: Record<CoachAlertSeverity, number> = {
  critical: 0,
  warning: 1,
  routine: 2,
}

export function findTopCoachAlertV2(
  messages: CoachMessage[],
  state: CoachAlertLifecycleState,
): CoachMessage | null {
  const nowEpoch = Date.now()

  return [...messages]
    .filter((message) => isAlertTone(message))
    .sort((a, b) => {
      const severityDelta = SEVERITY_RANK[resolveCoachAlertSeverity(a)] - SEVERITY_RANK[resolveCoachAlertSeverity(b)]
      if (severityDelta !== 0) return severityDelta

      const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (priorityDelta !== 0) return priorityDelta
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })
    .find((message) => {
      const record = state[message.id]
      if (isLifecycleBlocked(record, nowEpoch)) return false

      const severity = resolveCoachAlertSeverity(message)
      if (record?.status === 'seen' && severity !== 'critical') return false
      return true
    }) || null
}
