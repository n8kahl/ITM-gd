'use client'

import { useCallback, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react'
import { useSpxHealthReports, type HealthReport, type HealthReportStatus, type HealthReportType } from '@/hooks/use-spx-health-reports'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const REPORT_META: Record<HealthReportType, { label: string; description: string; icon: typeof Activity }> = {
  daily_health: {
    label: 'Daily Health Check',
    description: 'Metadata, gates, confluence, optimizer profile, data freshness',
    icon: Activity,
  },
  optimizer_drift: {
    label: 'Optimizer Drift',
    description: 'Calibrated thresholds vs active optimizer profile',
    icon: Shield,
  },
  shadow_gate: {
    label: 'Shadow Gate Analysis',
    description: 'Gate threshold effectiveness — blocked vs winning setups',
    icon: AlertTriangle,
  },
  build_validation: {
    label: 'Build Validation',
    description: 'TypeScript, lint, build, and test suite status',
    icon: CheckCircle2,
  },
}

function statusColor(status: HealthReportStatus): string {
  switch (status) {
    case 'pass': return 'text-emerald-300'
    case 'warn': return 'text-amber-300'
    case 'fail': return 'text-rose-300'
    case 'info': return 'text-cyan-300'
    default: return 'text-white/60'
  }
}

function statusBorderColor(status: HealthReportStatus): string {
  switch (status) {
    case 'pass': return 'border-emerald-400/30 bg-emerald-500/[0.06]'
    case 'warn': return 'border-amber-400/30 bg-amber-500/[0.06]'
    case 'fail': return 'border-rose-400/30 bg-rose-500/[0.06]'
    case 'info': return 'border-cyan-400/30 bg-cyan-500/[0.06]'
    default: return 'border-white/12 bg-black/30'
  }
}

function StatusBadge({ status }: { status: HealthReportStatus }) {
  const Icon = status === 'pass' ? CheckCircle2 : status === 'fail' ? XCircle : AlertTriangle
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.1em]', statusBorderColor(status), statusColor(status))}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  )
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = Date.parse(isoDate)
  if (!Number.isFinite(then)) return '--'
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

function formatEtTimestamp(isoDate: string): string {
  const parsed = Date.parse(isoDate)
  if (!Number.isFinite(parsed)) return '--'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(parsed))
}

/* ------------------------------------------------------------------ */
/* Summary Renderers by Report Type                                   */
/* ------------------------------------------------------------------ */

function DailyHealthSummary({ report }: { report: HealthReport }) {
  const summary = report.summary as Record<string, unknown>
  const checks = (report.full_report as Record<string, unknown>).checks as Record<string, { status: string; details: Record<string, unknown> }> | undefined

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricCard label="Total Setups" value={String(summary.totalSetups ?? '--')} />
        <MetricCard label="Passed" value={String(summary.passedChecks ?? '--')} tone="emerald" />
        <MetricCard label="Warnings" value={String(summary.warnings ?? '--')} tone={Number(summary.warnings) > 0 ? 'amber' : 'neutral'} />
        <MetricCard label="Failures" value={String(summary.failures ?? '--')} tone={Number(summary.failures) > 0 ? 'rose' : 'neutral'} />
      </div>
      {checks && (
        <div className="space-y-1">
          {Object.entries(checks).map(([key, check]) => (
            <div key={key} className="flex items-center justify-between rounded border border-white/8 bg-black/20 px-2 py-1 text-[10px]">
              <span className="text-white/70">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className={cn('font-mono', check.status === 'PASS' ? 'text-emerald-300' : check.status === 'FAIL' ? 'text-rose-300' : 'text-amber-300')}>
                {check.status}
              </span>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(summary.criticalFindings) && (summary.criticalFindings as string[]).length > 0 && (
        <div className="rounded border border-rose-300/25 bg-rose-500/[0.06] p-2 text-[10px] text-rose-200">
          <p className="mb-1 text-[9px] uppercase tracking-[0.1em] text-rose-100">Critical Findings</p>
          {(summary.criticalFindings as string[]).map((finding, i) => (
            <p key={i} className="leading-snug">{finding}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function OptimizerDriftSummary({ report }: { report: HealthReport }) {
  const full = report.full_report as Record<string, unknown>
  const drifts = (full.drifts ?? []) as Array<{ field: string; expected: number; actual: number | null }>
  const actual = full.actual as Record<string, number | null> | undefined
  const expected = full.expected as Record<string, number> | undefined

  return (
    <div className="space-y-2">
      {expected && actual && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <ThresholdCard label="Min pWin" expected={expected.minPWinCalibrated} actual={actual.minPWinCalibrated} />
          <ThresholdCard label="Min Confluence" expected={expected.minConfluenceScore} actual={actual.minConfluenceScore} />
          <ThresholdCard label="Min EvR" expected={expected.minEvR} actual={actual.minEvR} />
          <ThresholdCard label="Min Trades" expected={expected.minTradesPerCombo} actual={actual.minTradesPerCombo} />
          <ThresholdCard label="ATR Stop ×" expected={expected.atrStopMultiplier} actual={actual.atrStopMultiplier} />
        </div>
      )}
      {drifts.length > 0 && (
        <div className="rounded border border-amber-300/25 bg-amber-500/[0.06] p-2 text-[10px] text-amber-200">
          <p className="mb-1 text-[9px] uppercase tracking-[0.1em] text-amber-100">Drift Detected</p>
          {drifts.map((d, i) => (
            <p key={i} className="font-mono leading-snug">
              {d.field}: expected {d.expected}, got {d.actual ?? 'null'}
            </p>
          ))}
        </div>
      )}
      {drifts.length === 0 && (
        <p className="text-[10px] text-emerald-200/80">All calibrated thresholds match active optimizer profile.</p>
      )}
    </div>
  )
}

function GenericSummary({ report }: { report: HealthReport }) {
  const summary = report.summary as Record<string, unknown>
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[10px]">
      {Object.entries(summary).map(([key, value]) => (
        <div key={key} className="contents">
          <span className="text-white/60">{key}</span>
          <span className="font-mono text-white/85">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '--')}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reusable Card Components                                           */
/* ------------------------------------------------------------------ */

function MetricCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' | 'neutral' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-200' : tone === 'amber' ? 'text-amber-200' : tone === 'rose' ? 'text-rose-200' : 'text-white/85'
  return (
    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">{label}</p>
      <p className={cn('font-mono text-sm', toneClass)}>{value}</p>
    </div>
  )
}

function ThresholdCard({ label, expected, actual }: { label: string; expected: number; actual: number | null }) {
  const matches = actual != null && Math.abs(actual - expected) < 0.01
  return (
    <div className={cn('rounded border px-2 py-1.5', matches ? 'border-emerald-400/20 bg-emerald-500/[0.04]' : 'border-amber-400/20 bg-amber-500/[0.04]')}>
      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">{label}</p>
      <p className={cn('font-mono text-sm', matches ? 'text-emerald-200' : 'text-amber-200')}>
        {actual != null ? actual : '--'}
      </p>
      <p className="text-[9px] text-white/40">expected: {expected}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Report Card (expandable)                                           */
/* ------------------------------------------------------------------ */

function ReportCard({ type, report }: { type: HealthReportType; report: HealthReport | null }) {
  const [expanded, setExpanded] = useState(false)
  const meta = REPORT_META[type]
  const Icon = meta.icon

  if (!report) {
    return (
      <div className="rounded-xl border border-white/8 bg-black/20 p-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-white/30" />
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/45">{meta.label}</p>
            <p className="text-[9px] text-white/30">{meta.description}</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-white/35">No reports yet — first run scheduled automatically.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border p-3 transition-colors', statusBorderColor(report.status as HealthReportStatus))}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', statusColor(report.status as HealthReportStatus))} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/80">{meta.label}</p>
              <StatusBadge status={report.status as HealthReportStatus} />
            </div>
            <p className="text-[9px] text-white/45">
              {formatEtTimestamp(report.created_at)} ET · {formatRelativeTime(report.created_at)}
              {report.session_date ? ` · Session: ${report.session_date}` : ''}
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-white/40" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-white/40" />}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-white/8 pt-3">
          {type === 'daily_health' && <DailyHealthSummary report={report} />}
          {type === 'optimizer_drift' && <OptimizerDriftSummary report={report} />}
          {(type === 'shadow_gate' || type === 'build_validation') && <GenericSummary report={report} />}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* History timeline                                                   */
/* ------------------------------------------------------------------ */

function ReportTimeline({ reports }: { reports: HealthReport[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? reports : reports.slice(0, 10)

  if (reports.length === 0) {
    return <p className="text-[10px] text-white/40">No report history yet.</p>
  }

  return (
    <div className="space-y-1">
      {visible.map((report) => {
        const meta = REPORT_META[report.report_type as HealthReportType]
        return (
          <div
            key={report.id}
            className="flex items-center justify-between rounded border border-white/8 bg-black/20 px-2 py-1 text-[10px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <StatusBadge status={report.status as HealthReportStatus} />
              <span className="truncate text-white/70">{meta?.label ?? report.report_type}</span>
            </div>
            <div className="flex items-center gap-2 text-white/45">
              <Clock className="h-3 w-3" />
              <span className="font-mono">{formatEtTimestamp(report.created_at)} ET</span>
            </div>
          </div>
        )
      })}
      {reports.length > 10 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-[10px] text-emerald-200/70 hover:text-emerald-200"
        >
          Show all {reports.length} reports
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main Export                                                         */
/* ------------------------------------------------------------------ */

export function SystemHealthTab() {
  const { latestByType, recentReports, isLoading, error, refresh } = useSpxHealthReports()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [refresh])

  // Overall status summary
  const overallStatus: HealthReportStatus = (() => {
    const statuses = Object.values(latestByType)
      .filter((r): r is HealthReport => r != null)
      .map((r) => r.status as HealthReportStatus)
    if (statuses.some((s) => s === 'fail')) return 'fail'
    if (statuses.some((s) => s === 'warn')) return 'warn'
    if (statuses.length === 0) return 'info'
    return 'pass'
  })()

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
      {error && (
        <div className="px-4 pt-2">
          <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
            {error}
          </p>
        </div>
      )}

      <div className="grid gap-3 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Sidebar: Overall status + schedule info */}
        <aside className="space-y-3">
          <section className={cn('rounded-xl border p-3', statusBorderColor(overallStatus))}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Activity className={cn('h-3.5 w-3.5', statusColor(overallStatus))} />
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/80">System Status</p>
              </div>
              <StatusBadge status={overallStatus} />
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-[10px] text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading reports…
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[10px]">
                {(['daily_health', 'optimizer_drift', 'shadow_gate', 'build_validation'] as HealthReportType[]).map((type) => {
                  const report = latestByType[type]
                  return (
                    <div key={type} className="contents">
                      <span className="text-white/60">{REPORT_META[type].label}</span>
                      {report ? (
                        <span className={cn('font-mono', statusColor(report.status as HealthReportStatus))}>
                          {report.status.toUpperCase()} · {formatRelativeTime(report.created_at)}
                        </span>
                      ) : (
                        <span className="font-mono text-white/30">--</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/12 bg-black/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Monitoring Schedule</p>
            <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[10px] text-white/70">
              <span>Daily Health</span>
              <span className="font-mono text-emerald-200/80">4:30 PM ET · Weekdays</span>
              <span>Optimizer Drift</span>
              <span className="font-mono text-emerald-200/80">6:00 AM ET · Weekdays</span>
              <span>Shadow Gate</span>
              <span className="font-mono text-white/45">Manual / Weekly</span>
              <span>Build Validation</span>
              <span className="font-mono text-white/45">Manual / Weekly</span>
              <span>Report Cleanup</span>
              <span className="font-mono text-white/45">Sundays · 90d retention</span>
            </div>
          </section>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] py-2 text-[10px] uppercase tracking-[0.08em] text-white/60 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            Refresh Reports
          </button>
        </aside>

        {/* Main: Report cards + history */}
        <main className="space-y-3">
          <ReportCard type="daily_health" report={latestByType.daily_health ?? null} />
          <ReportCard type="optimizer_drift" report={latestByType.optimizer_drift ?? null} />
          <ReportCard type="shadow_gate" report={latestByType.shadow_gate ?? null} />
          <ReportCard type="build_validation" report={latestByType.build_validation ?? null} />

          <section className="rounded-xl border border-white/12 bg-black/30 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/58">Report History (14 days)</p>
            <ReportTimeline reports={recentReports} />
          </section>
        </main>
      </div>
    </div>
  )
}
