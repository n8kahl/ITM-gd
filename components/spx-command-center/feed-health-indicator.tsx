'use client'

import { useMemo } from 'react'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { cn } from '@/lib/utils'

type FeedIndicatorState = 'connected' | 'degraded' | 'disconnected'

const TICK_STALE_MS = 5_000

function formatAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return '--'
  return `${Math.max(0, Math.floor(ageMs / 1000))}s`
}

function resolveFallbackState(input: {
  connectionStatus: 'connected' | 'reconnecting' | 'degraded' | 'disconnected'
  streamConnected: boolean
  source: 'tick' | 'poll' | 'snapshot' | null
  ageMs: number | null
}): FeedIndicatorState {
  if (input.connectionStatus === 'reconnecting' || input.connectionStatus === 'disconnected') {
    return 'disconnected'
  }
  if (input.connectionStatus === 'degraded') return 'degraded'
  if (!input.streamConnected) return 'disconnected'
  if (input.source !== 'tick') return 'degraded'
  if (input.ageMs != null && input.ageMs > TICK_STALE_MS) return 'degraded'
  return 'connected'
}

function resolveTone(state: FeedIndicatorState): { dotColor: string; textColor: string; label: string } {
  if (state === 'degraded') {
    return {
      dotColor: '#F59E0B',
      textColor: 'text-amber-200',
      label: 'Delayed',
    }
  }
  if (state === 'disconnected') {
    return {
      dotColor: '#EF4444',
      textColor: 'text-rose-200',
      label: 'Offline',
    }
  }
  return {
    dotColor: 'var(--emerald-elite)',
    textColor: 'text-emerald-200',
    label: 'Live',
  }
}

export function FeedHealthIndicator({
  className,
  showConnectedLabel = false,
}: {
  className?: string
  showConnectedLabel?: boolean
}) {
  const {
    spxPriceAgeMs,
    spxPriceSource,
    priceStreamConnected,
    priceStreamConnectionStatus,
    priceStreamFeedHealth,
  } = useSPXPriceContext()

  const derivedState = useMemo<FeedIndicatorState>(() => {
    if (priceStreamConnectionStatus === 'reconnecting' || priceStreamConnectionStatus === 'disconnected') {
      return 'disconnected'
    }

    if (priceStreamConnectionStatus === 'degraded') {
      return 'degraded'
    }

    if (priceStreamFeedHealth?.status) {
      if (priceStreamFeedHealth.status === 'disconnected') return 'disconnected'
      if (priceStreamFeedHealth.status === 'degraded') return 'degraded'

      const feedSource = priceStreamFeedHealth.source ?? spxPriceSource
      const feedAgeMs = priceStreamFeedHealth.staleMs ?? spxPriceAgeMs
      if (feedSource !== 'tick') return 'degraded'
      if (feedAgeMs != null && feedAgeMs > TICK_STALE_MS) return 'degraded'
      return 'connected'
    }

    return resolveFallbackState({
      connectionStatus: priceStreamConnectionStatus,
      streamConnected: priceStreamConnected,
      source: spxPriceSource,
      ageMs: spxPriceAgeMs,
    })
  }, [
    priceStreamConnected,
    priceStreamConnectionStatus,
    priceStreamFeedHealth,
    spxPriceAgeMs,
    spxPriceSource,
  ])

  const tone = resolveTone(derivedState)
  const showLabel = derivedState !== 'connected' || showConnectedLabel
  const statusText = showLabel ? tone.label : null
  const resolvedAgeMs = priceStreamFeedHealth?.staleMs ?? spxPriceAgeMs
  const resolvedSource = priceStreamFeedHealth?.source ?? spxPriceSource
  const hint = priceStreamFeedHealth?.message
    || (
      derivedState === 'connected'
        ? `Live tick feed active · ${formatAge(resolvedAgeMs)} old`
        : derivedState === 'degraded'
          ? `Feed delayed (${resolvedSource || 'unknown'} source) · ${formatAge(resolvedAgeMs)} old`
          : `WebSocket ${priceStreamConnectionStatus}`
    )

  return (
    <div
      data-testid="spx-feed-health-indicator"
      title={hint}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-1.5 py-0.5',
        className,
      )}
      aria-live="polite"
    >
      <span
        data-testid="spx-feed-health-dot"
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: tone.dotColor,
          boxShadow: `0 0 8px ${tone.dotColor}`,
        }}
      />
      {statusText && (
        <span className={cn('hidden font-mono text-[10px] uppercase tracking-[0.08em] sm:inline', tone.textColor)}>
          {statusText}
        </span>
      )}
    </div>
  )
}
