const DEFAULT_WIDGET_EVENT_DEDUPE_WINDOW_MS = 10_000

function getCryptoRandomUUID(): (() => string) | null {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID.bind(globalThis.crypto)
  }
  return null
}

export function createWidgetEventId(
  randomUUID: (() => string) | null = getCryptoRandomUUID(),
): string {
  if (randomUUID) return randomUUID()
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function readWidgetEventId(detail: unknown): string | null {
  if (!detail || typeof detail !== 'object') return null
  const candidate = (detail as { eventId?: unknown }).eventId
  if (typeof candidate !== 'string') return null
  const normalized = candidate.trim()
  return normalized.length > 0 ? normalized : null
}

export function createWidgetEventDeduper(
  dedupeWindowMs: number = DEFAULT_WIDGET_EVENT_DEDUPE_WINDOW_MS,
): (eventName: string, detail: unknown) => boolean {
  const seen = new Map<string, number>()

  return (eventName: string, detail: unknown): boolean => {
    const eventId = readWidgetEventId(detail)
    if (!eventId) return true

    const now = Date.now()
    for (const [key, expiresAt] of seen.entries()) {
      if (expiresAt <= now) seen.delete(key)
    }

    const dedupeKey = `${eventName}:${eventId}`
    if (seen.has(dedupeKey)) return false

    seen.set(dedupeKey, now + dedupeWindowMs)
    return true
  }
}

