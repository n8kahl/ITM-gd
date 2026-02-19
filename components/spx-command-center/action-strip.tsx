'use client'

import { Gauge } from 'lucide-react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'

export function ActionStrip() {
  const { regime, prediction } = useSPXAnalyticsContext()
  const { selectedSetup, tradeMode, inTradeSetup, tradePnlPoints } = useSPXSetupContext()

  const postureDir = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish'
    : 'neutral'
  const postureConf = prediction?.confidence ?? null
  const postureLabel = `${(regime || '--').toUpperCase()} ${postureDir.toUpperCase()}${postureConf != null ? ` ${postureConf.toFixed(0)}%` : ''}`
  const bullish = prediction?.direction.bullish ?? 0
  const bearish = prediction?.direction.bearish ?? 0
  const neutral = prediction?.direction.neutral ?? 0

  return (
    <section
      className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.03] via-emerald-500/[0.02] to-champagne/[0.04] px-3 py-2.5 md:px-3.5"
      data-testid="spx-action-strip"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {tradeMode === 'in_trade' && inTradeSetup && (
          <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-champagne/35 bg-champagne/12 px-2 py-0.5 text-[10px] text-champagne">
            In Trade: {inTradeSetup.direction.toUpperCase()}
            {tradePnlPoints != null ? ` · ${tradePnlPoints >= 0 ? '+' : ''}${tradePnlPoints.toFixed(2)} pts` : ''}
          </span>
        )}

        <span className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] text-white/70" title="AI-predicted market posture combining regime, direction, and confidence">
          <Gauge className="h-3 w-3 text-champagne" />
          Posture: {postureLabel}
        </span>

        {prediction ? (
          <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-2 py-1">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2 py-0.5 text-[10px] text-emerald-100">
              Bull {bullish.toFixed(0)}%
            </span>
            <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100">
              Bear {bearish.toFixed(0)}%
            </span>
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/75">
              Flat {neutral.toFixed(0)}%
            </span>
          </div>
        ) : (
          <span className="inline-flex min-h-[28px] items-center rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">
            Direction warming up
          </span>
        )}

        {selectedSetup && tradeMode !== 'in_trade' && (
          <span className={cn(
            'inline-flex min-h-[28px] items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em]',
            selectedSetup.status === 'triggered'
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
              : selectedSetup.status === 'ready'
                ? 'border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100'
                : 'border-amber-300/25 bg-amber-500/[0.08] text-amber-100',
          )}>
            Selected {selectedSetup.direction} {selectedSetup.regime} ({selectedSetup.status})
          </span>
        )}
      </div>
    </section>
  )
}
