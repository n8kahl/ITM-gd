'use client'

import { AlertTriangle, Dot, Target } from 'lucide-react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'

function formatPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function MobileBriefPanel({ readOnly = true }: { readOnly?: boolean }) {
  const { prediction, regime } = useSPXAnalyticsContext()
  const { activeSetups, selectedSetup } = useSPXSetupContext()
  const { coachMessages } = useSPXCoachContext()
  const { spxPrice } = useSPXPriceContext()

  const setupPolicy = buildSetupDisplayPolicy({
    setups: activeSetups,
    regime,
    prediction,
    selectedSetup,
    primaryLimit: DEFAULT_PRIMARY_SETUP_LIMIT,
  })

  const topSetup =
    setupPolicy.actionablePrimary[0] ||
    setupPolicy.forming[0] ||
    null

  const topAlert =
    [...coachMessages]
      .sort((a, b) => {
        const priority = { alert: 0, setup: 1, guidance: 2, behavioral: 3 } as const
        return (priority[a.priority] ?? 3) - (priority[b.priority] ?? 3) || Date.parse(b.timestamp) - Date.parse(a.timestamp)
      })
      .find((message) => message.priority === 'alert' || message.priority === 'setup') || null

  return (
    <section className="space-y-2.5">
      {readOnly ? (
        <div className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[11px] text-white/75">
          Brief mode is active for compact monitoring.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90">
          Brief mode supports live trade focus and coach actions on mobile.
        </div>
      )}

      {topSetup ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-white/60">Top Setup</h3>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]',
                topSetup.status === 'triggered'
                  ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-200'
                  : topSetup.status === 'ready'
                    ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-300/35 bg-amber-500/12 text-amber-200',
              )}
            >
              {topSetup.status}
            </span>
          </div>

          <p className="mt-1 text-sm font-semibold uppercase text-ivory">
            {topSetup.direction} {topSetup.regime}
          </p>
          <p className="mt-1 text-[11px] text-white/60">
            Entry {topSetup.entryZone.low.toFixed(1)}-{topSetup.entryZone.high.toFixed(1)}
            <Dot className="inline h-3.5 w-3.5 align-text-bottom text-white/30" />
            Stop {topSetup.stop.toFixed(1)}
            <Dot className="inline h-3.5 w-3.5 align-text-bottom text-white/30" />
            T1 {topSetup.target1.price.toFixed(1)}
          </p>

          <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
              <p className="text-white/40">Win%</p>
              <p className="font-mono text-ivory">{topSetup.probability.toFixed(0)}%</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
              <p className="text-white/40">Confluence</p>
              <p className="font-mono text-emerald-200">{topSetup.confluenceScore}/5</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1 text-center">
              <p className="text-white/40">Vs Entry</p>
              <p className="font-mono text-ivory">
                {spxPrice > 0 ? formatPoints(spxPrice - ((topSetup.entryZone.low + topSetup.entryZone.high) / 2)) : '--'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-3 text-[11px] text-white/55">
          No active setup available yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        <div className="glass-card-heavy rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-white/60">Coach Alert</h3>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-200/80" />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/75">
            {topAlert?.content || 'No alert currently. Continue monitoring setup posture and flow.'}
          </p>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-white/40">
        <Target className="h-3 w-3 text-emerald-300/80" />
        Open setups, chart, and coach for full detail.
      </div>
    </section>
  )
}
