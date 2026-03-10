'use client'

import { AlertTriangle, CalendarRange, ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton-loader'
import { cn } from '@/lib/utils'
import type {
  SwingSniperBacktestPayload,
  SwingSniperBriefPayload,
  SwingSniperDependencyStatus,
  SwingSniperHealthPayload,
  SwingSniperMonitoringPayload,
} from '@/lib/swing-sniper/types'

interface SwingSniperMemoRailProps {
  brief: SwingSniperBriefPayload | null
  briefLoading: boolean
  briefError: string | null
  monitoring: SwingSniperMonitoringPayload | null
  monitoringLoading: boolean
  monitoringError: string | null
  backtest: SwingSniperBacktestPayload | null
  backtestLoading: boolean
  backtestError: string | null
  health: SwingSniperHealthPayload | null
  healthState: 'checking' | 'ready' | 'error'
  healthError: string | null
}

function dependencyTone(status: SwingSniperDependencyStatus): string {
  if (status === 'ready') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
  if (status === 'optional') return 'border-champagne/25 bg-champagne/10 text-champagne'
  if (status === 'degraded') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-red-500/25 bg-red-500/10 text-red-100'
}

function edgeTone(edgeState: SwingSniperBriefPayload['savedTheses'][number]['edgeState']): string {
  if (edgeState === 'improving') return 'text-emerald-200'
  if (edgeState === 'narrowing') return 'text-amber-100'
  if (edgeState === 'invalidated') return 'text-red-100'
  return 'text-white/70'
}

function alertTone(severity: 'low' | 'medium' | 'high'): string {
  if (severity === 'high') return 'border-red-500/25 bg-red-500/10 text-red-100'
  if (severity === 'medium') return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  return 'border-white/10 bg-[#050505] text-white/75'
}

function formatPct(value: number | null, digits: number = 1): string {
  if (value == null) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function SwingSniperMemoRail({
  brief,
  briefLoading,
  briefError,
  monitoring,
  monitoringLoading,
  monitoringError,
  backtest,
  backtestLoading,
  backtestError,
  health,
  healthState,
  healthError,
}: SwingSniperMemoRailProps) {
  return (
    <aside className="glass-card-heavy rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-300" strokeWidth={1.5} />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">Memo Rail</p>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Market regime</p>
          {briefLoading ? (
            <Skeleton className="mt-3 h-12 w-full rounded-xl" />
          ) : (
            <>
              <div className="mt-2 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-emerald-200">
                {brief?.regime.label || 'Unavailable'}
              </div>
              <p className="mt-3 text-sm font-medium text-white">{brief?.regime.description || 'Market memo unavailable.'}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{brief?.memo || briefError || 'Brief data has not loaded yet.'}</p>
              {brief?.outlook ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/60">7-14d outlook</p>
                  <p className="mt-1 text-sm text-white">{brief.outlook.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bias: {brief.outlook.bias.replace('_', ' ')} · Confidence {brief.outlook.confidence.toFixed(1)}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {brief?.boardThemes?.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Board themes</p>
            <div className="mt-3 space-y-2">
              {brief.boardThemes.map((theme) => (
                <div key={theme.key} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                  {theme.label}: {theme.count} names · avg {theme.avgScore.toFixed(1)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-champagne" strokeWidth={1.5} />
            <p className="text-sm font-medium text-white">Saved thesis queue</p>
          </div>

          {briefLoading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : brief?.savedTheses.length ? (
            <div className="mt-3 space-y-3">
              {brief.savedTheses.map((item) => (
                <div key={item.symbol} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{item.symbol}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.setupLabel}</p>
                    </div>
                    <span className={cn('text-xs uppercase tracking-[0.16em]', edgeTone(item.edgeState))}>
                      {item.edgeState}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/75">
                    Saved at IV Rank {item.ivRankAtSave != null ? item.ivRankAtSave.toFixed(0) : '--'}, now {item.ivRankNow != null ? item.ivRankNow.toFixed(0) : '--'}.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.monitorNote}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Save a thesis from the board or dossier and it will land here with IV drift continuity for later monitoring.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Risk Sentinel</p>
          {monitoringLoading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : monitoring ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-[#050505] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Open positions</span>
                  <span className="font-medium text-white">{monitoring.portfolio.openPositions}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Portfolio PnL</span>
                  <span className="font-medium text-white">
                    {monitoring.portfolio.totalPnl >= 0 ? '+' : '-'}${Math.abs(monitoring.portfolio.totalPnl).toFixed(0)} ({monitoring.portfolio.totalPnlPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Risk level</span>
                  <span className="font-medium text-white">{monitoring.portfolio.riskLevel}</span>
                </div>
                {monitoring.cadence ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Cadence</span>
                    <span className="font-medium text-white">~{monitoring.cadence.refreshIntervalMinutes}m</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                {monitoring.alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className={cn('rounded-xl border px-3 py-2 text-sm', alertTone(alert.severity))}>
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-1 opacity-90">{alert.message}</p>
                  </div>
                ))}
                {monitoring.alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active monitoring alerts.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{monitoringError || 'Risk Sentinel is unavailable.'}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Backtest confidence</p>
          {backtestLoading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : backtest ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 rounded-xl border border-white/10 bg-[#050505] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Resolved samples</span>
                  <span className="font-medium text-white">{backtest.summary.resolvedSamples}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Weighted hit rate</span>
                  <span className="font-medium text-white">{formatPct(backtest.summary.weightedHitRatePct)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Confidence weight</span>
                  <span className="font-medium text-white">{backtest.confidence.confidenceWeight.toFixed(3)}</span>
                </div>
              </div>
              {backtest.caveats.slice(0, 2).map((caveat) => (
                <div key={caveat} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {caveat}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{backtestError || 'Backtest confidence is unavailable.'}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Action queue</p>
          <div className="mt-3 space-y-2">
            {(brief?.actionQueue || []).map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
            {!brief?.actionQueue?.length && !briefLoading ? (
              <p className="text-sm text-muted-foreground">No action items yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Dependency preflight</p>

          {healthState === 'checking' ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : null}

          {healthState === 'error' ? (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="font-medium">Health endpoint unavailable</p>
                  <p className="mt-1 text-red-100/80">{healthError || 'Unable to load Swing Sniper health.'}</p>
                </div>
              </div>
            </div>
          ) : null}

          {healthState === 'ready' && health ? (
            <div className="mt-4 space-y-3">
              {health.dependencies.map((dependency) => (
                <div
                  key={dependency.key}
                  className={cn('rounded-2xl border px-3 py-3 text-sm', dependencyTone(dependency.status))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{dependency.label}</p>
                    <span className="text-[11px] uppercase tracking-[0.18em] opacity-80">{dependency.status}</span>
                  </div>
                  <p className="mt-1 text-sm opacity-85">{dependency.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
