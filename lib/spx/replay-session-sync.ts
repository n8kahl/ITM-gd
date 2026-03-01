import type { ChartBar } from '@/lib/api/ai-coach'

export const SPX_REPLAY_SESSION_SYNC_EVENT = 'spx:replay-session-sync'
export const SPX_REPLAY_CURSOR_TIME_EVENT = 'spx:replay-cursor-time'
export const SPX_REPLAY_TRANSCRIPT_JUMP_EVENT = 'spx:replay-transcript-jump'

export type ReplaySessionSyncMessage = {
  id: string | null
  discordMessageId?: string | null
  authorName: string | null
  authorId: string | null
  content: string | null
  sentAt: string | null
  isSignal: boolean | null
  signalType: string | null
  parsedTradeId: string | null
}

export type ReplaySessionSyncLifecycleEvent = {
  type: string | null
  value: number | null
  timestamp: string | null
  messageRef: string | null
}

export type ReplaySessionSyncTrade = {
  id: string | null
  tradeIndex: number
  entryTimestamp: string | null
  exitTimestamp: string | null
  thesisText: string | null
  thesisMessageRef: string | null
  lifecycleEvents: ReplaySessionSyncLifecycleEvent[]
}

export type ReplaySessionSyncPayload = {
  sessionId: string
  bars: ChartBar[]
  snapshots: Record<string, unknown>[]
  messages: ReplaySessionSyncMessage[]
  trades: ReplaySessionSyncTrade[]
}

export type ReplayCursorTimePayload = {
  sessionId: string
  cursorTimeIso: string | null
  cursorTimeSec: number | null
}

export type ReplayTranscriptJumpPayload = {
  sessionId: string
  jumpTimeIso: string | null
  source: 'chart_marker' | 'lifecycle_marker'
}

function publishCustomEvent<T>(name: string, detail: T): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<T>(name, { detail }))
}

export function publishReplaySessionSync(payload: ReplaySessionSyncPayload | null): void {
  publishCustomEvent(SPX_REPLAY_SESSION_SYNC_EVENT, payload)
}

export function publishReplayCursorTime(payload: ReplayCursorTimePayload | null): void {
  publishCustomEvent(SPX_REPLAY_CURSOR_TIME_EVENT, payload)
}

export function publishReplayTranscriptJump(payload: ReplayTranscriptJumpPayload | null): void {
  publishCustomEvent(SPX_REPLAY_TRANSCRIPT_JUMP_EVENT, payload)
}

type EventHandler<T> = (payload: T) => void

function subscribeEvent<T>(name: string, handler: EventHandler<T>): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const wrapped = (event: Event) => {
    const payload = (event as CustomEvent<T>).detail
    handler(payload)
  }
  window.addEventListener(name, wrapped as EventListener)
  return () => {
    window.removeEventListener(name, wrapped as EventListener)
  }
}

export function subscribeReplaySessionSync(
  handler: EventHandler<ReplaySessionSyncPayload | null>,
): () => void {
  return subscribeEvent<ReplaySessionSyncPayload | null>(SPX_REPLAY_SESSION_SYNC_EVENT, handler)
}

export function subscribeReplayCursorTime(
  handler: EventHandler<ReplayCursorTimePayload | null>,
): () => void {
  return subscribeEvent<ReplayCursorTimePayload | null>(SPX_REPLAY_CURSOR_TIME_EVENT, handler)
}

export function subscribeReplayTranscriptJump(
  handler: EventHandler<ReplayTranscriptJumpPayload | null>,
): () => void {
  return subscribeEvent<ReplayTranscriptJumpPayload | null>(SPX_REPLAY_TRANSCRIPT_JUMP_EVENT, handler)
}
