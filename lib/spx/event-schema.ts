export type SPXRealtimeEventKind =
  | 'price'
  | 'status'
  | 'microbar'
  | 'spx_setup'
  | 'spx_coach'
  | 'heartbeat'
  | 'unknown'

export interface SPXRealtimeMessage {
  type?: unknown
  channel?: unknown
  symbol?: unknown
  timestamp?: unknown
  source?: unknown
  feedAgeMs?: unknown
  sequence?: unknown
  seq?: unknown
  [key: string]: unknown
}

export interface SPXRealtimeEvent {
  kind: SPXRealtimeEventKind
  channel: string | null
  symbol: string | null
  timestamp: string | null
  source: 'tick' | 'poll' | 'snapshot' | null
  feedAgeMs: number | null
  sequence: number | null
  receivedAtMs: number
}

const KNOWN_EVENT_TYPES = new Set<SPXRealtimeEventKind>([
  'price',
  'status',
  'microbar',
  'spx_setup',
  'spx_coach',
  'heartbeat',
])

function normalizeKind(value: unknown): SPXRealtimeEventKind {
  if (typeof value !== 'string') return 'unknown'
  const normalized = value.trim().toLowerCase() as SPXRealtimeEventKind
  return KNOWN_EVENT_TYPES.has(normalized) ? normalized : 'unknown'
}

function normalizeChannel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toUpperCase()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const epoch = Date.parse(trimmed)
  return Number.isFinite(epoch) ? trimmed : null
}

function normalizeFeedAgeMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed))
    }
  }
  return null
}

function normalizeSource(value: unknown): 'tick' | 'poll' | 'snapshot' | null {
  if (value === 'tick' || value === 'poll' || value === 'snapshot') return value
  return null
}

function normalizeSequence(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed))
    }
  }
  return null
}

export function normalizeSPXRealtimeEvent(
  message: SPXRealtimeMessage,
  receivedAtMs = Date.now(),
): SPXRealtimeEvent {
  return {
    kind: normalizeKind(message.type),
    channel: normalizeChannel(message.channel),
    symbol: normalizeSymbol(message.symbol),
    timestamp: normalizeTimestamp(message.timestamp),
    source: normalizeSource(message.source),
    feedAgeMs: normalizeFeedAgeMs(message.feedAgeMs),
    sequence: normalizeSequence(message.sequence ?? message.seq),
    receivedAtMs,
  }
}
