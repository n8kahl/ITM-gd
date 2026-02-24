import type { FlowEvent, FlowWindowAggregation } from '@/lib/types/spx-command-center'

export interface FlowTelemetrySnapshot {
  latestEventAt: string | null
  latestEventAgeMs: number | null
  isStale: boolean
  events1m: number
  events5m: number
  sweepCount5m: number
  blockCount5m: number
  bullishPremium5m: number
  bearishPremium5m: number
  netPremium5m: number
  bullishShare5m: number
}

interface BuildFlowTelemetrySnapshotInput {
  flowEvents: FlowEvent[]
  flowAggregation?: FlowWindowAggregation | null
  nowMs?: number
  staleAfterMs?: number
}

const DEFAULT_STALE_AFTER_MS = 90_000

function toEpochMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildFlowTelemetrySnapshot(input: BuildFlowTelemetrySnapshotInput): FlowTelemetrySnapshot {
  const nowMs = input.nowMs ?? Date.now()
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS

  const validEvents = input.flowEvents
    .map((event) => {
      const epochMs = toEpochMs(event.timestamp)
      if (epochMs == null) return null
      return { ...event, epochMs }
    })
    .filter((event): event is (FlowEvent & { epochMs: number }) => Boolean(event))

  const latestEventAt = input.flowAggregation?.latestEventAt
    || (validEvents[0] ? new Date(Math.max(...validEvents.map((event) => event.epochMs))).toISOString() : null)
  const latestEventEpoch = toEpochMs(latestEventAt)
  const latestEventAgeMs = latestEventEpoch == null ? null : Math.max(0, nowMs - latestEventEpoch)

  const oneMinuteCutoff = nowMs - 60_000
  const fiveMinuteCutoff = nowMs - 5 * 60_000
  const events1m = validEvents.filter((event) => event.epochMs >= oneMinuteCutoff && event.epochMs <= nowMs)
  const events5m = validEvents.filter((event) => event.epochMs >= fiveMinuteCutoff && event.epochMs <= nowMs)

  const aggregated5m = input.flowAggregation?.windows?.['5m']
  const bullishPremium5m = aggregated5m
    ? aggregated5m.bullishPremium
    : events5m.filter((event) => event.direction === 'bullish').reduce((sum, event) => sum + event.premium, 0)
  const bearishPremium5m = aggregated5m
    ? aggregated5m.bearishPremium
    : events5m.filter((event) => event.direction === 'bearish').reduce((sum, event) => sum + event.premium, 0)
  const sweepCount5m = aggregated5m
    ? aggregated5m.sweepCount
    : events5m.filter((event) => event.type === 'sweep').length
  const blockCount5m = aggregated5m
    ? aggregated5m.blockCount
    : events5m.filter((event) => event.type === 'block').length

  const grossPremium = Math.max(bullishPremium5m + bearishPremium5m, 0)
  const bullishShare5m = grossPremium > 0 ? (bullishPremium5m / grossPremium) * 100 : 50
  const isStale = latestEventAgeMs == null || latestEventAgeMs > staleAfterMs

  return {
    latestEventAt,
    latestEventAgeMs,
    isStale,
    events1m: events1m.length,
    events5m: aggregated5m?.eventCount ?? events5m.length,
    sweepCount5m,
    blockCount5m,
    bullishPremium5m,
    bearishPremium5m,
    netPremium5m: bullishPremium5m - bearishPremium5m,
    bullishShare5m,
  }
}
