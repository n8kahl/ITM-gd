import type { Setup } from '@/lib/types/spx-command-center'

export interface TriggeredAlertHistoryItem {
  id: string
  setupId: string
  setupType: string
  direction: Setup['direction']
  regime: Setup['regime']
  triggeredAt: string
  entryLow: number
  entryHigh: number
  stop: number
  target1: number
  target2: number
  confluenceScore: number
  probability: number
}

export interface TriggeredAlertState {
  history: TriggeredAlertHistoryItem[]
  previousStatusBySetupId: Record<string, Setup['status']>
}

export const MAX_TRIGGER_ALERT_HISTORY = 40
export const TRIGGER_ALERT_HISTORY_PREVIEW = 4

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function sanitizeTriggeredAlertHistory(input: unknown): TriggeredAlertHistoryItem[] {
  if (!Array.isArray(input)) return []
  const normalized: TriggeredAlertHistoryItem[] = []

  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<TriggeredAlertHistoryItem>
    if (typeof candidate.id !== 'string') continue
    if (typeof candidate.setupId !== 'string') continue
    if (typeof candidate.setupType !== 'string') continue
    if (candidate.direction !== 'bullish' && candidate.direction !== 'bearish') continue
    if (typeof candidate.regime !== 'string') continue
    if (typeof candidate.triggeredAt !== 'string') continue
    if (!isFiniteNumber(candidate.entryLow)) continue
    if (!isFiniteNumber(candidate.entryHigh)) continue
    if (!isFiniteNumber(candidate.stop)) continue
    if (!isFiniteNumber(candidate.target1)) continue
    if (!isFiniteNumber(candidate.target2)) continue

    normalized.push({
      id: candidate.id,
      setupId: candidate.setupId,
      setupType: candidate.setupType,
      direction: candidate.direction,
      regime: candidate.regime as TriggeredAlertHistoryItem['regime'],
      triggeredAt: candidate.triggeredAt,
      entryLow: candidate.entryLow,
      entryHigh: candidate.entryHigh,
      stop: candidate.stop,
      target1: candidate.target1,
      target2: candidate.target2,
      // Backwards compatibility for payloads persisted before these fields existed.
      confluenceScore: isFiniteNumber(candidate.confluenceScore) ? candidate.confluenceScore : 0,
      probability: isFiniteNumber(candidate.probability) ? candidate.probability : 0,
    })
  }

  return normalized.slice(0, MAX_TRIGGER_ALERT_HISTORY)
}

function toHistoryItem(setup: Setup): TriggeredAlertHistoryItem {
  const triggeredAt = setup.statusUpdatedAt || setup.triggeredAt || new Date().toISOString()
  return {
    id: `${setup.id}:${triggeredAt}`,
    setupId: setup.id,
    setupType: setup.type,
    direction: setup.direction,
    regime: setup.regime,
    triggeredAt,
    entryLow: setup.entryZone.low,
    entryHigh: setup.entryZone.high,
    stop: setup.stop,
    target1: setup.target1.price,
    target2: setup.target2.price,
    confluenceScore: setup.confluenceScore,
    probability: setup.probability,
  }
}

function mergeHistory(
  incoming: TriggeredAlertHistoryItem[],
  existing: TriggeredAlertHistoryItem[],
): TriggeredAlertHistoryItem[] {
  const deduped = new Map<string, TriggeredAlertHistoryItem>()
  for (const item of [...incoming, ...existing]) {
    deduped.set(item.id, item)
  }
  return Array.from(deduped.values())
    .sort((a, b) => Date.parse(b.triggeredAt) - Date.parse(a.triggeredAt))
    .slice(0, MAX_TRIGGER_ALERT_HISTORY)
}

export function createTriggeredAlertState(initialHistory: TriggeredAlertHistoryItem[] = []): TriggeredAlertState {
  return {
    history: initialHistory.slice(0, MAX_TRIGGER_ALERT_HISTORY),
    previousStatusBySetupId: {},
  }
}

export function ingestTriggeredAlertSetups(state: TriggeredAlertState, setups: Setup[]): TriggeredAlertState {
  const nextStatusBySetupId: Record<string, Setup['status']> = {}
  const newlyTriggered: TriggeredAlertHistoryItem[] = []

  for (const setup of setups) {
    nextStatusBySetupId[setup.id] = setup.status
    const previousStatus = state.previousStatusBySetupId[setup.id]
    const transitionedToTriggered = previousStatus != null
      ? (previousStatus !== 'triggered' && setup.status === 'triggered')
      : setup.status === 'triggered'
    if (!transitionedToTriggered) continue
    newlyTriggered.push(toHistoryItem(setup))
  }

  if (newlyTriggered.length === 0) {
    return {
      history: state.history,
      previousStatusBySetupId: nextStatusBySetupId,
    }
  }

  return {
    history: mergeHistory(newlyTriggered, state.history),
    previousStatusBySetupId: nextStatusBySetupId,
  }
}
