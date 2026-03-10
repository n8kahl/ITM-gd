'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BookmarkPlus, ListPlus } from 'lucide-react'
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
  loading: boolean
  error: boolean
  activeTab: DossierTab
  monitoring: SwingSniperMonitoringPayload | null
  onTabChange: (tab: DossierTab) => void
  onSaveThesis: () => void
  onAddToWatchlist: () => void
  savePending: boolean
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

export function DossierPanel({
  dossier,
  loading,
  error,
  activeTab,
  monitoring,
  onTabChange,
  onSaveThesis,
  onAddToWatchlist,
  savePending,
}: DossierPanelProps) {
  const symbolMonitoring = dossier
    ? monitoring?.savedTheses.find((item) => item.symbol === dossier.symbol) || null
    : null

  const ivRvSpread = dossier?.vol_map.iv_now != null && dossier?.vol_map.rv_20d != null
    ? dossier.vol_map.iv_now - dossier.vol_map.rv_20d
    : null

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 p-5" data-testid="swing-sniper-dossier">
      {loading ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-white/7" />
            <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-white/6" />
          </div>
          <div className="flex flex-wrap gap-2">
            {DOSSIER_TABS.map((tab) => (
              <div key={tab} className="h-8 w-20 animate-pulse rounded-full border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
          Refreshing research data…
        </div>
      ) : null}

      {!loading && !error && dossier ? (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-3 py-1 font-mono text-xs', scoreTone(dossier.orc_score))}>
                    ORC {dossier.orc_score}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/75">
                    {dossier.view}
                  </span>
                  <span className="rounded-full border border-white/10 bg-[#050505] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/75">
                    {dossier.catalyst_label}
                  </span>
                </div>

                <h2 className="mt-4 font-[family-name:var(--font-playfair)] text-4xl tracking-[-0.03em] text-white">
                  {dossier.symbol}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{dossier.headline}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onSaveThesis}
                  disabled={savePending}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  {savePending ? 'Saving…' : 'Save thesis'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddToWatchlist}
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ListPlus className="mr-2 h-4 w-4" />
                  Add to watchlist
                </Button>
              </div>
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
                    ? 'border-champagne/35 bg-champagne/10 text-champagne'
                    : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]',
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Thesis' ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Why Swing Sniper cares</p>
                <p className="mt-2 text-sm leading-7 text-white/85">{dossier.thesis.summary}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">What could invalidate it</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.thesis.risks.map((risk) => (
                    <li key={risk} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">{risk}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Narrative shift</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.thesis.narrative_shifts.map((item) => (
                    <li key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Factor breakdown</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    ['Volatility', dossier.thesis.factors.volatility],
                    ['Catalyst', dossier.thesis.factors.catalyst],
                    ['Liquidity', dossier.thesis.factors.liquidity],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-[#050505] p-3">
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Surface read</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{dossier.vol_map.surface_read}</p>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {dossier.vol_map.term_structure.map((bar) => (
                    <div key={bar.label} className="rounded-xl border border-white/10 bg-[#050505] p-2 text-center">
                      <div className="mx-auto h-16 w-8 rounded-t-lg border border-emerald-500/40 bg-gradient-to-b from-emerald-400/95 to-emerald-900/90" style={{ height: `${Math.max(20, Math.min(82, bar.iv))}px` }} />
                      <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{bar.label}</p>
                      <p className="mt-1 font-mono text-xs text-white">{bar.iv.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#050505] p-3">
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

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                    <div key={label} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Catalyst density strip</p>
                <div className="mt-3 grid grid-cols-10 gap-1 lg:grid-cols-15">
                  {buildDensityStrip(dossier.catalysts.map((event) => event.days_out).filter((days) => days >= 1 && days <= 30)).map((point) => (
                    <div key={point.day} className="rounded-md border border-white/10 bg-[#050505] p-1 text-center">
                      <div className={cn('mx-auto h-6 w-full rounded', densityTone(point.count))} />
                      <p className="mt-1 text-[10px] text-muted-foreground">{point.day}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Structure recommendations are refreshing.
                </div>
              ) : null}

              {dossier.structures.map((structure) => (
                <div
                  key={`${structure.name}-${structure.fit_score}`}
                  className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.08] to-white/[0.03] p-4"
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
                      <div key={`${structure.name}-${label}`} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                        <p className="mt-1 font-medium text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-4 rounded-xl border border-white/10 bg-[#050505] p-3">
                    <summary className="cursor-pointer text-sm text-white/85">Expand: contract picks + scenario distribution</summary>
                    <div className="mt-3 space-y-3">
                      {structure.contracts?.length ? (
                        <div className="space-y-2">
                          {structure.contracts.map((leg) => (
                            <div key={`${structure.name}-${leg.leg}-${leg.expiry}-${leg.strike}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-muted-foreground">
                              <span className="font-medium text-white">{leg.leg}</span> · {leg.side} {leg.quantity} {leg.expiry} {leg.strike}{leg.optionType === 'call' ? 'C' : 'P'} · mark {leg.mark != null ? `$${leg.mark.toFixed(2)}` : '--'}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Contract picks are still building for this snapshot.</p>
                      )}

                      {structure.payoff_diagram?.length ? (
                        <div className="rounded-lg border border-white/10 p-3">
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
                            <div key={`${structure.name}-${scenario.label}`} className="rounded-lg border border-white/10 px-2 py-2 text-center">
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
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">What kills the idea</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  {dossier.risk.killers.map((killer) => (
                    <li key={killer} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">{killer}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Exit framework</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{dossier.risk.exit_framework}</p>

                {symbolMonitoring ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-[#050505] p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/55">Risk Sentinel</p>
                    <p className="mt-1 text-white">{symbolMonitoring.monitoring.status} · health {symbolMonitoring.monitoring.healthScore.toFixed(0)}</p>
                    <p className="mt-2 text-muted-foreground">{symbolMonitoring.monitoring.note}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
