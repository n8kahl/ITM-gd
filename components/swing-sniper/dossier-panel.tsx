'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, BookmarkPlus, CalendarDays, ScrollText, ShieldAlert, Waypoints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'
import { cn } from '@/lib/utils'
import type {
  SwingSniperBacktestPayload,
  SwingSniperDossierPayload,
  SwingSniperMonitoringPayload,
  SwingSniperStructureRecommendation,
} from '@/lib/swing-sniper/types'

const DOSSIER_TABS = ['Thesis', 'Vol Map', 'Catalysts', 'Structure', 'Risk'] as const

type DossierTab = (typeof DOSSIER_TABS)[number]

interface DossierPanelProps {
  dossier: SwingSniperDossierPayload | null
  monitoring: SwingSniperMonitoringPayload | null
  monitoringLoading: boolean
  monitoringError: string | null
  backtest: SwingSniperBacktestPayload | null
  backtestLoading: boolean
  backtestError: string | null
  loading: boolean
  error: string | null
  activeTab: DossierTab
  onTabChange: (tab: DossierTab) => void
  onSaveThesis: () => void
  savePending: boolean
}

function scoreTone(score: number | null): string {
  if (score == null) return 'text-white/60'
  if (score >= 80) return 'text-emerald-200'
  if (score >= 65) return 'text-champagne'
  return 'text-white/75'
}

function densityTone(count: number, emphasis: 'high' | 'medium' | 'low'): string {
  if (count === 0) return 'bg-white/[0.06]'
  if (emphasis === 'high') return 'bg-emerald-500/80'
  if (emphasis === 'medium') return 'bg-champagne/80'
  return 'bg-emerald-500/40'
}

function monitoringStatusTone(status: 'forming' | 'active' | 'degrading' | 'invalidated' | 'closed'): string {
  if (status === 'active') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
  if (status === 'degrading') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  if (status === 'invalidated' || status === 'closed') return 'border-red-500/25 bg-red-500/10 text-red-100'
  return 'border-white/10 bg-white/5 text-white/75'
}

function formatUsd(value: number | null): string {
  if (value == null) return '--'
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })}`
}

function formatPct(value: number | null, digits: number = 1): string {
  if (value == null) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

function confidenceTone(stance: 'boost' | 'neutral' | 'trim'): string {
  if (stance === 'boost') return 'text-emerald-200'
  if (stance === 'trim') return 'text-amber-100'
  return 'text-white/75'
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | null; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white/80 shadow-xl">
      <p className="font-medium text-white">{label}</p>
      {payload.map((entry) => (
        <p key={`${entry.name}-${label}`}>
          {entry.name}: {typeof entry.value === 'number' ? `${entry.value.toFixed(1)}%` : '--'}
        </p>
      ))}
    </div>
  )
}

function PayoffTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number | null; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-xs text-white/80 shadow-xl">
      <p className="font-medium text-white">{label}</p>
      {payload.map((entry) => (
        <p key={`${entry.name}-${label}`}>
          {entry.name}: {typeof entry.value === 'number' ? formatUsd(entry.value) : '--'}
        </p>
      ))}
    </div>
  )
}

export function DossierPanel({
  dossier,
  monitoring,
  monitoringLoading,
  monitoringError,
  backtest,
  backtestLoading,
  backtestError,
  loading,
  error,
  activeTab,
  onTabChange,
  onSaveThesis,
  savePending,
}: DossierPanelProps) {
  const structureRecommendations: SwingSniperStructureRecommendation[] = dossier?.structureLab?.recommendations || []
  const symbolMonitoring = monitoring?.savedTheses.find((item) => item.symbol === dossier?.symbol) || null

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 p-5" data-testid="swing-sniper-dossier">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Dossier Workspace</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thesis, vol map, catalyst density, and risk framing for the selected idea.
          </p>
        </div>
        <ScrollText className="h-4 w-4 text-champagne" strokeWidth={1.5} />
      </div>

      {loading ? (
        <div className="mt-5 space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" animation="shimmer" />
          <Skeleton className="h-80 w-full rounded-2xl" animation="shimmer" />
          <SkeletonText lines={3} lastLineWidth="55%" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="font-medium">Dossier unavailable</p>
              <p className="mt-1 text-red-100/80">{error}</p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && dossier ? (
        <>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">{dossier.symbol}</h2>
                  {dossier.companyName ? (
                    <span className="text-sm text-muted-foreground">{dossier.companyName}</span>
                  ) : null}
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{dossier.summary}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</p>
                  <p className={cn('mt-1 text-2xl font-semibold', scoreTone(dossier.score))}>{dossier.score ?? '--'}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSaveThesis}
                  disabled={savePending}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  {dossier.saved ? 'Update thesis' : savePending ? 'Saving...' : 'Save thesis'}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {dossier.keyStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-[#050505] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
                  <p className={cn(
                    'mt-1 text-lg font-medium',
                    stat.tone === 'positive'
                      ? 'text-emerald-200'
                      : stat.tone === 'negative'
                        ? 'text-amber-100'
                        : 'text-white',
                  )}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {DOSSIER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] transition-colors',
                  activeTab === tab
                    ? 'border-champagne/30 bg-champagne/10 text-champagne'
                    : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Thesis' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Why this setup is on the board</p>
                <p className="mt-2 text-sm leading-6 text-white/85">{dossier.thesis}</p>
                <div className="mt-4 space-y-3">
                  {dossier.reasoning.map((reason) => (
                    <div key={reason} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                      {reason}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">What matters next</p>
                <div className="mt-4 space-y-3">
                  {dossier.risk.watchItems.map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Vol Map' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">30-session IV vs RV overlay</p>
                    <p className="mt-1 text-sm text-muted-foreground">{dossier.volMap.note}</p>
                  </div>
                </div>

                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dossier.volMap.overlayPoints} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="swing-sniper-rv-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.42} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="rv" name="20D RV" stroke="#0f766e" fill="url(#swing-sniper-rv-fill)" strokeWidth={2} />
                      <Line type="monotone" dataKey="iv" name="Current IV" stroke="#E8E4D9" dot={false} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Vol benchmark</p>
                  <div className="mt-4 grid gap-3">
                    {[
                      ['Current IV', dossier.volMap.currentIV != null ? `${dossier.volMap.currentIV.toFixed(1)}%` : '--'],
                      ['RV10', dossier.volMap.realizedVol10 != null ? `${dossier.volMap.realizedVol10.toFixed(1)}%` : '--'],
                      ['RV20', dossier.volMap.realizedVol20 != null ? `${dossier.volMap.realizedVol20.toFixed(1)}%` : '--'],
                      ['RV30', dossier.volMap.realizedVol30 != null ? `${dossier.volMap.realizedVol30.toFixed(1)}%` : '--'],
                      ['IV Rank', dossier.volMap.ivRank != null ? dossier.volMap.ivRank.toFixed(0) : '--'],
                      ['IV Percentile', dossier.volMap.ivPercentile != null ? dossier.volMap.ivPercentile.toFixed(0) : '--'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <Waypoints className="h-4 w-4 text-champagne" />
                    <p className="text-sm font-medium text-white">Term structure</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dossier.volMap.termStructure.map((point) => (
                      <div key={point.date}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{point.date}</span>
                          <span className="font-medium text-white">{point.atmIV.toFixed(1)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-emerald-500/75"
                            style={{ width: `${Math.min(100, Math.max(12, point.atmIV))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Shape: <span className="text-white/80">{dossier.volMap.termStructureShape}</span>, skew: <span className="text-white/80">{dossier.volMap.skewDirection.replace('_', ' ')}</span>.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Catalysts' ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-300" />
                  <p className="text-sm font-medium text-white">Catalyst density strip</p>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-2 lg:grid-cols-14">
                  {dossier.catalysts.densityStrip.map((point) => (
                    <div key={point.date} className="rounded-xl border border-white/10 bg-[#050505] p-2 text-center">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{point.label}</p>
                      <div className="mt-2 h-10 rounded-lg bg-white/[0.05] p-1">
                        <div className={cn('h-full rounded-md transition-colors', densityTone(point.count, point.emphasis))} />
                      </div>
                      <p className="mt-2 text-sm font-medium text-white">{point.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Event stack</p>
                  <div className="mt-4 space-y-3">
                    {dossier.catalysts.events.map((event) => (
                      <div key={event.id} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-white">{event.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{event.summary}</p>
                          </div>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-white/70">
                            {event.daysUntil <= 0 ? 'Now' : `${event.daysUntil}D`}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
                          <span className="rounded-full border border-white/10 px-2 py-1">{event.type}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1">{event.date}</span>
                          <span className="rounded-full border border-white/10 px-2 py-1">{event.impact} impact</span>
                          {event.expectedMovePct != null ? (
                            <span className="rounded-full border border-white/10 px-2 py-1">{event.expectedMovePct.toFixed(1)}% expected move</span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Narrative read</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{dossier.catalysts.narrative}</p>
                  <div className="mt-4 space-y-3">
                    {dossier.news.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-white/10 bg-[#050505] px-3 py-3 transition-colors hover:bg-white/[0.05]"
                      >
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/45">{item.publisher}</p>
                        {item.summary ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Structure' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-4">
                {structureRecommendations.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-white">Structure Lab pending snapshot</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {dossier.expressionPreview}. Contract recommendations are temporarily unavailable for the current chain snapshot.
                    </p>
                  </div>
                ) : null}

                {structureRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">{recommendation.strategyLabel}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{recommendation.contractSummary}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-right">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Thesis fit</p>
                        <p className={cn('mt-1 text-lg font-semibold', scoreTone(recommendation.thesisFit))}>{recommendation.thesisFit}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        ['Premium', recommendation.netPremium != null ? `$${recommendation.netPremium.toFixed(2)} ${recommendation.debitOrCredit}` : '--'],
                        ['Max loss', formatUsd(recommendation.maxLoss)],
                        ['Max profit', formatUsd(recommendation.maxProfit)],
                        ['POP', recommendation.probabilityOfProfit != null ? `${recommendation.probabilityOfProfit.toFixed(1)}%` : '--'],
                        ['Liquidity', recommendation.liquidityScore != null ? recommendation.liquidityScore.toFixed(1) : '--'],
                        ['Spread', recommendation.spreadQuality],
                      ].map(([label, value]) => (
                        <div key={`${recommendation.id}-${label}`} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                          <p className="mt-1 font-medium text-white">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                      <div className="rounded-xl border border-white/10 bg-[#050505] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/60">Payoff diagram</p>
                        <div className="mt-2 h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={recommendation.payoffDiagram.map((point) => ({
                                ...point,
                                label: `${point.returnPct != null ? point.returnPct.toFixed(1) : '0.0'}%`,
                              }))}
                              margin={{ top: 10, right: 12, bottom: 0, left: 0 }}
                            >
                              <defs>
                                <linearGradient id={`payoff-fill-${recommendation.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                              <Tooltip content={<PayoffTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="pnl"
                                name="P&L"
                                stroke="#0f766e"
                                fill={`url(#payoff-fill-${recommendation.id})`}
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-xl border border-white/10 bg-[#050505] p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/60">Scenario summary</p>
                        {[recommendation.scenarioSummary.bearCase, recommendation.scenarioSummary.baseCase, recommendation.scenarioSummary.bullCase].map((line) => (
                          <div key={`${recommendation.id}-${line}`} className="rounded-lg border border-white/10 px-2 py-2 text-sm text-muted-foreground">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-[#050505] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/60">Probability-weighted distribution</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-5">
                        {recommendation.payoffDistribution.map((bucket) => (
                          <div key={`${recommendation.id}-${bucket.label}`} className="rounded-lg border border-white/10 px-2 py-2 text-center">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">{bucket.label}</p>
                            <p className="mt-1 text-sm font-medium text-white">{bucket.probability.toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">{formatUsd(bucket.expectedPnl)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/60">Contract legs</p>
                        <div className="mt-2 space-y-2">
                          {recommendation.contracts.map((leg) => (
                            <div key={`${recommendation.id}-${leg.leg}-${leg.expiry}-${leg.strike}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                              <span className="font-medium text-white">{leg.leg}:</span>{' '}
                              {leg.side} {leg.quantity} {leg.expiry} {leg.strike}{leg.optionType === 'call' ? 'C' : 'P'}
                              {' · '}mark {leg.mark != null ? `$${leg.mark.toFixed(2)}` : '--'}
                              {' · '}spread {leg.spreadPct != null ? `${leg.spreadPct.toFixed(1)}%` : '--'}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/60">Why this structure</p>
                        <div className="mt-2 space-y-2">
                          {recommendation.whyThisStructure.map((line) => (
                            <div key={`${recommendation.id}-${line}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                              {line}
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/60">Invalidation</p>
                        <div className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                          {recommendation.invalidation}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Structure lab notes</p>
                <div className="mt-3 space-y-3">
                  {(dossier.structureLab?.notes || [
                    'Structure recommendations are currently unavailable. Refresh to retry contract discovery.',
                  ]).map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'Risk' ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-100" />
                    <p className="text-sm font-medium text-white">Risk Sentinel status</p>
                  </div>

                  {monitoringLoading ? (
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-14 w-full rounded-2xl" />
                      <Skeleton className="h-14 w-full rounded-2xl" />
                    </div>
                  ) : symbolMonitoring ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className={cn('rounded-xl border px-3 py-2', monitoringStatusTone(symbolMonitoring.monitoring.status))}>
                          <p className="text-[11px] uppercase tracking-[0.14em] opacity-80">Status</p>
                          <p className="mt-1 text-sm font-semibold">{symbolMonitoring.monitoring.status}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Health score</p>
                          <p className={cn('mt-1 text-sm font-semibold', scoreTone(symbolMonitoring.monitoring.healthScore))}>
                            {symbolMonitoring.monitoring.healthScore}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Exit bias</p>
                          <p className="mt-1 text-sm font-semibold text-white">{symbolMonitoring.monitoring.exitBias}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">IV drift</p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {symbolMonitoring.ivRankAtSave != null ? symbolMonitoring.ivRankAtSave.toFixed(0) : '--'}
                            {' -> '}
                            {symbolMonitoring.ivRankNow != null ? symbolMonitoring.ivRankNow.toFixed(0) : '--'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        {symbolMonitoring.monitoring.note}
                      </div>

                      {symbolMonitoring.monitoring.primaryRisk ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm leading-6 text-amber-100">
                          {symbolMonitoring.monitoring.primaryRisk}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                      {monitoringError || 'No saved thesis monitoring snapshot for this symbol yet. Save a thesis to activate Risk Sentinel tracking.'}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Portfolio fit</p>
                  {monitoringLoading ? (
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : monitoring ? (
                    <div className="mt-4 space-y-3">
                      {[
                        ['Open positions', `${monitoring.portfolio.openPositions}`],
                        ['Portfolio PnL', `${monitoring.portfolio.totalPnl >= 0 ? '+' : ''}$${Math.abs(monitoring.portfolio.totalPnl).toFixed(0)} (${monitoring.portfolio.totalPnlPct.toFixed(1)}%)`],
                        ['Risk level', monitoring.portfolio.riskLevel],
                        ['Net delta', monitoring.portfolio.netGreeks.delta.toFixed(2)],
                        ['Net theta', monitoring.portfolio.netGreeks.theta.toFixed(2)],
                      ].map(([label, value]) => (
                        <div key={`${label}-${value}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">Portfolio exposure is unavailable.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Adaptive confidence</p>
                {backtestLoading ? (
                  <div className="mt-4 space-y-3">
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                ) : backtest ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Status</p>
                        <p className="mt-1 text-sm font-semibold text-white">{backtest.status}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Hit rate</p>
                        <p className="mt-1 text-sm font-semibold text-white">{formatPct(backtest.summary.weightedHitRatePct)}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Weight</p>
                        <p className={cn('mt-1 text-sm font-semibold', confidenceTone(backtest.confidence.stance))}>
                          {backtest.confidence.confidenceWeight.toFixed(3)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">Adj score</p>
                        <p className={cn('mt-1 text-sm font-semibold', scoreTone(backtest.confidence.adjustedScore))}>
                          {backtest.confidence.adjustedScore ?? '--'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {backtest.confidence.rationale.map((line) => (
                        <div key={line} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                          {line}
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#050505] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/60">Recent outcomes</p>
                      <div className="mt-2 space-y-2">
                        {backtest.outcomes.slice(0, 4).map((outcome) => (
                          <div key={`${outcome.snapshotDate}-${outcome.horizonDays}`} className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-2 text-sm">
                            <span className="text-white/80">{outcome.snapshotDate}</span>
                            <span className={cn('font-medium', outcome.success ? 'text-emerald-200' : 'text-amber-100')}>
                              {formatPct(outcome.movePct, 2)} / {outcome.horizonDays}D
                            </span>
                          </div>
                        ))}
                        {backtest.outcomes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No resolved outcomes yet.</p>
                        ) : null}
                      </div>
                    </div>

                    {backtest.caveats.length > 0 ? (
                      <div className="space-y-2">
                        {backtest.caveats.map((item) => (
                          <div key={item} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">{backtestError || 'Adaptive confidence context is unavailable for this symbol.'}</p>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-100" />
                    <p className="text-sm font-medium text-white">Invalidation</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dossier.risk.invalidation.map((item) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Watch items</p>
                  <div className="mt-4 space-y-3">
                    {dossier.risk.watchItems.map((item) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Risk notes</p>
                  <div className="mt-4 space-y-3">
                    {dossier.risk.notes.map((item) => (
                      <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-sm leading-6 text-muted-foreground">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
