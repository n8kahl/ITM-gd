import type { CoachMessage } from '@/lib/types/spx-command-center'

export interface SPXAlertSuppressionResult {
  messages: CoachMessage[]
  suppressedCount: number
}

function normalizeFingerprint(message: CoachMessage): string {
  const setupId = message.setupId || 'global'
  const normalized = message.content
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${message.priority}:${setupId}:${normalized}`
}

function toEpoch(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

export function applySPXAlertSuppression(
  messages: CoachMessage[],
  options?: { cooldownMs?: number },
): SPXAlertSuppressionResult {
  const cooldownMs = options?.cooldownMs ?? (4 * 60 * 1000)
  const latestByFingerprint = new Map<string, number>()
  const kept: CoachMessage[] = []
  let suppressedCount = 0

  const sorted = [...messages].sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp))
  for (const message of sorted) {
    if (message.priority !== 'alert') {
      kept.push(message)
      continue
    }
    const fingerprint = normalizeFingerprint(message)
    const seenEpoch = latestByFingerprint.get(fingerprint)
    const currentEpoch = toEpoch(message.timestamp)
    if (seenEpoch != null && seenEpoch - currentEpoch <= cooldownMs) {
      suppressedCount += 1
      continue
    }
    latestByFingerprint.set(fingerprint, currentEpoch)
    kept.push(message)
  }

  return {
    messages: kept.sort((a, b) => toEpoch(b.timestamp) - toEpoch(a.timestamp)),
    suppressedCount,
  }
}
