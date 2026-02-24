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
  const filtered = input.filter((item): item is TriggeredAlertHistoryItem => (
    Boolean(item)
    && typeof (item as TriggeredAlertHistoryItem).id === 'string'
    && typeof (item as TriggeredAlertHistoryItem).setupId === 'string'
    && typeof (item as TriggeredAlertHistoryItem).setupType === 'string'
    && ((item as TriggeredAlertHistoryItem).direction === 'bullish' || (item as TriggeredAlertHistoryItem).direction === 'bearish')
    && typeof (item as TriggeredAlertHistoryItem).regime === 'string'
    && typeof (item as TriggeredAlertHistoryItem).triggeredAt === 'string'
    && isFiniteNumber((item as TriggeredAlertHistoryItem).entryLow)
    && isFiniteNumber((item as TriggeredAlertHistoryItem).entryHigh)
    && isFiniteNumber((item as TriggeredAlertHistoryItem).stop)
    && isFiniteNumber((item as TriggeredAlertHistoryItem).target1)
    && isFiniteNumber((item as TriggeredAlertHistoryItem).target2)
  ))
  return filtered.slice(0, MAX_TRIGGER_ALERT_HISTORY)
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
