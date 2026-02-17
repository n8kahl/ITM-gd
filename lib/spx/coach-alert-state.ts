'use client'

import type { CoachMessage } from '@/lib/types/spx-command-center'

export const COACH_ALERT_DISMISS_STORAGE_KEY = 'spx.coach.dismissed_alert_ids.v1'
export const COACH_ALERT_DISMISS_EVENT = 'spx:coach-alert-dismissed'

const PRIORITY_RANK: Record<CoachMessage['priority'], number> = {
  alert: 0,
  setup: 1,
  guidance: 2,
  behavioral: 3,
}

export function loadDismissedCoachAlertIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.sessionStorage.getItem(COACH_ALERT_DISMISS_STORAGE_KEY)
    if (!raw) return new Set()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set()
  }
}

export function persistDismissedCoachAlertIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return

  try {
    const payload = Array.from(ids)
    window.sessionStorage.setItem(COACH_ALERT_DISMISS_STORAGE_KEY, JSON.stringify(payload))
    window.dispatchEvent(new CustomEvent(COACH_ALERT_DISMISS_EVENT, {
      detail: { ids: payload },
    }))
  } catch {
    // Ignore storage write failures.
  }
}

export function acknowledgeCoachAlert(
  dismissedIds: Set<string>,
  messageId: string,
): Set<string> {
  const next = new Set(dismissedIds)
  next.add(messageId)
  persistDismissedCoachAlertIds(next)
  return next
}

export function findTopCoachAlert(
  messages: CoachMessage[],
  dismissedIds?: Set<string>,
): CoachMessage | null {
  const dismissed = dismissedIds ?? new Set<string>()

  return [...messages]
    .sort((a, b) => {
      const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (priorityDelta !== 0) return priorityDelta
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })
    .find((message) => {
      const isAlertTone = message.priority === 'alert' || message.priority === 'setup'
      return isAlertTone && !dismissed.has(message.id)
    }) || null
}
