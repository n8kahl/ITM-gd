'use client'

import { trackEvent } from '@/lib/analytics'

export type AICoachMarketFreshnessStatus = 'live' | 'delayed' | 'stale' | 'market-closed'

export interface AICoachMarketSnapshot {
  price: number | null
  change: number | null
  changePct: number | null
  source: string | null
  marketStatus: string | null
  marketSession: string | null
  marketMessage: string | null
  asOfEt: string | null
  updatedAtMs: number | null
  ageMs: number | null
  freshnessStatus: AICoachMarketFreshnessStatus
  freshnessLabel: string
  freshnessDetail: string
  isStale: boolean
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export interface AICoachMarketTelemetryRecord {
  event: 'market_snapshot_transition'
  payload: Record<string, unknown>
  timestamp: string
  route: string
}

const LIVE_AGE_MAX_MS = 20_000
const DELAYED_AGE_MAX_MS = 90_000
const CLIENT_EVENT_BUFFER_MAX = 200

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function isMarketClosed(status: string | null): boolean {
  if (!status) return false
  return status === 'closed'
}

function clampAgeMs(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(Math.round(value), 0)
}

function serializePayload(payload: Record<string, unknown>, max = 220): string {
  try {
    const serialized = JSON.stringify(payload)
    return serialized.length > max ? `${serialized.slice(0, max)}...` : serialized
  } catch {
    return '[unserializable-payload]'
  }
}

export function resolveAICoachMarketFreshnessStatus(params: {
  marketStatus: string | null
  source: string | null
  ageMs: number | null
}): AICoachMarketFreshnessStatus {
  if (isMarketClosed(params.marketStatus)) {
    return 'market-closed'
  }

  if (params.source === 'fallback') {
    return 'stale'
  }

  const ageMs = clampAgeMs(params.ageMs)
  if (ageMs == null) return 'stale'
  if (ageMs <= LIVE_AGE_MAX_MS) return 'live'
  if (ageMs <= DELAYED_AGE_MAX_MS) return 'delayed'
  return 'stale'
}

export function formatAICoachFreshnessLabel(status: AICoachMarketFreshnessStatus): string {
  switch (status) {
    case 'live':
      return 'Live'
    case 'delayed':
      return 'Delayed'
    case 'market-closed':
      return 'Market Closed'
    case 'stale':
    default:
      return 'Stale'
  }
}

export function formatAICoachAgeLabel(ageMs: number | null): string {
  const normalized = clampAgeMs(ageMs)
  if (normalized == null) return 'Age unavailable'
  if (normalized < 1000) return '<1s old'

  const totalSeconds = Math.floor(normalized / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s old`

  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m old`

  const totalHours = Math.floor(totalMinutes / 60)
  return `${totalHours}h old`
}

export function formatAICoachAsOfEt(updatedAtMs: number | null): string | null {
  const normalized = clampAgeMs(updatedAtMs)
  if (normalized == null) return null

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(normalized))
}

export function pushAICoachMarketTelemetry(
  payload: Record<string, unknown>,
  options?: { persist?: boolean },
): void {
  if (!isClient()) return

  const record: AICoachMarketTelemetryRecord = {
    event: 'market_snapshot_transition',
    payload: { ...payload },
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
  }

  const current = window.__aiCoachMarketTelemetry || []
  const next = current.length >= CLIENT_EVENT_BUFFER_MAX
    ? [...current.slice(current.length - CLIENT_EVENT_BUFFER_MAX + 1), record]
    : [...current, record]

  window.__aiCoachMarketTelemetry = next
  window.dispatchEvent(new CustomEvent('ai-coach:market-telemetry', { detail: record }))

  if (options?.persist) {
    void trackEvent('ai_coach_market_snapshot', serializePayload(record.payload))
  }
}

declare global {
  interface Window {
    __aiCoachMarketTelemetry?: AICoachMarketTelemetryRecord[]
  }
}
