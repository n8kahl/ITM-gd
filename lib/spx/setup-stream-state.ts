import type { Setup } from '@/lib/types/spx-command-center'

const ACTIONABLE_SETUP_STATUSES: ReadonlySet<Setup['status']> = new Set(['forming', 'ready', 'triggered'])

const SETUP_STATUS_PRIORITY: Record<Setup['status'], number> = {
  triggered: 0,
  ready: 1,
  forming: 2,
  invalidated: 3,
  expired: 4,
}

export const DEFAULT_REALTIME_SETUP_RETENTION_MS = 30_000
export const DEFAULT_TRIGGERED_DOWNGRADE_GRACE_MS = 12_000

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) ? epoch : 0
}

function roundTo(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals))
}

function setupSemanticKey(setup: Setup): string {
  return [
    setup.type,
    setup.direction,
    roundTo(setup.entryZone.low, 2),
    roundTo(setup.entryZone.high, 2),
    roundTo(setup.stop, 2),
    roundTo(setup.target1.price, 2),
    roundTo(setup.target2.price, 2),
    setup.regime,
  ].join('|')
}

function rankForDedupe(setups: Setup[]): Setup[] {
  return [...setups].sort((a, b) => {
    const statusDelta = SETUP_STATUS_PRIORITY[a.status] - SETUP_STATUS_PRIORITY[b.status]
    if (statusDelta !== 0) return statusDelta
    const recencyDelta = setupLifecycleEpoch(b) - setupLifecycleEpoch(a)
    if (recencyDelta !== 0) return recencyDelta
    return a.id.localeCompare(b.id)
  })
}

function dedupeSetupsBySemanticKey(setups: Setup[]): Setup[] {
  const ranked = rankForDedupe(setups)
  const deduped: Setup[] = []
  const seen = new Set<string>()

  for (const setup of ranked) {
    const key = setupSemanticKey(setup)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(setup)
  }

  return rankForDedupe(deduped)
}

export function setupLifecycleEpoch(setup: Setup): number {
  return Math.max(
    toEpoch(setup.statusUpdatedAt),
    toEpoch(setup.triggeredAt),
    toEpoch(setup.createdAt),
  )
}

export function shouldKeepExistingSetup(
  existing: Setup,
  incoming: Setup,
  options?: { triggeredDowngradeGraceMs?: number },
): boolean {
  const existingPriority = SETUP_STATUS_PRIORITY[existing.status]
  const incomingPriority = SETUP_STATUS_PRIORITY[incoming.status]
  const existingRecency = setupLifecycleEpoch(existing)
  const incomingRecency = setupLifecycleEpoch(incoming)
  const downgradeGraceMs = options?.triggeredDowngradeGraceMs ?? DEFAULT_TRIGGERED_DOWNGRADE_GRACE_MS

  // Protect against brief out-of-order lifecycle packets where a triggered setup
  // is immediately followed by an older ready/forming packet.
  if (existing.status === 'triggered' && (incoming.status === 'ready' || incoming.status === 'forming')) {
    return incomingRecency <= (existingRecency + downgradeGraceMs)
  }

  if (existingPriority < incomingPriority && existingRecency >= incomingRecency) {
    return true
  }

  return false
}

export function mergeSetup(
  existing: Setup | undefined,
  incoming: Setup,
  options?: { triggeredDowngradeGraceMs?: number },
): Setup {
  if (!existing) return incoming
  if (shouldKeepExistingSetup(existing, incoming, options)) {
    return {
      ...incoming,
      ...existing,
      recommendedContract: existing.recommendedContract ?? incoming.recommendedContract,
    }
  }

  return {
    ...incoming,
    recommendedContract: incoming.recommendedContract ?? existing.recommendedContract,
  }
}

export function mergeActionableSetups(
  existingSetups: Setup[],
  incomingSetups: Setup[],
  options?: {
    nowMs?: number
    retentionMs?: number
    triggeredDowngradeGraceMs?: number
  },
): Setup[] {
  const nowMs = options?.nowMs ?? Date.now()
  const retentionMs = options?.retentionMs ?? DEFAULT_REALTIME_SETUP_RETENTION_MS
  const incomingIds = new Set(incomingSetups.map((setup) => setup.id))
  const merged = new Map(existingSetups.map((setup) => [setup.id, setup]))

  for (const incoming of incomingSetups) {
    const current = merged.get(incoming.id)
    const nextSetup = mergeSetup(current, incoming, {
      triggeredDowngradeGraceMs: options?.triggeredDowngradeGraceMs,
    })
    if (ACTIONABLE_SETUP_STATUSES.has(nextSetup.status)) {
      merged.set(nextSetup.id, nextSetup)
    } else {
      merged.delete(nextSetup.id)
    }
  }

  for (const existing of existingSetups) {
    if (incomingIds.has(existing.id)) continue
    if (!ACTIONABLE_SETUP_STATUSES.has(existing.status)) {
      merged.delete(existing.id)
      continue
    }

    const ageMs = nowMs - setupLifecycleEpoch(existing)
    if (ageMs > retentionMs) {
      merged.delete(existing.id)
    }
  }

  return dedupeSetupsBySemanticKey(Array.from(merged.values()))
}

