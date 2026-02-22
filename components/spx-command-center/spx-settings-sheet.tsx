'use client'

import { useCallback, useMemo, useState } from 'react'
import { Loader2, Settings2, Sparkles, X } from 'lucide-react'
import { useSPXOptimizer } from '@/hooks/use-spx-optimizer'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'

interface SPXSettingsSheetProps {
  open: boolean
  onOpenChange: (next: boolean) => void
}

function summarizeError(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Error) return value.message
  return String(value)
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}%`
}

function formatR(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(3)}R`
}

function formatObjective(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(2)
}

function formatPoints(value: number | null | undefined, decimals = 2): string {
  if (!Number.isFinite(value ?? NaN)) return '--'
  return `${Number(value).toFixed(decimals)}`
}

function formatCI(value: { lowerPct: number; upperPct: number } | null | undefined): string {
  if (!value || !Number.isFinite(value.lowerPct) || !Number.isFinite(value.upperPct)) return '--'
  return `${value.lowerPct.toFixed(1)}-${value.upperPct.toFixed(1)}%`
}

function formatEtIso(value: string | null | undefined): string {
  if (!value) return '--'
  const parsed = Date.parse(value)
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

function statTone(delta: number): string {
  if (delta > 0) return 'text-emerald-200'
  if (delta < 0) return 'text-rose-200'
  return 'text-white/70'
}

function formatDelta(value: number, suffix = ''): string {
  if (!Number.isFinite(value)) return '--'
  if (value > 0) return `+${value.toFixed(2)}${suffix}`
  if (value < 0) return `${value.toFixed(2)}${suffix}`
  return `0.00${suffix}`
}

function formatHistoryTime(value: string): string {
  const parsed = Date.parse(value)
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

function formatBucketLabel(value: string): string {
  if (!value) return '--'
  return value
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/_/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' • ')
}

export function SPXSettingsSheet({ open, onOpenChange }: SPXSettingsSheetProps) {
  const [activeRevertId, setActiveRevertId] = useState<number | null>(null)
  const {
    scorecard,
    schedule,
    history,
    isLoading,
    isScheduleLoading,
    isHistoryLoading,
    error,
    scheduleError,
    historyError,
    isScanning,
    scanError,
    isReverting,
    revertError,
    runScan,
    revertToHistory,
    refresh,
    refreshSchedule,
    refreshHistory,
  } = useSPXOptimizer()

  const loadError = useMemo(
    () => summarizeError(error) || summarizeError(scheduleError) || summarizeError(historyError),
    [error, scheduleError, historyError],
  )
  const strategyRows = useMemo(() => {
    if (!scorecard) return []
    return [...scorecard.setupTypePerformance]
      .filter((bucket) => Number.isFinite(bucket.tradeCount) && bucket.tradeCount > 0)
      .sort((a, b) => {
        if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount
        return b.t1WinRatePct - a.t1WinRatePct
      })
      .slice(0, 6)
  }, [scorecard])
  const comboRows = useMemo(() => {
    if (!scorecard) return []
    return [...scorecard.setupComboPerformance]
      .filter((bucket) => Number.isFinite(bucket.tradeCount) && bucket.tradeCount > 0)
      .sort((a, b) => {
        if (b.tradeCount !== a.tradeCount) return b.tradeCount - a.tradeCount
        return b.t1WinRatePct - a.t1WinRatePct
      })
      .slice(0, 4)
  }, [scorecard])
  const strategyAverages = useMemo(() => {
    if (!scorecard) return null
    const buckets = scorecard.setupTypePerformance.filter((bucket) => (
      Number.isFinite(bucket.tradeCount) && bucket.tradeCount > 0
    ))
    if (buckets.length === 0) return null
    const totalTrades = buckets.reduce((sum, bucket) => sum + bucket.tradeCount, 0)
    if (totalTrades <= 0) return null
    const weightedT1 = buckets.reduce((sum, bucket) => sum + (bucket.t1WinRatePct * bucket.tradeCount), 0) / totalTrades
    const weightedT2 = buckets.reduce((sum, bucket) => sum + (bucket.t2WinRatePct * bucket.tradeCount), 0) / totalTrades
    const weightedFailure = buckets.reduce((sum, bucket) => sum + (bucket.failureRatePct * bucket.tradeCount), 0) / totalTrades
    return {
      totalStrategies: buckets.length,
      totalTrades,
      avgTradesPerStrategy: totalTrades / buckets.length,
      weightedT1,
      weightedT2,
      weightedFailure,
    }
  }, [scorecard])

  const handleRunScan = useCallback(async () => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'spx_settings_optimizer',
      action: 'scan_start',
    })

    try {
      await runScan()
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'spx_settings_optimizer',
        action: 'scan_success',
      })
    } catch (scanRunError) {
      trackSPXTelemetryEvent(
        SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK,
        {
          surface: 'spx_settings_optimizer',
          action: 'scan_error',
          message: summarizeError(scanRunError),
        },
        { level: 'warning' },
      )
    }
  }, [runScan])

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshSchedule(), refreshHistory()])
  }, [refresh, refreshHistory, refreshSchedule])

  const handleRevert = useCallback(async (historyId: number) => {
    const approved = window.confirm(`Revert optimizer profile using audit entry #${historyId}?`)
    if (!approved) return
    setActiveRevertId(historyId)
    try {
      await revertToHistory(historyId, `settings_manual_revert:${historyId}`)
    } finally {
      setActiveRevertId(null)
    }
  }, [revertToHistory])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      data-testid="spx-settings-sheet"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#070A0F] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.11em] text-emerald-200">SPX Command Center Settings</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/52">Optimizer automation and performance governance</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-white/15 bg-white/[0.03] px-2.5 text-[10px] uppercase tracking-[0.08em] text-white/70 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2">
          <section className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.05] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-emerald-100">
              <Settings2 className="h-3.5 w-3.5" />
              <p className="text-[10px] uppercase tracking-[0.1em]">Nightly Optimization Automation</p>
            </div>
            {(isScheduleLoading && !schedule) ? (
              <p className="text-[11px] text-white/62">Loading schedule…</p>
            ) : (
              <div className="space-y-1.5 text-[11px] text-white/80">
                <p>Status: <span className={cn('font-mono', schedule?.enabled ? 'text-emerald-200' : 'text-rose-200')}>{schedule?.enabled ? 'Enabled' : 'Disabled'}</span></p>
                <p>Worker: <span className="font-mono text-white/90">{schedule?.isRunning ? 'Running' : 'Stopped'}</span></p>
                <p>Mode: <span className="font-mono text-white/90">{schedule?.mode || '--'}</span></p>
                <p>Target Time (ET): <span className="font-mono text-white/90">{schedule?.targetTimeEt || '--'}</span></p>
                <p>Last Nightly Attempt: <span className="font-mono text-white/90">{schedule?.lastAttemptAtEt || '--'}</span></p>
                <p>Last Nightly Success: <span className="font-mono text-white/90">{schedule?.lastSuccessAtEt || '--'}</span></p>
                <p>Next Eligible Run: <span className="font-mono text-white/90">{schedule?.nextEligibleRunAtEt || '--'}</span></p>
                {schedule?.lastErrorMessage && (
                  <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
                    {schedule.lastErrorMessage}
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-white/12 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/58">Last Optimization Stats</p>
              <p className="text-[10px] font-mono text-white/50">
                {scorecard ? formatEtIso(scorecard.generatedAt) : '--'} ET
              </p>
            </div>

            {(isLoading && !scorecard) ? (
              <p className="text-[11px] text-white/62">Loading scorecard…</p>
            ) : scorecard ? (
              <div className="space-y-2 text-[11px] text-white/82">
                <p>Range: <span className="font-mono">{scorecard.scanRange.from} → {scorecard.scanRange.to}</span></p>
                <p>Applied: <span className={cn('font-mono', scorecard.optimizationApplied ? 'text-emerald-200' : 'text-champagne')}>{String(scorecard.optimizationApplied)}</span></p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T1</p>
                    <p className="font-mono">{formatPct(scorecard.optimized.t1WinRatePct)}</p>
                    <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.t1WinRateDelta))}>{formatDelta(scorecard.improvementPct.t1WinRateDelta, ' pts')}</p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T2</p>
                    <p className="font-mono">{formatPct(scorecard.optimized.t2WinRatePct)}</p>
                    <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.t2WinRateDelta))}>{formatDelta(scorecard.improvementPct.t2WinRateDelta, ' pts')}</p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Expectancy</p>
                    <p className="font-mono">{formatR(scorecard.optimized.expectancyR)}</p>
                    <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.expectancyRDelta))}>{formatDelta(scorecard.improvementPct.expectancyRDelta, 'R')}</p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Validation Trades</p>
                    <p className="font-mono">{scorecard.optimized.tradeCount}</p>
                    <p className="text-[10px] text-white/55">{scorecard.optimized.resolvedCount} resolved</p>
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Averages and Objective</p>
                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-white/72">
                    <p>Objective (base → opt)</p>
                    <p className="font-mono text-white/88">{formatObjective(scorecard.baseline.objectiveScore)} → {formatObjective(scorecard.optimized.objectiveScore)}</p>
                    <p>Conservative objective</p>
                    <p className="font-mono text-white/88">{formatObjective(scorecard.baseline.objectiveScoreConservative)} → {formatObjective(scorecard.optimized.objectiveScoreConservative)}</p>
                    <p>Positive realized rate</p>
                    <p className="font-mono text-white/88">{formatPct(scorecard.optimized.positiveRealizedRatePct)}</p>
                    {strategyAverages && (
                      <>
                        <p>Avg trades / strategy</p>
                        <p className="font-mono text-white/88">{strategyAverages.avgTradesPerStrategy.toFixed(2)}</p>
                        <p>Weighted strategy T1 / T2</p>
                        <p className="font-mono text-white/88">{formatPct(strategyAverages.weightedT1)} / {formatPct(strategyAverages.weightedT2)}</p>
                        <p>Weighted strategy failure</p>
                        <p className="font-mono text-white/88">{formatPct(strategyAverages.weightedFailure)}</p>
                      </>
                    )}
                  </div>
                </div>
                {scorecard.dataQuality && (
                  <div className="rounded border border-emerald-300/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[10px]">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-emerald-100">Execution Actuals</p>
                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-emerald-50/85">
                      <p>Fill table</p>
                      <p className="font-mono">
                        {scorecard.dataQuality.executionFillTableAvailable === true
                          ? 'available'
                          : scorecard.dataQuality.executionFillTableAvailable === false
                            ? 'missing'
                            : 'unknown'}
                      </p>
                      <p>Any fill coverage</p>
                      <p className="font-mono">{formatPct(scorecard.dataQuality.executionCoveragePct)} ({scorecard.dataQuality.executionTradesWithAnyFill ?? 0}/{scorecard.dataQuality.executionTriggeredTradeCount ?? 0})</p>
                      <p>Non-proxy coverage</p>
                      <p className="font-mono">{formatPct(scorecard.dataQuality.executionNonProxyCoveragePct)} ({scorecard.dataQuality.executionTradesWithNonProxyFill ?? 0}/{scorecard.dataQuality.executionTriggeredTradeCount ?? 0})</p>
                      <p>Entry / Exit coverage</p>
                      <p className="font-mono">{formatPct(scorecard.dataQuality.executionEntryCoveragePct)} / {formatPct(scorecard.dataQuality.executionExitCoveragePct)}</p>
                      <p>Entry slip (pts / bps)</p>
                      <p className="font-mono">{formatPoints(scorecard.dataQuality.executionEntryAvgSlippagePts, 4)} / {formatPoints(scorecard.dataQuality.executionEntryAvgSlippageBps, 2)}</p>
                      <p>Exit slip (pts / bps)</p>
                      <p className="font-mono">{formatPoints(scorecard.dataQuality.executionExitAvgSlippagePts, 4)} / {formatPoints(scorecard.dataQuality.executionExitAvgSlippageBps, 2)}</p>
                    </div>
                  </div>
                )}
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">By Strategy</p>
                      <p className="text-[9px] text-white/42">{strategyRows.length} shown</p>
                    </div>
                    {strategyRows.length === 0 ? (
                      <p className="text-[10px] text-white/50">No strategy buckets in this range.</p>
                    ) : (
                      <div className="space-y-1">
                        {strategyRows.map((bucket) => (
                          <div key={`strategy_${bucket.key}`} className="rounded border border-white/8 bg-black/30 px-1.5 py-1">
                            <div className="grid grid-cols-[1fr_auto] gap-2 text-[10px]">
                              <p className="truncate text-white/84">{formatBucketLabel(bucket.key)}</p>
                              <p className="font-mono text-white/70">{bucket.tradeCount} trades</p>
                            </div>
                            <div className="mt-0.5 grid grid-cols-3 gap-1 text-[9px] text-white/60">
                              <p>T1 <span className="font-mono text-white/78">{formatPct(bucket.t1WinRatePct)}</span></p>
                              <p>T2 <span className="font-mono text-white/78">{formatPct(bucket.t2WinRatePct)}</span></p>
                              <p>Fail <span className="font-mono text-white/78">{formatPct(bucket.failureRatePct)}</span></p>
                            </div>
                            <p className="mt-0.5 text-[9px] text-white/45">
                              95% CI T1 {formatCI(bucket.t1Confidence95)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">By Setup + Regime</p>
                      <p className="text-[9px] text-white/42">{comboRows.length} shown</p>
                    </div>
                    {comboRows.length === 0 ? (
                      <p className="text-[10px] text-white/50">No setup/regime buckets in this range.</p>
                    ) : (
                      <div className="space-y-1">
                        {comboRows.map((bucket) => (
                          <div key={`combo_${bucket.key}`} className="rounded border border-white/8 bg-black/30 px-1.5 py-1">
                            <div className="grid grid-cols-[1fr_auto] gap-2 text-[10px]">
                              <p className="truncate text-white/84">{formatBucketLabel(bucket.key)}</p>
                              <p className="font-mono text-white/70">{bucket.tradeCount} trades</p>
                            </div>
                            <div className="mt-0.5 grid grid-cols-3 gap-1 text-[9px] text-white/60">
                              <p>T1 <span className="font-mono text-white/78">{formatPct(bucket.t1WinRatePct)}</span></p>
                              <p>T2 <span className="font-mono text-white/78">{formatPct(bucket.t2WinRatePct)}</span></p>
                              <p>Fail <span className="font-mono text-white/78">{formatPct(bucket.failureRatePct)}</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-white/62">No scorecard available.</p>
            )}
          </section>
        </div>

        {(loadError || scanError || revertError) && (
          <div className="px-4 pb-2">
            <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
              {revertError || scanError || loadError}
            </p>
          </div>
        )}

        <div className="border-t border-white/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/60">Audit History</p>
            <p className="text-[10px] text-white/45">{isHistoryLoading ? 'Loading…' : `${history.length} entries`}</p>
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-white/55">No optimizer audit entries yet.</p>
          ) : (
            <div className="max-h-[220px] space-y-1.5 overflow-auto pr-1">
              {history.map((entry) => {
                const summary = entry.scorecardSummary
                const canRevert = entry.action === 'scan'
                const revertingThis = activeRevertId === entry.id
                return (
                  <div
                    key={entry.id}
                    className="grid grid-cols-[1fr_auto] gap-2 rounded border border-white/10 bg-black/25 px-2 py-1.5"
                  >
                    <div className="min-w-0 text-[10px] text-white/75">
                      <p className="font-mono text-white/88">
                        #{entry.id} · {entry.action.toUpperCase()} · {entry.mode} · {formatHistoryTime(entry.createdAt)} ET
                      </p>
                      <p className="mt-0.5 text-white/55">
                        Range {entry.scanRange.from || '--'} → {entry.scanRange.to || '--'} · Applied {String(entry.optimizationApplied)}
                      </p>
                      {summary && (
                        <p className="mt-0.5 text-white/55">
                          T1 {formatDelta(summary.t1Delta, ' pts')} · T2 {formatDelta(summary.t2Delta, ' pts')} · Exp {formatDelta(summary.expectancyDeltaR, 'R')}
                        </p>
                      )}
                      {entry.reason && <p className="mt-0.5 text-white/50">Reason: {entry.reason}</p>}
                    </div>
                    <div className="flex items-center">
                      {canRevert ? (
                        <button
                          type="button"
                          onClick={() => handleRevert(entry.id)}
                          disabled={isReverting}
                          data-testid={`spx-settings-revert-${entry.id}`}
                          className="inline-flex min-h-[30px] items-center rounded border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {(revertingThis && isReverting) ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Reverting
                            </>
                          ) : 'Revert'}
                        </button>
                      ) : (
                        <span className="text-[9px] uppercase tracking-[0.08em] text-white/35">Audit</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-[36px] items-center rounded-md border border-white/15 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-white/72 hover:text-white"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={handleRunScan}
            disabled={isScanning || isReverting}
            data-testid="spx-settings-run-optimize"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-emerald-300/35 bg-emerald-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scanning
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Run Scan & Optimize
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
