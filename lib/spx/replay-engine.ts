import type { ChartBar } from '@/lib/api/ai-coach'
import type {
  ReplayAnalyticalSnapshot,
  ReplayDiscordMessage,
  ReplayDiscordTrade,
} from '@/lib/trade-day-replay/types'

export type SPXReplayWindowMinutes = 30 | 60 | 120
export type SPXReplaySpeed = 1 | 2 | 4

export interface SPXReplayFrame {
  cursorIndex: number
  progress: number
  currentBar: ChartBar | null
  visibleBars: ChartBar[]
  snapshot: ReplayAnalyticalSnapshot | null
  visibleDiscordMessages: ReplayDiscordMessage[] | null
  activeDiscordTrade: ReplayDiscordTrade | null
}

export interface SPXReplayEngine {
  bars: ChartBar[]
  checksum: string
  windowBars: number
  firstCursorIndex: number
  lastCursorIndex: number
  getFrame: (cursorIndex: number) => SPXReplayFrame
  nextCursorIndex: (cursorIndex: number) => number
  isComplete: (cursorIndex: number) => boolean
}

const BASE_REPLAY_INTERVAL_MS = 900

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function parseEpochSeconds(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed / 1000)
}

function resolveSnapshotCapturedAt(snapshot: ReplayAnalyticalSnapshot): string | null {
  if (typeof snapshot.capturedAt === 'string' && snapshot.capturedAt.trim().length > 0) {
    return snapshot.capturedAt
  }
  const legacyCapturedAt = (snapshot as ReplayAnalyticalSnapshot & { captured_at?: unknown }).captured_at
  if (typeof legacyCapturedAt === 'string' && legacyCapturedAt.trim().length > 0) {
    return legacyCapturedAt
  }
  return null
}

type ReplaySnapshotWithTime = {
  snapshot: ReplayAnalyticalSnapshot
  capturedAtSec: number
  order: number
}

function normalizeReplaySnapshots(snapshots: ReplayAnalyticalSnapshot[] | undefined): ReplaySnapshotWithTime[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return []
  return snapshots
    .map((snapshot, order) => {
      const capturedAtSec = parseEpochSeconds(resolveSnapshotCapturedAt(snapshot))
      if (capturedAtSec == null) return null
      return { snapshot, capturedAtSec, order }
    })
    .filter((row): row is ReplaySnapshotWithTime => row != null)
    .sort((left, right) => {
      if (left.capturedAtSec !== right.capturedAtSec) return left.capturedAtSec - right.capturedAtSec
      return left.order - right.order
    })
}

function sanitizeBars(bars: ChartBar[]): ChartBar[] {
  return bars
    .map((bar) => ({
      time: toFiniteNumber(bar.time) ?? NaN,
      open: toFiniteNumber(bar.open) ?? NaN,
      high: toFiniteNumber(bar.high) ?? NaN,
      low: toFiniteNumber(bar.low) ?? NaN,
      close: toFiniteNumber(bar.close) ?? NaN,
      volume: toFiniteNumber(bar.volume) ?? 0,
    }))
    .filter((bar) => (
      Number.isFinite(bar.time)
      && Number.isFinite(bar.open)
      && Number.isFinite(bar.high)
      && Number.isFinite(bar.low)
      && Number.isFinite(bar.close)
    ))
    .sort((a, b) => a.time - b.time)
    .reduce<ChartBar[]>((acc, bar) => {
      const previous = acc[acc.length - 1]
      if (previous?.time === bar.time) {
        acc[acc.length - 1] = bar
      } else {
        acc.push(bar)
      }
      return acc
    }, [])
}

function resolveMedianIntervalSeconds(bars: ChartBar[]): number {
  if (bars.length < 2) return 60
  const intervals = []
  for (let index = 1; index < bars.length; index += 1) {
    const delta = bars[index]!.time - bars[index - 1]!.time
    if (Number.isFinite(delta) && delta > 0) {
      intervals.push(delta)
    }
  }
  if (intervals.length === 0) return 60
  const sorted = [...intervals].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.max(Math.round((sorted[midpoint - 1]! + sorted[midpoint]!) / 2), 1)
  }
  return Math.max(Math.round(sorted[midpoint]!), 1)
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function checksumSPXReplayJournal(bars: ChartBar[]): string {
  const normalized = sanitizeBars(bars)
  const signature = normalized
    .map((bar) => (
      `${bar.time}|${bar.open.toFixed(2)}|${bar.high.toFixed(2)}|${bar.low.toFixed(2)}|${bar.close.toFixed(2)}|${Math.round(bar.volume)}`
    ))
    .join(';')
  return fnv1aHash(signature)
}

function resolveReplayWindowBars(bars: ChartBar[], windowMinutes: SPXReplayWindowMinutes): number {
  if (bars.length <= 1) return bars.length
  const intervalSeconds = resolveMedianIntervalSeconds(bars)
  const requestedWindowSeconds = windowMinutes * 60
  const barsInWindow = Math.ceil(requestedWindowSeconds / Math.max(intervalSeconds, 1))
  return Math.min(Math.max(barsInWindow, 2), bars.length)
}

export function getSPXReplayIntervalMs(speed: SPXReplaySpeed): number {
  return Math.max(Math.round(BASE_REPLAY_INTERVAL_MS / speed), 120)
}

export function createSPXReplayEngine(
  bars: ChartBar[],
  options?: {
    windowMinutes?: SPXReplayWindowMinutes
    snapshots?: ReplayAnalyticalSnapshot[]
  },
): SPXReplayEngine {
  const normalizedBars = sanitizeBars(bars)
  const windowMinutes = options?.windowMinutes ?? 60
  const windowBars = resolveReplayWindowBars(normalizedBars, windowMinutes)
  const firstCursorIndex = Math.max(windowBars - 1, 0)
  const lastCursorIndex = Math.max(normalizedBars.length - 1, 0)
  const checksum = checksumSPXReplayJournal(normalizedBars)
  const replaySnapshots = normalizeReplaySnapshots(options?.snapshots)

  const resolveSnapshotForCursorTime = (cursorBarTimeSec: number): ReplayAnalyticalSnapshot | null => {
    if (replaySnapshots.length === 0) return null
    let left = 0
    let right = replaySnapshots.length - 1
    let matchIndex = -1

    while (left <= right) {
      const midpoint = Math.floor((left + right) / 2)
      const candidate = replaySnapshots[midpoint]
      if (!candidate) break
      if (candidate.capturedAtSec <= cursorBarTimeSec) {
        matchIndex = midpoint
        left = midpoint + 1
      } else {
        right = midpoint - 1
      }
    }

    return matchIndex >= 0 ? replaySnapshots[matchIndex]?.snapshot ?? null : null
  }

  const getFrame = (cursorIndex: number): SPXReplayFrame => {
    if (normalizedBars.length === 0) {
      return {
        cursorIndex: 0,
        progress: 0,
        currentBar: null,
        visibleBars: [],
        snapshot: null,
        visibleDiscordMessages: null,
        activeDiscordTrade: null,
      }
    }
    const clampedCursor = Math.min(Math.max(cursorIndex, firstCursorIndex), lastCursorIndex)
    const startIndex = Math.max(0, clampedCursor - windowBars + 1)
    const visibleBars = normalizedBars.slice(startIndex, clampedCursor + 1)
    const currentBar = normalizedBars[clampedCursor] ?? null
    const progress = normalizedBars.length <= 1
      ? 1
      : Number((clampedCursor / (normalizedBars.length - 1)).toFixed(4))
    return {
      cursorIndex: clampedCursor,
      progress,
      currentBar,
      visibleBars,
      snapshot: currentBar ? resolveSnapshotForCursorTime(currentBar.time) : null,
      visibleDiscordMessages: null,
      activeDiscordTrade: null,
    }
  }

  return {
    bars: normalizedBars,
    checksum,
    windowBars,
    firstCursorIndex,
    lastCursorIndex,
    getFrame,
    nextCursorIndex: (cursorIndex: number) => {
      if (normalizedBars.length === 0) return 0
      const frame = getFrame(cursorIndex)
      return Math.min(frame.cursorIndex + 1, lastCursorIndex)
    },
    isComplete: (cursorIndex: number) => {
      if (normalizedBars.length === 0) return true
      return getFrame(cursorIndex).cursorIndex >= lastCursorIndex
    },
  }
}
