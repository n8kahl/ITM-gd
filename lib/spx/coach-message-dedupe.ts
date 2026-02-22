import type { CoachMessage } from '@/lib/types/spx-command-center'

const DEFAULT_DEDUPE_WINDOW_MS = 8 * 60 * 1000

function toEpoch(timestamp: string): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function structuredReason(message: CoachMessage): string {
  const data = message.structuredData
  if (!data || typeof data !== 'object') return ''
  return typeof data.reason === 'string' ? data.reason : ''
}

function semanticSignature(message: CoachMessage): string {
  return [
    message.setupId || 'global',
    message.type,
    message.priority,
    structuredReason(message),
    normalizeContent(message.content),
  ].join('|')
}

export function dedupeCoachMessagesForTimeline(
  messages: CoachMessage[],
  dedupeWindowMs: number = DEFAULT_DEDUPE_WINDOW_MS,
): CoachMessage[] {
  if (messages.length <= 1) return messages

  const lastTimestampBySignature = new Map<string, number>()
  const result: CoachMessage[] = []

  for (const message of messages) {
    const signature = semanticSignature(message)
    const timestamp = toEpoch(message.timestamp)
    const previous = lastTimestampBySignature.get(signature)
    if (previous != null && Math.abs(previous - timestamp) <= dedupeWindowMs) {
      continue
    }
    lastTimestampBySignature.set(signature, timestamp)
    result.push(message)
  }

  return result
}

