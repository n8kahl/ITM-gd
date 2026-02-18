'use client'

import { AlertTriangle, Dot, Gauge, Target } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { cn } from '@/lib/utils'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'

function formatPremium(premium: number): string {
  const abs = Math.abs(premium)
  if (abs >= 1_000_000_000) return `$${(premium / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(premium / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(premium / 1_000).toFixed(0)}K`
  return `$${premium.toFixed(0)}`
}

function formatPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function MobileBriefPanel() {
  const { activeSetups, prediction, flowEvents, coachMessages, spxPrice, regime, selectedSetup } = useSPXCommandCenter()

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

  const bullishPremium = flowEvents
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearishPremium = flowEvents
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)
  const grossPremium = bullishPremium + bearishPremium
  const flowBullishPct = grossPremium > 0 ? Math.round((bullishPremium / grossPremium) * 100) : 50

  const setupAlignment = topSetup
    ? topSetup.direction === 'bullish'
      ? flowBullishPct
      : 100 - flowBullishPct
    : null

  return (
    <section className="space-y-2.5">
      <div className="rounded-lg border border-champagne/25 bg-champagne/10 px-3 py-2 text-[11px] text-champagne/90">
        Brief mode surfaces act-now context. Use desktop for execution and interactive controls.
      </div>

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
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-white/60">Flow Conviction</h3>
            <span className="text-[10px] font-mono text-white/65">
              {formatPremium(bullishPremium)} / {formatPremium(bearishPremium)}
            </span>
          </div>
          {setupAlignment != null ? (
            <p
              className={cn(
                'mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
                setupAlignment >= 60
                  ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                  : setupAlignment < 40
                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-200',
              )}
            >
              {setupAlignment >= 60 ? 'Flow confirms' : setupAlignment < 40 ? 'Flow diverges' : 'Flow mixed'} {setupAlignment}%
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-white/50">Selectable flow conviction unavailable.</p>
          )}
        </div>

        <div className="glass-card-heavy rounded-xl border border-white/10 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-[0.12em] text-white/60">Direction</h3>
            <Gauge className="h-3.5 w-3.5 text-champagne/75" />
          </div>
          {prediction ? (
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
              <span className="rounded border border-emerald-400/20 bg-emerald-500/12 px-1.5 py-1 text-center text-emerald-200">
                ↑ {prediction.direction.bullish.toFixed(0)}%
              </span>
              <span className="rounded border border-rose-400/20 bg-rose-500/10 px-1.5 py-1 text-center text-rose-200">
                ↓ {prediction.direction.bearish.toFixed(0)}%
              </span>
              <span className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-1 text-center text-white/65">
                ↔ {prediction.direction.neutral.toFixed(0)}%
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-white/50">Prediction warming up.</p>
          )}
        </div>

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
        Open Setups, Chart, or Coach tabs for full detail.
      </div>
    </section>
  )
}
