import fs from 'node:fs'
import path from 'node:path'

export const TRADE_STREAM_LIFECYCLE_ORDER = ['forming', 'triggered', 'past'] as const

export type TradeStreamLifecycleState = (typeof TRADE_STREAM_LIFECYCLE_ORDER)[number]

export type TradeStreamItemContract = {
  id: string
  stableIdHash: string
  lifecycleState: TradeStreamLifecycleState
  status: string
  direction: string
  setupType: string
  entryZone: {
    low: number
    high: number
  }
  stop: number
  target1: number
  target2: number
  probability: number
  confluenceScore: number
  evR: number
  alignmentScore: number
  momentPriority: number
  recommendedAction: string
  actionBlockedReason: string | null
  freshness: {
    source: string
    generatedAt: string
    ageMs: number
    degraded: boolean
  }
  timing: {
    createdAt: string
    triggeredAt: string | null
    resolvedAt: string | null
    etaToTriggerMs: number | null
  }
  reason: {
    triggerContext: string
    gateReasons: string[]
    decisionDrivers: string[]
    decisionRisks: string[]
  }
  outcome: {
    result: string
    rMultiple: number
    resolvedBy: string
  } | null
}

export type TradeStreamSnapshotContract = {
  items: TradeStreamItemContract[]
  nowFocusItemId: string | null
  countsByLifecycle: Record<TradeStreamLifecycleState, number>
  feedTrust: {
    source: string
    generatedAt: string
    ageMs: number
    degraded: boolean
    stale: boolean
    reason: string | null
  }
  generatedAt: string
}

export type TradeStreamSelectorContract = {
  route: string
  version: string
  lifecycleOrder: TradeStreamLifecycleState[]
  selectors: Record<string, string>
  dynamicSelectors: {
    tradeStreamRowByStableHash: string
  }
}

const TRADE_STREAM_FIXTURE_DIR = path.resolve(process.cwd(), 'e2e/fixtures/spx-trade-stream')

const TRADE_STREAM_FIXTURE_FILES = {
  unordered: 'trade-stream.unordered.json',
  expectedOrdered: 'trade-stream.expected-ordered.json',
  empty: 'trade-stream.empty.json',
} as const

export type TradeStreamFixtureId = keyof typeof TRADE_STREAM_FIXTURE_FILES

function readFixtureFile<T>(fileName: string): T {
  const fullPath = path.resolve(TRADE_STREAM_FIXTURE_DIR, fileName)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  return JSON.parse(raw) as T
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function lifecycleRank(lifecycle: TradeStreamLifecycleState): number {
  return TRADE_STREAM_LIFECYCLE_ORDER.indexOf(lifecycle)
}

function parseIsoTimestamp(iso: string | null | undefined): number {
  if (!iso) return Number.NaN
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : Number.NaN
}

function compareTriggeredRecency(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  const lhsMs = parseIsoTimestamp(lhs.timing.triggeredAt)
  const rhsMs = parseIsoTimestamp(rhs.timing.triggeredAt)
  const lhsSafe = Number.isFinite(lhsMs) ? lhsMs : Number.NEGATIVE_INFINITY
  const rhsSafe = Number.isFinite(rhsMs) ? rhsMs : Number.NEGATIVE_INFINITY
  return rhsSafe - lhsSafe
}

function compareResolvedRecency(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  const lhsMs = parseIsoTimestamp(lhs.timing.resolvedAt)
  const rhsMs = parseIsoTimestamp(rhs.timing.resolvedAt)
  const lhsSafe = Number.isFinite(lhsMs) ? lhsMs : Number.NEGATIVE_INFINITY
  const rhsSafe = Number.isFinite(rhsMs) ? rhsMs : Number.NEGATIVE_INFINITY
  return rhsSafe - lhsSafe
}

function compareEta(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  const lhsEta = typeof lhs.timing.etaToTriggerMs === 'number' ? lhs.timing.etaToTriggerMs : Number.POSITIVE_INFINITY
  const rhsEta = typeof rhs.timing.etaToTriggerMs === 'number' ? rhs.timing.etaToTriggerMs : Number.POSITIVE_INFINITY
  return lhsEta - rhsEta
}

function compareWithinLifecycle(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  if (lhs.momentPriority !== rhs.momentPriority) {
    return rhs.momentPriority - lhs.momentPriority
  }

  if (lhs.lifecycleState === 'forming') {
    const etaComparison = compareEta(lhs, rhs)
    if (etaComparison !== 0) return etaComparison
  }

  if (lhs.lifecycleState === 'triggered') {
    const triggeredComparison = compareTriggeredRecency(lhs, rhs)
    if (triggeredComparison !== 0) return triggeredComparison
  }

  if (lhs.lifecycleState === 'past') {
    const resolvedComparison = compareResolvedRecency(lhs, rhs)
    if (resolvedComparison !== 0) return resolvedComparison
  }

  return lhs.stableIdHash.localeCompare(rhs.stableIdHash)
}

function compareNowFocus(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  if (lhs.momentPriority !== rhs.momentPriority) {
    return rhs.momentPriority - lhs.momentPriority
  }

  const lhsReferenceMs = parseIsoTimestamp(lhs.timing.triggeredAt || lhs.timing.resolvedAt || lhs.timing.createdAt)
  const rhsReferenceMs = parseIsoTimestamp(rhs.timing.triggeredAt || rhs.timing.resolvedAt || rhs.timing.createdAt)
  const lhsSafeMs = Number.isFinite(lhsReferenceMs) ? lhsReferenceMs : Number.NEGATIVE_INFINITY
  const rhsSafeMs = Number.isFinite(rhsReferenceMs) ? rhsReferenceMs : Number.NEGATIVE_INFINITY
  if (lhsSafeMs !== rhsSafeMs) {
    return rhsSafeMs - lhsSafeMs
  }

  const stableHashComparison = lhs.stableIdHash.localeCompare(rhs.stableIdHash)
  if (stableHashComparison !== 0) return stableHashComparison

  return lhs.id.localeCompare(rhs.id)
}

export function compareTradeStreamItems(lhs: TradeStreamItemContract, rhs: TradeStreamItemContract): number {
  const lifecycleComparison = lifecycleRank(lhs.lifecycleState) - lifecycleRank(rhs.lifecycleState)
  if (lifecycleComparison !== 0) return lifecycleComparison
  return compareWithinLifecycle(lhs, rhs)
}

export function sortTradeStreamItems(items: TradeStreamItemContract[]): TradeStreamItemContract[] {
  return [...items].sort(compareTradeStreamItems)
}

export function assertTradeStreamLifecycleOrder(items: TradeStreamItemContract[]): boolean {
  for (let index = 1; index < items.length; index += 1) {
    if (lifecycleRank(items[index - 1].lifecycleState) > lifecycleRank(items[index].lifecycleState)) {
      return false
    }
  }
  return true
}

export function calculateCountsByLifecycle(items: TradeStreamItemContract[]): Record<TradeStreamLifecycleState, number> {
  const counts: Record<TradeStreamLifecycleState, number> = {
    forming: 0,
    triggered: 0,
    past: 0,
  }
  for (const item of items) {
    counts[item.lifecycleState] += 1
  }
  return counts
}

export function selectNowFocusItemId(items: TradeStreamItemContract[]): string | null {
  if (items.length === 0) return null
  const sorted = [...items].sort(compareNowFocus)
  return sorted[0]?.id ?? null
}

export function getContractOrderedTradeStreamSnapshot(
  snapshot: TradeStreamSnapshotContract,
): TradeStreamSnapshotContract {
  const orderedItems = sortTradeStreamItems(snapshot.items)
  return {
    ...snapshot,
    items: orderedItems,
    countsByLifecycle: calculateCountsByLifecycle(orderedItems),
    nowFocusItemId: selectNowFocusItemId(orderedItems),
  }
}

export function readTradeStreamSnapshotFixture(
  fixtureId: TradeStreamFixtureId = 'expectedOrdered',
): TradeStreamSnapshotContract {
  const fixture = readFixtureFile<TradeStreamSnapshotContract>(TRADE_STREAM_FIXTURE_FILES[fixtureId])
  return clone(fixture)
}

export function readTradeStreamSelectorContractFixture(): TradeStreamSelectorContract {
  const fixture = readFixtureFile<TradeStreamSelectorContract>('selector-contract.json')
  return clone(fixture)
}
