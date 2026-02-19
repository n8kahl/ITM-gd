import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import {
  findTopCoachAlertV2,
  loadCoachAlertLifecycleState,
  markCoachAlertSeen,
  muteCoachAlert,
  snoozeCoachAlert,
  type CoachAlertLifecycleState,
} from '@/lib/spx/coach-alert-state-v2'

function buildMessage(overrides?: Partial<CoachMessage>): CoachMessage {
  return {
    id: `msg_${Math.random().toString(16).slice(2)}`,
    type: 'pre_trade',
    priority: 'setup',
    setupId: 'setup-1',
    content: 'Entry is valid if flow confirms.',
    structuredData: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('coach-alert-state-v2', () => {
  beforeEach(() => {
    const createStorage = () => {
      const store = new Map<string, string>()
      return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
      }
    }

    class MockCustomEvent<T = unknown> {
      type: string
      detail: T | undefined

      constructor(type: string, init?: { detail?: T }) {
        this.type = type
        this.detail = init?.detail
      }
    }

    vi.stubGlobal('CustomEvent', MockCustomEvent)
    vi.stubGlobal('window', {
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      dispatchEvent: () => true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads empty state when no storage exists', () => {
    window.localStorage.removeItem('spx.coach.alert.lifecycle.v2')
    window.sessionStorage.removeItem('spx.coach.dismissed_alert_ids.v1')
    expect(loadCoachAlertLifecycleState()).toEqual({})
  })

  it('marks alerts as seen', () => {
    const message = buildMessage({ id: 'seen-alert-1' })
    const next = markCoachAlertSeen({}, message)
    expect(next['seen-alert-1']?.status).toBe('seen')
    expect(typeof next['seen-alert-1']?.seenAt).toBe('string')
  })

  it('snoozes and mutes alerts with future expiry', () => {
    const message = buildMessage({ id: 'mute-alert-1' })
    const snoozed = snoozeCoachAlert({}, message, 60_000)
    expect(snoozed['mute-alert-1']?.status).toBe('snoozed')
    expect(Date.parse(snoozed['mute-alert-1']?.snoozedUntil || '')).toBeGreaterThan(Date.now())

    const muted = muteCoachAlert(snoozed, message, 120_000)
    expect(muted['mute-alert-1']?.status).toBe('muted')
    expect(Date.parse(muted['mute-alert-1']?.mutedUntil || '')).toBeGreaterThan(Date.now())
  })

  it('finds highest severity visible alert and skips seen routine alerts', () => {
    const routine = buildMessage({ id: 'routine-1', priority: 'setup' })
    const warning = buildMessage({
      id: 'warning-1',
      priority: 'alert',
      structuredData: { severity: 'warning' },
    })
    const critical = buildMessage({
      id: 'critical-1',
      priority: 'alert',
      structuredData: { severity: 'critical' },
    })

    const initialTop = findTopCoachAlertV2([routine, warning, critical], {})
    expect(initialTop?.id).toBe('critical-1')

    const seenRoutine = markCoachAlertSeen({}, routine)
    const topWithRoutineSeen = findTopCoachAlertV2([routine, warning], seenRoutine as CoachAlertLifecycleState)
    expect(topWithRoutineSeen?.id).toBe('warning-1')
  })
})
