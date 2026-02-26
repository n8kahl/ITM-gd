'use client'

import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { formatSPXFeedFallbackReasonCode } from '@/lib/spx/feed-health'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'
import { BrokerHeaderChip } from './broker-header-chip'
import { FeedHealthIndicator } from './feed-health-indicator'

interface SPXHeaderProps {
  onOpenCommandPalette: () => void
  onOpenSettings: () => void
  onToggleLevelOverlay?: () => void
  showLevelOverlay?: boolean
  showAllLevels: boolean
  displayedLevelsCount: number
  totalLevelsCount: number
}

function healthTone(health: string | null | undefined): string {
  if (health === 'degraded') return 'border-rose-300/45 bg-rose-500/14 text-rose-100'
  if (health === 'stale') return 'border-amber-300/45 bg-amber-500/14 text-amber-100'
  return 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
}

function healthLabel(health: string | null | undefined): string {
  if (health === 'degraded') return 'Degraded'
  if (health === 'stale') return 'Stale'
  return 'Healthy'
}

function feedLabel(
  stage: 'live_stream' | 'poll_fallback' | 'snapshot_fallback' | 'last_known_good',
  source: string | null | undefined,
): string {
  if (stage === 'poll_fallback') return 'Poll Fallback'
  if (stage === 'snapshot_fallback') return 'Snapshot Fallback'
  if (stage === 'last_known_good') return 'Last Known Good'
  if (source === 'tick') return 'Live Tick'
  return 'Pending'
}

function feedTone(stage: 'live_stream' | 'poll_fallback' | 'snapshot_fallback' | 'last_known_good'): string {
  if (stage === 'poll_fallback' || stage === 'snapshot_fallback') return 'text-amber-300'
  if (stage === 'last_known_good') return 'text-rose-200'
  return 'text-emerald-300'
}

function formatFeedAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return '--'
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m`
}

function streamConnectionLabel(status: 'connected' | 'reconnecting' | 'degraded' | 'disconnected'): string {
  if (status === 'connected') return 'Connected'
  if (status === 'degraded') return 'Degraded'
  if (status === 'reconnecting') return 'Reconnecting'
  return 'Disconnected'
}

export function SPXHeader({
  onOpenCommandPalette,
  onOpenSettings,
  onToggleLevelOverlay,
  showLevelOverlay = true,
  showAllLevels,
  displayedLevelsCount,
  totalLevelsCount,
}: SPXHeaderProps) {
  const { regime, basis, dataHealth, feedFallbackReasonCode, feedFallbackStage } = useSPXAnalyticsContext()
  const {
    spxPrice,
    spxPriceSource,
    spxPriceAgeMs,
    priceStreamConnected,
    priceStreamConnectionStatus,
    priceStreamError,
  } = useSPXPriceContext()
  const fallbackReasonLabel = formatSPXFeedFallbackReasonCode(feedFallbackReasonCode)
  const streamStatusLabel = streamConnectionLabel(priceStreamConnectionStatus)
  const streamErrorLabel = priceStreamError && priceStreamError.trim().length > 0
    ? priceStreamError
    : null

  return (
    <header
      className="pointer-events-auto absolute inset-x-0 top-0 z-40 flex items-center justify-between px-3 py-2 md:px-5 md:py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
      data-testid="spx-header-overlay"
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="hidden font-serif text-sm font-bold tracking-wider text-white md:inline">
            SPX Command Center
          </span>
          <span className="font-serif text-xs font-bold tracking-wider text-white md:hidden">
            SPX
          </span>
        </div>
        <div className="hidden h-4 w-px bg-white/10 md:block" />
        <span className="font-mono text-sm font-bold text-white md:text-lg">
          {spxPrice > 0 ? `${spxPrice.toFixed(2)}` : '--'}
        </span>
        <FeedHealthIndicator />
        <span
          data-testid="spx-header-regime-chip"
          className={cn(
          'rounded-md border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-[0.1em] md:px-2.5 md:text-[9px]',
          regime === 'trending'
            ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
            : regime === 'compression'
              ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
              : 'border-white/18 bg-white/[0.04] text-white/70',
          )}
        >
          {regime || 'Loading'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2.5" aria-live="polite">
        {/* Basis, Health, Feed chips — hidden on mobile */}
        <div className="hidden rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right md:block">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Basis</div>
          <div className="font-mono text-[11px] text-white/78">
            {basis ? `${basis.current >= 0 ? '+' : ''}${basis.current.toFixed(2)}` : '--'}
          </div>
        </div>
        <div
          data-testid="spx-header-health-chip"
          className={cn(
            'hidden rounded border px-2 py-1 text-right md:block',
            healthTone(dataHealth),
          )}
        >
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/55">Health</div>
          <div className="font-mono text-[11px] uppercase">{healthLabel(dataHealth)}</div>
          {fallbackReasonLabel && (
            <div data-testid="spx-header-health-reason" className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/75">
              {fallbackReasonLabel}
            </div>
          )}
        </div>
        <div data-testid="spx-header-feed-chip" className="hidden rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right md:block">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Feed</div>
          <div className={cn(
            'font-mono text-[11px]',
            feedTone(feedFallbackStage),
          )}>
            {feedLabel(feedFallbackStage, spxPriceSource)}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-white/65">
            {streamStatusLabel}
            {!priceStreamConnected ? ' · Offline' : ''}
          </div>
          <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-white/50">
            Age {formatFeedAge(spxPriceAgeMs)}
          </div>
          {streamErrorLabel && (
            <div className="max-w-[18rem] truncate font-mono text-[8px] text-rose-200/80" title={streamErrorLabel}>
              {streamErrorLabel}
            </div>
          )}
        </div>
        <BrokerHeaderChip onClick={onOpenSettings} />
        <button
          type="button"
          onClick={onToggleLevelOverlay}
          data-testid="spx-header-levels-chip"
          className="hidden rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60 md:block"
        >
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Levels</div>
          <div className="font-mono text-[11px] text-white/78">
            {displayedLevelsCount}/{totalLevelsCount} {showAllLevels ? 'All' : 'Key'} · {showLevelOverlay ? 'On' : 'Off'}
          </div>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          data-testid="spx-settings-trigger"
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-500/[0.08] px-2 py-1.5 text-[9px] font-mono uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/[0.15] hover:text-emerald-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60 md:min-h-[36px] md:px-2.5"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Settings</span>
        </button>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-testid="spx-command-palette-trigger"
          className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60 md:min-h-[36px] md:px-2.5"
        >
          <span className="hidden rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[8px] md:inline">⌘K</span>
          <span className="hidden md:inline">Commands</span>
          <span className="md:hidden">⌘</span>
        </button>
      </div>
    </header>
  )
}
