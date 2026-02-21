'use client'

import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { formatSPXFeedFallbackReasonCode } from '@/lib/spx/feed-health'
import { cn } from '@/lib/utils'

interface SPXHeaderProps {
  onOpenCommandPalette: () => void
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

export function SPXHeader({
  onOpenCommandPalette,
  showAllLevels,
  displayedLevelsCount,
  totalLevelsCount,
}: SPXHeaderProps) {
  const { regime, basis, dataHealth, feedFallbackReasonCode, feedFallbackStage } = useSPXAnalyticsContext()
  const { spxPrice, spxPriceSource } = useSPXPriceContext()
  const fallbackReasonLabel = formatSPXFeedFallbackReasonCode(feedFallbackReasonCode)

  return (
    <header
      className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
      data-testid="spx-header-overlay"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="font-serif text-sm font-bold tracking-wider text-white">
            SPX Command Center
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <span className="font-mono text-lg font-bold text-white">
          {spxPrice > 0 ? `SPX ${spxPrice.toFixed(2)}` : 'SPX --'}
        </span>
        <span
          data-testid="spx-header-regime-chip"
          className={cn(
          'rounded-md border px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em]',
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

      <div className="flex items-center gap-2.5" aria-live="polite">
        <div className="rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Basis</div>
          <div className="font-mono text-[11px] text-white/78">
            {basis ? `${basis.current >= 0 ? '+' : ''}${basis.current.toFixed(2)}` : '--'}
          </div>
        </div>
        <div
          data-testid="spx-header-health-chip"
          className={cn(
            'rounded border px-2 py-1 text-right',
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
        <div data-testid="spx-header-feed-chip" className="rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Feed</div>
          <div className={cn(
            'font-mono text-[11px]',
            feedTone(feedFallbackStage),
          )}>
            {feedLabel(feedFallbackStage, spxPriceSource)}
          </div>
        </div>
        <div data-testid="spx-header-levels-chip" className="rounded border border-white/12 bg-white/[0.03] px-2 py-1 text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/45">Levels</div>
          <div className="font-mono text-[11px] text-white/78">
            {displayedLevelsCount}/{totalLevelsCount} {showAllLevels ? 'All' : 'Focus'}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-testid="spx-command-palette-trigger"
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/68 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60"
        >
          <span className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[8px]">⌘K</span>
          Commands
        </button>
      </div>
    </header>
  )
}
