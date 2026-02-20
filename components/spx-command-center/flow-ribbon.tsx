'use client'

import { useMemo } from 'react'
import { useSPXFlowContext } from '@/contexts/spx/SPXFlowContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'

function formatPremium(premium: number): string {
  const abs = Math.abs(premium)
  if (abs >= 1_000_000_000) return `$${(premium / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(premium / 1_000).toFixed(0)}K`
  return `$${premium.toFixed(0)}`
}

export function FlowRibbon({ className }: { className?: string }) {
  const { flowEvents } = useSPXFlowContext()
  const { selectedSetup, inTradeSetup } = useSPXSetupContext()
  const scopedSetup = inTradeSetup || selectedSetup

  const ranked = useMemo(() => {
    return [...flowEvents]
      .sort((left, right) => right.premium - left.premium)
      .slice(0, 8)
  }, [flowEvents])

  const bullishPremium = ranked
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearishPremium = ranked
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)
  const gross = bullishPremium + bearishPremium
  const bullishShare = gross > 0 ? (bullishPremium / gross) * 100 : 50

  const alignment = useMemo(() => {
    if (!scopedSetup || gross <= 0) return null
    const directionalPremium = scopedSetup.direction === 'bullish' ? bullishPremium : bearishPremium
    const alignmentPct = Math.round((directionalPremium / gross) * 100)
    if (alignmentPct >= 55) return { label: `FLOW CONFIRMS ${alignmentPct}%`, tone: 'confirm' as const }
    if (alignmentPct < 40) return { label: `FLOW DIVERGES ${100 - alignmentPct}%`, tone: 'diverge' as const }
    return { label: `FLOW MIXED ${alignmentPct}%`, tone: 'mixed' as const }
  }, [bearishPremium, bullishPremium, gross, scopedSetup])

  if (ranked.length === 0) {
    return (
      <div
        className={cn(
          'pointer-events-none rounded-lg border border-white/10 bg-[#0A0A0B]/75 px-2.5 py-1.5 backdrop-blur',
          className,
        )}
        data-testid="spx-flow-ribbon"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/45">Flow warming up...</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-none rounded-lg border border-white/12 bg-[#0A0A0B]/78 px-2.5 py-2 backdrop-blur',
        className,
      )}
      data-testid="spx-flow-ribbon"
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/55">Flow</span>
        <div className="h-1.5 min-w-[92px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-300"
            style={{ width: `${Math.max(6, Math.min(94, bullishShare))}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-emerald-200">{formatPremium(bullishPremium)}</span>
        <span className="text-[9px] font-mono text-white/30">|</span>
        <span className="text-[9px] font-mono text-rose-200">{formatPremium(bearishPremium)}</span>
      </div>
      {alignment && (
        <p
          className={cn(
            'mt-1 text-[8px] font-mono uppercase tracking-[0.08em]',
            alignment.tone === 'confirm'
              ? 'text-emerald-200/85'
              : alignment.tone === 'diverge'
                ? 'text-rose-200/85'
                : 'text-amber-200/85',
          )}
        >
          {alignment.label}
        </p>
      )}
    </div>
  )
}
