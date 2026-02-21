import { describe, expect, it } from 'vitest'

import { createSPXReplayEngine, getSPXReplayIntervalMs, checksumSPXReplayJournal } from '@/lib/spx/replay-engine'
import type { ChartBar } from '@/lib/api/ai-coach'

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
})
