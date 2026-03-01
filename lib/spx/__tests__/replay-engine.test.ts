import { describe, expect, it } from 'vitest'

import { createSPXReplayEngine, getSPXReplayIntervalMs, checksumSPXReplayJournal } from '@/lib/spx/replay-engine'
import type { ChartBar } from '@/lib/api/ai-coach'
import type { ReplayAnalyticalSnapshot } from '@/lib/trade-day-replay/types'
import type { SPXLevel } from '@/lib/types/spx-command-center'

function buildBars(count = 24): ChartBar[] {
  const start = 1_700_000_000
  let lastClose = 6000
  return Array.from({ length: count }).map((_, index) => {
    const open = lastClose
    const close = open + (index % 2 === 0 ? 0.8 : -0.5)
    const high = Math.max(open, close) + 0.6
    const low = Math.min(open, close) - 0.6
    lastClose = close
    return {
      time: start + (index * 300),
      open,
      high,
      low,
      close,
      volume: 1_000 + index * 10,
    }
  })
}

function buildLevel(id: string, price: number): SPXLevel {
  return {
    id,
    symbol: 'SPX',
    category: 'structural',
    source: id,
    price,
    strength: 'strong',
    timeframe: '1m',
    metadata: {},
    chartStyle: {
      color: '#22c55e',
      lineStyle: 'solid',
      lineWidth: 2,
      labelFormat: 'price',
    },
  }
}

function buildSnapshot(overrides: Partial<ReplayAnalyticalSnapshot> = {}): ReplayAnalyticalSnapshot {
  return {
    capturedAt: '2026-03-01T14:30:00.000Z',
    gexNetGamma: null,
    gexCallWall: null,
    gexPutWall: null,
    gexFlipPoint: null,
    gexKeyLevels: null,
    gexExpiryBreakdown: null,
    flowBias5m: null,
    flowBias15m: null,
    flowBias30m: null,
    flowEventCount: 0,
    flowSweepCount: 0,
    flowBullishPremium: 0,
    flowBearishPremium: 0,
    flowEvents: null,
    regime: null,
    regimeDirection: null,
    regimeProbability: null,
    regimeConfidence: null,
    mtf1hTrend: null,
    mtf15mTrend: null,
    mtf5mTrend: null,
    mtf1mTrend: null,
    mtfComposite: null,
    mtfAligned: null,
    vixValue: null,
    vixRegime: null,
    envGatePassed: null,
    envGateReasons: [],
    macroNextEvent: null,
    sessionMinuteEt: null,
    levels: null,
    clusterZones: null,
    basisValue: null,
    spxPrice: null,
    spyPrice: null,
    rrRatio: null,
    evR: null,
    memoryEdge: null,
    ...overrides,
  }
}

describe('replay engine', () => {
  it('produces deterministic checksum for the same journal', () => {
    const bars = buildBars(36)
    const checksumA = checksumSPXReplayJournal(bars)
    const checksumB = checksumSPXReplayJournal([...bars])
    expect(checksumA).toBe(checksumB)
  })

  it('builds bounded replay windows and stable frames', () => {
    const engine = createSPXReplayEngine(buildBars(36), { windowMinutes: 60 })
    const initialFrame = engine.getFrame(engine.firstCursorIndex)
    expect(initialFrame.visibleBars.length).toBe(engine.windowBars)
    expect(initialFrame.currentBar?.time).toBe(initialFrame.visibleBars[initialFrame.visibleBars.length - 1]?.time)

    const advancedCursor = engine.nextCursorIndex(initialFrame.cursorIndex)
    const advancedFrame = engine.getFrame(advancedCursor)
    expect(advancedFrame.cursorIndex).toBeGreaterThan(initialFrame.cursorIndex)
    expect(advancedFrame.visibleBars.length).toBe(engine.windowBars)
    expect(advancedFrame.progress).toBeGreaterThan(initialFrame.progress)
  })

  it('caps completion at the final cursor', () => {
    const engine = createSPXReplayEngine(buildBars(8), { windowMinutes: 30 })
    let cursor = engine.firstCursorIndex
    for (let index = 0; index < 40; index += 1) {
      cursor = engine.nextCursorIndex(cursor)
    }
    expect(cursor).toBe(engine.lastCursorIndex)
    expect(engine.isComplete(cursor)).toBe(true)
  })

  it('computes playback intervals from speed multipliers', () => {
    expect(getSPXReplayIntervalMs(1)).toBeGreaterThan(getSPXReplayIntervalMs(2))
    expect(getSPXReplayIntervalMs(2)).toBeGreaterThan(getSPXReplayIntervalMs(4))
  })

  it('resolves snapshot context from cursor time using the latest snapshot at-or-before cursor', () => {
    const bars = buildBars(12)
    const firstReplayLevel = buildLevel('snapshot-first', 6001.5)
    const secondReplayLevel = buildLevel('snapshot-second', 6010.25)
    const firstSnapshotTime = new Date(bars[6]!.time * 1000).toISOString()
    const secondSnapshotTime = new Date(bars[8]!.time * 1000).toISOString()

    const legacySnapshot = {
      ...buildSnapshot({
        capturedAt: '',
        levels: [firstReplayLevel],
      }),
      captured_at: firstSnapshotTime,
    } as ReplayAnalyticalSnapshot

    const engine = createSPXReplayEngine(bars, {
      windowMinutes: 30,
      snapshots: [
        buildSnapshot({
          capturedAt: 'not-a-valid-timestamp',
          levels: [buildLevel('ignored', 5999)],
        }),
        buildSnapshot({
          capturedAt: secondSnapshotTime,
          levels: [secondReplayLevel],
        }),
        legacySnapshot,
      ],
    })

    expect(engine.getFrame(engine.firstCursorIndex).snapshot).toBeNull()
    expect(engine.getFrame(6).snapshot?.levels?.[0]?.id).toBe('snapshot-first')
    expect(engine.getFrame(7).snapshot?.levels?.[0]?.id).toBe('snapshot-first')
    expect(engine.getFrame(8).snapshot?.levels?.[0]?.id).toBe('snapshot-second')
    expect(engine.getFrame(engine.lastCursorIndex).snapshot?.levels?.[0]?.id).toBe('snapshot-second')
  })
})
