'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

export type ReplayTranscriptMessage = {
  id: string | null
  authorName: string | null
  authorId: string | null
  content: string | null
  sentAt: string | null
  isSignal: boolean | null
  signalType: string | null
  parsedTradeId: string | null
}

type ReplayTranscriptSignalKind = 'prep' | 'fill' | 'trim' | 'stop' | 'exit' | 'commentary'

type ReplayTranscriptJumpRequest = {
  requestId: number
  timeIso: string | null
} | null

type ReplayTranscriptSidebarProps = {
  sessionId: string | null
  messages: ReplayTranscriptMessage[]
  cursorTimeIso?: string | null
  jumpRequest?: ReplayTranscriptJumpRequest
}

type ResolvedTranscriptMessage = ReplayTranscriptMessage & {
  stableKey: string
  epochMs: number | null
  signalKind: ReplayTranscriptSignalKind
  isThesis: boolean
}

const CURSOR_SYNC_SCROLL_BEHAVIOR: ScrollBehavior = 'smooth'

function toEpochMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDisplayTimestamp(value: string | null): string {
  if (!value) return 'n/a'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeSignalType(value: string | null): string {
  if (!value) return ''
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function resolveSignalKind(message: ReplayTranscriptMessage): ReplayTranscriptSignalKind {
  const normalized = normalizeSignalType(message.signalType)
  if (!message.isSignal || normalized.length === 0) return 'commentary'
  if (normalized.startsWith('prep')) return 'prep'
  if (
    normalized.includes('fill')
    || normalized === 'ptf'
    || normalized === 'pft'
    || normalized === 'filled_avg'
  ) {
    return 'fill'
  }
  if (normalized.includes('trim')) return 'trim'
  if (
    normalized.includes('stop')
    || normalized.includes('trail')
    || normalized.includes('breakeven')
    || normalized === 'stops'
    || normalized === 'b/e'
  ) {
    return 'stop'
  }
  if (
    normalized.includes('exit')
    || normalized.includes('fully_out')
    || normalized.includes('fully_sold')
  ) {
    return 'exit'
  }
  return 'commentary'
}

function isThesisMessage(message: ReplayTranscriptMessage): boolean {
  const normalizedSignalType = normalizeSignalType(message.signalType)
  if (normalizedSignalType.includes('thesis')) return true

  const content = String(message.content || '').trim()
  if (!content) return false
  if (content.length < 20) return false

  return /\b(thesis|plan|reason|because|looking for|entry condition|if .* then)\b/i.test(content)
}

function resolveCursorMessageIndex(messages: ResolvedTranscriptMessage[], cursorTimeIso: string | null | undefined): number {
  if (messages.length === 0) return -1
  const cursorMs = toEpochMs(cursorTimeIso)
  if (cursorMs == null) return -1

  let latestAtOrBefore = -1
  for (let index = 0; index < messages.length; index += 1) {
    const messageMs = messages[index]?.epochMs
    if (messageMs == null) continue
    if (messageMs <= cursorMs) {
      latestAtOrBefore = index
      continue
    }
    break
  }

  if (latestAtOrBefore >= 0) return latestAtOrBefore
  return 0
}

function resolveNearestMessageIndex(messages: ResolvedTranscriptMessage[], targetTimeIso: string | null): number {
  if (messages.length === 0) return -1
  const targetMs = toEpochMs(targetTimeIso)
  if (targetMs == null) return -1

  let nearestIndex = -1
  let nearestDelta = Number.POSITIVE_INFINITY
  for (let index = 0; index < messages.length; index += 1) {
    const messageMs = messages[index]?.epochMs
    if (messageMs == null) continue
    const delta = Math.abs(messageMs - targetMs)
    if (delta < nearestDelta) {
      nearestDelta = delta
      nearestIndex = index
    }
  }

  if (nearestIndex >= 0) return nearestIndex
  return 0
}

function signalToneClassName(signalKind: ReplayTranscriptSignalKind, isThesis: boolean): string {
  if (isThesis) return 'border-champagne/45 bg-champagne/12 text-champagne'
  if (signalKind === 'prep') return 'border-sky-300/35 bg-sky-500/12 text-sky-100'
  if (signalKind === 'fill') return 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
  if (signalKind === 'trim') return 'border-amber-300/35 bg-amber-500/12 text-amber-100'
  if (signalKind === 'stop') return 'border-rose-300/35 bg-rose-500/12 text-rose-100'
  if (signalKind === 'exit') return 'border-red-300/35 bg-red-500/12 text-red-100'
  return 'border-white/15 bg-white/[0.03] text-white/78'
}

export function ReplayTranscriptSidebar({
  sessionId,
  messages,
  cursorTimeIso,
  jumpRequest,
}: ReplayTranscriptSidebarProps) {
  const rowRefMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const resolvedMessages = useMemo<ResolvedTranscriptMessage[]>(() => {
    return messages
      .map((message, index) => {
        const content = typeof message.content === 'string' ? message.content : null
        return {
          ...message,
          content,
          stableKey: message.id || `${index}-${message.sentAt || 'n/a'}-${content || ''}`,
          epochMs: toEpochMs(message.sentAt),
          signalKind: resolveSignalKind(message),
          isThesis: isThesisMessage(message),
        }
      })
      .sort((left, right) => {
        if (left.epochMs != null && right.epochMs != null && left.epochMs !== right.epochMs) {
          return left.epochMs - right.epochMs
        }
        if (left.epochMs != null && right.epochMs == null) return -1
        if (left.epochMs == null && right.epochMs != null) return 1
        return left.stableKey.localeCompare(right.stableKey)
      })
  }, [messages])

  const cursorFocusedIndex = useMemo(
    () => resolveCursorMessageIndex(resolvedMessages, cursorTimeIso),
    [cursorTimeIso, resolvedMessages],
  )

  const jumpFocusedIndex = useMemo(() => {
    if (!jumpRequest) return null
    const nearestIndex = resolveNearestMessageIndex(resolvedMessages, jumpRequest.timeIso)
    return nearestIndex >= 0 ? nearestIndex : null
  }, [jumpRequest, resolvedMessages])

  const focusedIndex = jumpFocusedIndex ?? cursorFocusedIndex

  useEffect(() => {
    if (focusedIndex < 0) return
    const focused = resolvedMessages[focusedIndex]
    if (!focused) return
    const node = rowRefMap.current.get(focused.stableKey)
    if (!node || typeof node.scrollIntoView !== 'function') return
    node.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: CURSOR_SYNC_SCROLL_BEHAVIOR,
    })
  }, [focusedIndex, resolvedMessages])

  return (
    <section
      className="rounded border border-white/12 bg-black/15 px-2 py-2"
      data-testid="spx-replay-transcript-sidebar"
      data-session-id={sessionId || undefined}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Transcript</p>
        <span className="rounded border border-white/15 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-mono text-white/70">
          {resolvedMessages.length}
        </span>
      </div>

      {resolvedMessages.length === 0 ? (
        <p className="text-[10px] text-white/55" data-testid="spx-replay-transcript-empty">
          No transcript messages were captured for this session.
        </p>
      ) : (
        <div className="max-h-[290px] space-y-1.5 overflow-auto pr-0.5" data-testid="spx-replay-transcript-list">
          {resolvedMessages.map((message, index) => {
            const isFocused = index === focusedIndex
            const isCommentary = message.signalKind === 'commentary' && !message.isThesis
            return (
              <div
                key={message.stableKey}
                ref={(node) => {
                  if (!node) {
                    rowRefMap.current.delete(message.stableKey)
                    return
                  }
                  rowRefMap.current.set(message.stableKey, node)
                }}
                className={cn(
                  'rounded border px-2 py-1.5 transition-colors',
                  signalToneClassName(message.signalKind, message.isThesis),
                  isCommentary && 'opacity-65',
                  isFocused && 'ring-1 ring-champagne/45',
                )}
                aria-current={isFocused ? 'true' : undefined}
                data-focused={isFocused ? 'true' : 'false'}
                data-signal-kind={message.signalKind}
                data-testid={`spx-replay-transcript-row-${index}`}
              >
                {message.isThesis && (
                  <p className="mb-1 text-[9px] uppercase tracking-[0.08em] text-champagne/95" data-testid={`spx-replay-transcript-thesis-${index}`}>
                    Caller Thesis
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] text-white/88">{message.authorName || 'Unknown caller'}</p>
                  <p className="font-mono text-[9px] text-white/65">{toDisplayTimestamp(message.sentAt)}</p>
                </div>
                <p className="mt-0.5 text-[10px] leading-4 text-inherit">
                  {message.content || 'No message content'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
