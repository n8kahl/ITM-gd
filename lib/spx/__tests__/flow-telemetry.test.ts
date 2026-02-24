import { describe, expect, it } from 'vitest'

import { buildFlowTelemetrySnapshot } from '@/lib/spx/flow-telemetry'
import type { FlowEvent, FlowWindowAggregation } from '@/lib/types/spx-command-center'

function buildEvent(partial?: Partial<FlowEvent>): FlowEvent {
  return {
    id: partial?.id ?? 'flow-1',
    type: partial?.type ?? 'sweep',
    symbol: partial?.symbol ?? 'SPX',
    strike: partial?.strike ?? 6890,
    expiry: partial?.expiry ?? '2026-02-25',
    size: partial?.size ?? 1000,
    direction: partial?.direction ?? 'bullish',
    premium: partial?.premium ?? 210_000,
    timestamp: partial?.timestamp ?? '2026-02-24T15:00:00.000Z',
  }
}

function buildAggregation(partial?: Partial<FlowWindowAggregation>): FlowWindowAggregation {
  return {
    generatedAt: partial?.generatedAt ?? '2026-02-24T15:00:10.000Z',
    source: partial?.source ?? 'computed',
    directionalBias: partial?.directionalBias ?? 'bullish',
    primaryWindow: partial?.primaryWindow ?? '5m',
    latestEventAt: partial?.latestEventAt ?? '2026-02-24T15:00:00.000Z',
    windows: partial?.windows ?? {
      '5m': {
        window: '5m',
        startAt: '2026-02-24T14:55:00.000Z',
        endAt: '2026-02-24T15:00:00.000Z',
        eventCount: 3,
        sweepCount: 2,
        blockCount: 1,
        bullishPremium: 400_000,
        bearishPremium: 100_000,
        totalPremium: 500_000,
        flowScore: 80,
        bias: 'bullish',
      },
      '15m': {
        window: '15m',
        startAt: '2026-02-24T14:45:00.000Z',
        endAt: '2026-02-24T15:00:00.000Z',
        eventCount: 4,
        sweepCount: 2,
        blockCount: 2,
        bullishPremium: 500_000,
        bearishPremium: 200_000,
        totalPremium: 700_000,
        flowScore: 71,
        bias: 'bullish',
      },
      '30m': {
        window: '30m',
        startAt: '2026-02-24T14:30:00.000Z',
        endAt: '2026-02-24T15:00:00.000Z',
        eventCount: 5,
        sweepCount: 3,
        blockCount: 2,
        bullishPremium: 550_000,
        bearishPremium: 250_000,
        totalPremium: 800_000,
        flowScore: 68.75,
        bias: 'bullish',
      },
    },
  }
}

describe('flow telemetry snapshot', () => {
  it('computes one-minute and five-minute stats from raw events', () => {
    const nowMs = Date.parse('2026-02-24T15:00:00.000Z')
    const snapshot = buildFlowTelemetrySnapshot({
      nowMs,
      flowEvents: [
        buildEvent({ id: 'e1', timestamp: '2026-02-24T14:59:50.000Z', direction: 'bullish', premium: 200_000, type: 'sweep' }),
        buildEvent({ id: 'e2', timestamp: '2026-02-24T14:58:50.000Z', direction: 'bearish', premium: 120_000, type: 'block' }),
      ],
      flowAggregation: null,
    })

    expect(snapshot.events1m).toBe(1)
    expect(snapshot.events5m).toBe(2)
    expect(snapshot.sweepCount5m).toBe(1)
    expect(snapshot.blockCount5m).toBe(1)
    expect(snapshot.netPremium5m).toBe(80_000)
    expect(snapshot.isStale).toBe(false)
  })

  it('prefers 5m aggregation window when provided', () => {
    const snapshot = buildFlowTelemetrySnapshot({
      nowMs: Date.parse('2026-02-24T15:00:10.000Z'),
      flowEvents: [],
      flowAggregation: buildAggregation(),
    })

    expect(snapshot.events5m).toBe(3)
    expect(snapshot.sweepCount5m).toBe(2)
    expect(snapshot.blockCount5m).toBe(1)
    expect(snapshot.bullishPremium5m).toBe(400_000)
    expect(snapshot.bearishPremium5m).toBe(100_000)
    expect(snapshot.bullishShare5m).toBe(80)
  })

  it('marks flow stale when latest event is older than threshold', () => {
    const snapshot = buildFlowTelemetrySnapshot({
      nowMs: Date.parse('2026-02-24T15:03:00.000Z'),
      staleAfterMs: 60_000,
      flowEvents: [buildEvent({ timestamp: '2026-02-24T15:00:00.000Z' })],
      flowAggregation: null,
    })
    expect(snapshot.isStale).toBe(true)
    expect(snapshot.latestEventAgeMs).toBe(180_000)
  })

  it('handles empty payloads safely', () => {
    const snapshot = buildFlowTelemetrySnapshot({
      flowEvents: [buildEvent({ timestamp: 'invalid-timestamp' })],
      flowAggregation: null,
      nowMs: Date.parse('2026-02-24T15:00:00.000Z'),
    })

    expect(snapshot.events1m).toBe(0)
    expect(snapshot.events5m).toBe(0)
    expect(snapshot.isStale).toBe(true)
    expect(snapshot.latestEventAt).toBeNull()
  })
})
