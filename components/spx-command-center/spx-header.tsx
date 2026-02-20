'use client'

import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { cn } from '@/lib/utils'

interface SPXHeaderProps {
  onOpenCommandPalette: () => void
  showAllLevels: boolean
  displayedLevelsCount: number
  totalLevelsCount: number
}

export function SPXHeader({
  onOpenCommandPalette,
  showAllLevels,
  displayedLevelsCount,
  totalLevelsCount,
}: SPXHeaderProps) {
  const { regime, basis, dataHealth } = useSPXAnalyticsContext()
  const { spxPrice, spxPriceSource } = useSPXPriceContext()

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
            SPX COMMAND CENTER
          </span>
        </div>
        <div className="h-4 w-px bg-white/10" />
        <span className="font-mono text-lg font-bold text-white">
          {spxPrice > 0 ? `SPX ${spxPrice.toFixed(2)}` : 'SPX --'}
        </span>
        <span className={cn(
          'rounded-md border px-2.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em]',
          regime === 'trending'
            ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
            : regime === 'compression'
              ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
              : 'border-white/18 bg-white/[0.04] text-white/70',
        )}>
          {regime || 'Loading'}
        </span>
        {dataHealth !== 'healthy' && (
          <span className={cn(
            'rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase',
            dataHealth === 'degraded'
              ? 'border-rose-300/40 bg-rose-500/12 text-rose-100'
              : 'border-amber-300/40 bg-amber-500/12 text-amber-100',
          )}>
            {dataHealth}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/40">Basis</div>
          <div className="font-mono text-[11px] text-white/70">
            {basis ? `${basis.current >= 0 ? '+' : ''}${basis.current.toFixed(2)}` : '--'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/40">Feed</div>
          <div className={cn(
            'font-mono text-[11px]',
            spxPriceSource === 'tick' ? 'text-emerald-400' : 'text-amber-400',
          )}>
            {spxPriceSource === 'tick' ? '● Live' : spxPriceSource === 'poll' ? '◐ Poll' : '○ Pending'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[8px] uppercase tracking-[0.1em] text-white/40">Levels</div>
          <div className="font-mono text-[11px] text-white/70">
            {displayedLevelsCount}/{totalLevelsCount} {showAllLevels ? 'All' : 'Focus'}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-[9px] font-mono uppercase tracking-[0.08em] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <span className="rounded border border-white/20 bg-black/30 px-1.5 py-0.5 text-[8px]">⌘K</span>
          Commands
        </button>
      </div>
    </header>
  )
}
