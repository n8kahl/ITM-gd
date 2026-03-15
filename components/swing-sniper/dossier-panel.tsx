'use client'

import { useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BookmarkMinus, BookmarkPlus, ChevronRight, ListPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  SwingSniperDossierPayload,
  SwingSniperMonitoringPayload,
} from '@/lib/swing-sniper/types'

const DOSSIER_TABS = ['Thesis', 'Vol Map', 'Catalysts', 'Structure', 'Risk'] as const

type DossierTab = (typeof DOSSIER_TABS)[number]

interface DossierPanelProps {
  dossier: SwingSniperDossierPayload | null
  selectedSymbol: string | null
  loading: boolean
  error: boolean
  activeTab: DossierTab
  monitoring: SwingSniperMonitoringPayload | null
  isSaved: boolean
  thesisPending: boolean
  watchlistPending: boolean
  onTabChange: (tab: DossierTab) => void
  onSaveThesis: () => void
  onRemoveThesis: () => void
  onAddToWatchlist: () => void
}

function chartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white/80 shadow-xl">
      <p className="font-medium text-white">{label}</p>
      {payload.map((entry: { value?: number | null; name?: string }) => (
        <p key={`${entry.name}-${label}`}>
          {entry.name}: {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : '--'}
        </p>
      ))}
    </div>
  )
}

function payoffTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white/80 shadow-xl">
      <p className="font-medium text-white">{label}</p>
      {payload.map((entry: { value?: number | null; name?: string }) => (
        <p key={`${entry.name}-${label}`}>
          {entry.name}: {typeof entry.value === 'number' ? `${entry.value >= 0 ? '+' : '-'}$${Math.abs(entry.value).toFixed(0)}` : '--'}
        </p>
      ))}
    </div>
  )
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-emerald-100 border-emerald-500/35 bg-emerald-500/12'
  if (score >= 60) return 'text-emerald-200/90 border-emerald-500/25 bg-emerald-500/8'
  return 'text-white/80 border-white/10 bg-white/[0.04]'
}

function buildDensityStrip(daysOutList: number[]): Array<{ day: number; count: number }> {
  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1
    const count = daysOutList.filter((days) => days === day).length
    return { day, count }
  })
}

function densityTone(count: number): string {
  if (count >= 3) return 'bg-emerald-500/90'
  if (count >= 2) return 'bg-champagne/80'
  if (count >= 1) return 'bg-emerald-500/55'
  return 'bg-white/[0.08]'
}

function holdingWindow(daysOut: number | undefined): string {
  if (daysOut == null) return '7-14 trading days'
  if (daysOut <= 3) return '3-7 trading days'
  if (daysOut <= 7) return '5-10 trading days'
  if (daysOut <= 14) return '7-14 trading days'
  return '14-30 trading days'
}

function entryPosture(
  view: SwingSniperDossierPayload['view'],
  ivRvSpread: number | null,
): string {
  if (view === 'Long vol') {
    return ivRvSpread != null && ivRvSpread <= 0
      ? 'Enter while IV trails realized'
      : 'Wait for a better premium reset'
  }

  if (view === 'Short vol') {
    return ivRvSpread != null && ivRvSpread >= 0
      ? 'Wait for event fade or failed extension'
      : 'Tactical only until premium rebuilds'
  }

  return 'Catalyst dependent'
}

function confidenceLabel(score: number): string {
  if (score >= 85) return 'High conviction'
  if (score >= 70) return 'Actionable'
  return 'Tactical'
}

function formatPercent(value: number | null): string {
  return value == null ? '--' : `${value.toFixed(1)}%`
}

function formatStrike(strike: number): string {
  return Number.isInteger(strike) ? strike.toFixed(0) : strike.toFixed(1)
}

function monitoringTone(status: string | null): string {
  if (status === 'active') return 'text-emerald-100'
  if (status === 'degrading') return 'text-amber-100'
  if (status === 'invalidated') return 'text-red-100'
  return 'text-white/80'
}

function legSideTone(side: 'buy' | 'sell'): string {
  return side === 'buy'
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
    : 'border-champagne/35 bg-champagne/10 text-champagne'
}

export function DossierPanel({
  dossier,
  selectedSymbol,
  loading,
  error,
  activeTab,
  monitoring,
  isSaved,
  thesisPending,
  watchlistPending,
  onTabChange,
  onSaveThesis,
  onRemoveThesis,
  onAddToWatchlist,
}: DossierPanelProps) {
  const symbolMonitoring = dossier
    ? monitoring?.savedTheses.find((item) => item.symbol === dossier.symbol) || null
    : null

  const ivRvSpread = dossier?.vol_map.iv_now != null && dossier?.vol_map.rv_20d != null
    ? dossier.vol_map.iv_now - dossier.vol_map.rv_20d
    : null

  const topStructure = dossier?.structures[0] ?? null
  const structureAlternatives = dossier?.structures.slice(1, 4) ?? []
  const narrativePreview = dossier?.thesis.narrative_shifts.slice(0, 2) ?? []
  const sortedCatalysts = dossier
    ? [...dossier.catalysts]
      .sort((left, right) => {
        const leftFuture = left.days_out >= 0 ? 0 : 1
        const rightFuture = right.days_out >= 0 ? 0 : 1
        if (leftFuture !== rightFuture) return leftFuture - rightFuture
        if (left.days_out !== right.days_out) return left.days_out - right.days_out
        const severityRank = { high: 0, medium: 1, low: 2 } as const
        return severityRank[left.severity] - severityRank[right.severity]
      })
    : []
  const highSignalCatalysts = sortedCatalysts.filter((event) => event.severity !== 'low')
  const leadCatalysts = (
    highSignalCatalysts.length >= 2
      ? highSignalCatalysts
      : sortedCatalysts
  ).slice(0, 3)
  const transitionSymbol = selectedSymbol ?? dossier?.symbol ?? 'Research'
  const [showDeepDive, setShowDeepDive] = useState(false)
  const deepDiveRef = useRef<HTMLDivElement | null>(null)

  const openDeepDiveTab = (tab: DossierTab) => {
    onTabChange(tab)
    setShowDeepDive(true)

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        deepDiveRef.current?.scrollIntoView?.({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }
  }

  return (
    <section className="glass-card-heavy rounded-[28px] border border-white/10 p-4" data-testid="swing-sniper-dossier">
      {loading ? (
        <div className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-champagne/35 bg-champagne/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-champagne">
                Refreshing execution plan
              </div>
              <div className="h-6 w-28 animate-pulse rounded-full bg-white/10" />
            </div>
            <h2 className="mt-4 font-[family-name:var(--font-playfair)] text-[clamp(2.75rem,6vw,4rem)] tracking-[-0.045em] text-white">
              {transitionSymbol}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Pulling the latest thesis, contracts, and risk context for the selected symbol.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[22px] border border-white/10 bg-white/[0.04]" />
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
            <div className="h-56 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
            <div className="h-56 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
          Refreshing research data…
        </div>
      ) : null}

      {!loading && !error && dossier ? (
        <>
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-3 py-1 font-mono text-xs', scoreTone(dossier.orc_score))}>
                    TITM {dossier.orc_score}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/75">
                    {dossier.view}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/75">
                    {dossier.catalyst_label}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
                    {confidenceLabel(dossier.orc_score)}
                  </span>
                </div>

                <h2 className="mt-4 font-[family-name:var(--font-playfair)] text-[clamp(2.75rem,6vw,4rem)] tracking-[-0.045em] text-white">
                  {dossier.symbol}
                </h2>
                <p className="mt-3 line-clamp-2 max-w-4xl text-base leading-8 text-white/82">{dossier.headline}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => openDeepDiveTab('Structure')}
                  className="rounded-full bg-white text-black hover:bg-white/90"
                >
                  Build trade
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={isSaved ? onRemoveThesis : onSaveThesis}
                  disabled={thesisPending}
                  className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                >
                  {isSaved ? (
                    <BookmarkMinus className="mr-2 h-4 w-4" />
                  ) : (
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                  )}
                  {thesisPending ? (isSaved ? 'Removing…' : 'Saving…') : isSaved ? 'Remove thesis' : 'Save thesis'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onAddToWatchlist}
                  disabled={watchlistPending}
                  className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  {watchlistPending ? 'Adding…' : 'Add to watchlist'}
                </Button>
              </div>
            </div>

            {symbolMonitoring ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]', {
                  'border-emerald-500/35 bg-emerald-500/10 text-emerald-100': symbolMonitoring.monitoring.status === 'active',
                  'border-champagne/35 bg-champagne/10 text-champagne': symbolMonitoring.monitoring.status === 'degrading',
                  'border-red-500/35 bg-red-500/10 text-red-100': symbolMonitoring.monitoring.status === 'invalidated',
                  'border-white/10 bg-white/[0.04] text-white/75': !['active', 'degrading', 'invalidated'].includes(symbolMonitoring.monitoring.status),
                })}>
                  Thesis {symbolMonitoring.monitoring.status}
                </span>
                <span className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-white/75">
                  Health {symbolMonitoring.monitoring.healthScore.toFixed(0)}
                </span>
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Best expression', topStructure?.name ?? dossier.view],
                ['Entry posture', entryPosture(dossier.view, ivRvSpread)],
                ['Hold window', holdingWindow(leadCatalysts[0]?.days_out)],
                ['Kill switch', dossier.risk.killers[0] ?? 'Monitor catalyst drift'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[22px] border border-white/10 bg-[#050505] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Trade thesis</p>
                <p className="mt-3 text-sm leading-7 text-white/85">{dossier.thesis.summary}</p>

                {narrativePreview.length > 0 ? (
                  <div className="mt-4 grid gap-2 lg:grid-cols-2">
                    {narrativePreview.map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Vol setup</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ['IV now', formatPercent(dossier.vol_map.iv_now)],
                      ['RV 20D', formatPercent(dossier.vol_map.rv_20d)],
                      ['Skew', dossier.vol_map.skew],
                      ['Term', dossier.vol_map.term_shape],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</p>
                        <p className="mt-1 text-sm text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Catalyst clock</p>
                  <div className="mt-4 space-y-2.5">
                    {leadCatalysts.length > 0 ? (
                      leadCatalysts.map((event) => (
                        <div key={`${event.date}-${event.label}`} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 rounded-full border border-champagne/35 bg-champagne/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-champagne">
                              {event.days_out <= 0 ? 'Now' : `${event.days_out}D`}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 break-words text-sm font-medium leading-6 text-white">{event.label}</p>
                              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{event.context}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        No near-dated catalysts are currently available for this setup.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-emerald-500/18 bg-gradient-to-b from-emerald-500/[0.08] to-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Execution plan</p>
                    <p className="mt-1 text-sm text-muted-foreground">Primary structure, suggested contracts, and the risk conditions that matter now.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openDeepDiveTab('Structure')}
                    className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                  >
                    Compare setups
                  </Button>
                </div>

                {topStructure ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-[22px] border border-white/10 bg-[#050505] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-white">{topStructure.name}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{topStructure.rationale}</p>
                        </div>
                        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-100">
                          Fit {topStructure.fit_score.toFixed(1)}
                        </span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-300 to-champagne/85"
                          style={{ width: `${Math.max(8, Math.min(100, topStructure.fit_score * 10))}%` }}
                        />
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {[
                          ['Entry', topStructure.entry_type],
                          ['Max loss', topStructure.max_loss],
                          ['POP', topStructure.pop],
                          ['Style', topStructure.style],
                        ].map(([label, value]) => (
                          <div key={`${topStructure.name}-${label}`} className="rounded-2xl border border-white/10 px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</p>
                            <p className="mt-1 text-sm text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-[#050505] p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-white/55">Suggested contracts</p>
                      {topStructure.contracts?.length ? (
                        <div className="mt-3 space-y-2">
                          {topStructure.contracts.map((leg) => (
                            <div key={`${topStructure.name}-${leg.leg}-${leg.expiry}-${leg.strike}`} className="rounded-2xl border border-white/10 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]', legSideTone(leg.side))}>
                                    {leg.side}
                                  </span>
                                  <p className="text-sm font-medium text-white">
                                    {leg.side.toUpperCase()} {formatStrike(leg.strike)}{leg.optionType === 'call' ? 'C' : 'P'}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/45">
                                    {leg.leg} · {leg.expiry} · qty {leg.quantity}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-white/75 sm:grid-cols-4">
                                  <div className="rounded-xl border border-white/10 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Mark</p>
                                    <p className="mt-1">{leg.mark != null ? `$${leg.mark.toFixed(2)}` : '--'}</p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Bid/Ask</p>
                                    <p className="mt-1">
                                      {leg.bid != null && leg.ask != null ? `$${leg.bid.toFixed(2)} / $${leg.ask.toFixed(2)}` : '--'}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Delta</p>
                                    <p className="mt-1">{leg.delta != null ? leg.delta.toFixed(2) : '--'}</p>
                                  </div>
                                  <div className="rounded-xl border border-white/10 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">OI</p>
                                    <p className="mt-1">{leg.openInterest != null ? leg.openInterest.toLocaleString() : '--'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">Suggested contracts are still building for this structure.</p>
                      )}
                    </div>

                    <div className="rounded-[22px] border border-white/10 bg-[#050505] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.14em] text-white/55">Execution risk</p>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]',
                            dossier.view === 'Short vol'
                              ? 'border-champagne/35 bg-champagne/10 text-champagne'
                              : dossier.view === 'Long vol'
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-100'
                                : 'border-white/10 bg-white/[0.04] text-white/75',
                          )}
                        >
                          {dossier.view} posture
                        </span>
                      </div>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Kill switch</p>
                          <p className="mt-1 line-clamp-4 text-sm leading-6 text-white/85">{dossier.risk.killers[0] ?? 'Monitor catalyst drift'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Exit framework</p>
                          <p className="mt-1 line-clamp-4 text-sm leading-6 text-white/85">{dossier.risk.exit_framework}</p>
                        </div>
                      </div>
                    </div>

                    {structureAlternatives.length > 0 ? (
                      <div className="rounded-[22px] border border-white/10 bg-[#050505] p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-white/55">Alternatives</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {structureAlternatives.map((structure) => (
                            <button
                              key={`${structure.name}-${structure.fit_score}`}
                              type="button"
                              onClick={() => openDeepDiveTab('Structure')}
                              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/[0.08]"
                            >
                              {structure.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] border border-white/10 bg-[#050505] p-4 text-sm text-muted-foreground">
                    Structure recommendations are refreshing.
                  </div>
                )}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Thesis health</p>
                {symbolMonitoring ? (
                  <div className="mt-3 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Status</p>
                      <p className={cn('mt-1 text-sm font-medium capitalize', monitoringTone(symbolMonitoring.monitoring.status))}>
                        {symbolMonitoring.monitoring.status}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Health score</p>
                      <p className="mt-1 text-sm text-white">{symbolMonitoring.monitoring.healthScore.toFixed(0)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                      {symbolMonitoring.monitoring.note}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                    Save the thesis to track IV drift, catalyst changes, and invalidation pressure from the rail.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div ref={deepDiveRef} className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Research depth</p>
              <button
                type="button"
                onClick={() => setShowDeepDive((current) => !current)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] transition-colors',
                  showDeepDive
                    ? 'border-champagne/35 bg-champagne/10 text-champagne'
                    : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]',
                )}
              >
                {showDeepDive ? 'Hide details' : 'Show details'}
              </button>
            </div>

            {showDeepDive ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {DOSSIER_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => onTabChange(tab)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] transition-colors',
                      activeTab === tab
                        ? 'border-champagne/35 bg-champagne/10 text-champagne'
                        : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]',
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Keep this collapsed for an execution-first view. Expand to inspect thesis, vol surface, catalyst map, and structure analytics.
              </p>
            )}
          </div>

          {showDeepDive ? (
            <>
          {activeTab === 'Thesis' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Why Swing Sniper cares</p>
                <p className="mt-2 text-sm leading-7 text-white/85">{dossier.thesis.summary}</p>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">What could invalidate it</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.thesis.risks.map((risk) => (
                    <li key={risk} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">{risk}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Narrative shift</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.thesis.narrative_shifts.map((item) => (
                    <li key={item} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Factor breakdown</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Volatility', dossier.thesis.factors.volatility],
                    ['Catalyst', dossier.thesis.factors.catalyst],
                    ['Liquidity', dossier.thesis.factors.liquidity],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#050505] p-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                      <p className="mt-1 font-mono text-lg text-white">{value}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${Math.min(100, Number(value))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Vol Map' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Surface read</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{dossier.vol_map.surface_read}</p>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {dossier.vol_map.term_structure.map((bar) => (
                    <div key={bar.label} className="rounded-2xl border border-white/10 bg-[#050505] p-2 text-center">
                      <div className="mx-auto w-8 rounded-t-lg border border-emerald-500/40 bg-gradient-to-b from-emerald-400/95 to-emerald-900/90" style={{ height: `${Math.max(20, Math.min(82, bar.iv))}px` }} />
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{bar.label}</p>
                      <p className="mt-1 font-mono text-xs text-white">{bar.iv.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-[#050505] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/60">IV vs RV (30D)</p>
                    <p className="text-xs text-white/75">
                      Spread: {ivRvSpread != null ? `${ivRvSpread > 0 ? '+' : ''}${ivRvSpread.toFixed(1)} pts` : '--'}
                    </p>
                  </div>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dossier.vol_map.iv_rv_history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="swing-sniper-rv-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.42} />
                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                        <Tooltip content={chartTooltip} />
                        <Area type="monotone" dataKey="rv" name="RV" stroke="#0f766e" fill="url(#swing-sniper-rv-fill)" strokeWidth={2} />
                        <Area type="monotone" dataKey="iv" name="IV" stroke="#10b981" fillOpacity={0} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Current context</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['IV Rank', dossier.vol_map.iv_rank != null ? dossier.vol_map.iv_rank.toFixed(0) : '--'],
                    ['IV Percentile', dossier.vol_map.iv_percentile != null ? dossier.vol_map.iv_percentile.toFixed(0) : '--'],
                    ['RV 20D', dossier.vol_map.rv_20d != null ? `${dossier.vol_map.rv_20d.toFixed(1)}%` : '--'],
                    ['IV Now', dossier.vol_map.iv_now != null ? `${dossier.vol_map.iv_now.toFixed(1)}%` : '--'],
                    ['Skew', dossier.vol_map.skew],
                    ['Term', dossier.vol_map.term_shape],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                      <p className="mt-1 font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Catalysts' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Catalyst density strip</p>
                <div className="mt-3 grid grid-cols-10 gap-1 lg:grid-cols-15">
                  {buildDensityStrip(
                    dossier.catalysts
                      .map((event) => event.days_out)
                      .filter((days) => days >= 1 && days <= 30),
                  ).map((point) => (
                    <div key={point.day} className="rounded-md border border-white/10 bg-[#050505] p-1 text-center">
                      <div className={cn('mx-auto h-6 w-full rounded', densityTone(point.count))} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{point.day}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Catalyst stack</p>
                <div className="mt-4 space-y-3">
                  {[...dossier.catalysts]
                    .sort((left, right) => left.days_out - right.days_out)
                    .map((event) => (
                      <div key={`${event.date}-${event.label}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                        <div className="font-mono text-xs uppercase tracking-[0.14em] text-champagne">
                          {event.days_out <= 0 ? 'Now' : `${event.days_out}D`}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{event.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{event.context}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Structure' ? (
            <div className="mt-5 space-y-4">
              {dossier.structures.length === 0 ? (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Structure recommendations are refreshing.
                </div>
              ) : null}

              {dossier.structures.map((structure) => (
                <div
                  key={`${structure.name}-${structure.fit_score}`}
                  className="rounded-[24px] border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-white/[0.03] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{structure.name}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{structure.rationale}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-100">
                      Fit {structure.fit_score.toFixed(1)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ['Entry', structure.entry_type],
                      ['Max loss', structure.max_loss],
                      ['POP', structure.pop],
                      ['Style', structure.style],
                    ].map(([label, value]) => (
                      <div key={`${structure.name}-${label}`} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                        <p className="mt-1 font-medium text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-4 rounded-2xl border border-white/10 bg-[#050505] p-3">
                    <summary className="cursor-pointer text-sm text-white/85">Expand: contract picks + scenario distribution</summary>
                    <div className="mt-3 space-y-3">
                      {structure.contracts?.length ? (
                        <div className="space-y-2">
                          {structure.contracts.map((leg) => (
                            <div key={`${structure.name}-${leg.leg}-${leg.expiry}-${leg.strike}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                              <span className="font-medium text-white">{leg.leg}</span> · {leg.side} {leg.quantity} {leg.expiry} {leg.strike}{leg.optionType === 'call' ? 'C' : 'P'} · mark {leg.mark != null ? `$${leg.mark.toFixed(2)}` : '--'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Contract picks are still building for this snapshot.</p>
                      )}

                      {structure.payoff_diagram?.length ? (
                        <div className="rounded-xl border border-white/10 p-3">
                          <p className="text-xs uppercase tracking-[0.14em] text-white/60">Payoff diagram</p>
                          <div className="mt-2 h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart
                                data={structure.payoff_diagram.map((point) => ({
                                  ...point,
                                  label: `${point.returnPct != null ? point.returnPct.toFixed(1) : '0.0'}%`,
                                }))}
                                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                              >
                                <defs>
                                  <linearGradient id={`payoff-fill-${structure.name}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                                <Tooltip content={payoffTooltip} />
                                <Area type="monotone" dataKey="pnl" name="P&L" stroke="#10b981" fill={`url(#payoff-fill-${structure.name})`} strokeWidth={2} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : null}

                      {structure.scenario_distribution?.length ? (
                        <div className="grid gap-2 sm:grid-cols-5">
                          {structure.scenario_distribution.map((scenario) => (
                            <div key={`${structure.name}-${scenario.label}`} className="rounded-xl border border-white/10 px-2 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-white/50">{scenario.label}</p>
                              <p className="mt-1 text-sm font-medium text-white">{scenario.probability.toFixed(0)}%</p>
                              <p className="text-xs text-muted-foreground">
                                {scenario.expectedPnl >= 0 ? '+' : '-'}${Math.abs(scenario.expectedPnl).toFixed(0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'Risk' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">What kills the idea</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.risk.killers.map((killer) => (
                    <li key={killer} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">{killer}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Exit framework</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{dossier.risk.exit_framework}</p>

                {symbolMonitoring ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-[#050505] p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/55">Risk Sentinel</p>
                    <p className={cn('mt-1 capitalize', monitoringTone(symbolMonitoring.monitoring.status))}>
                      {symbolMonitoring.monitoring.status} · health {symbolMonitoring.monitoring.healthScore.toFixed(0)}
                    </p>
                    <p className="mt-2 text-muted-foreground">{symbolMonitoring.monitoring.note}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onSaveThesis}
                    className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-[#050505] px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/[0.06]"
                  >
                    Save thesis to monitor
                    <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
