'use client'

import { useCallback, useMemo, useState } from 'react'
import { Loader2, Settings2, Sparkles, X } from 'lucide-react'
import { useSPXOptimizer } from '@/hooks/use-spx-optimizer'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'
import { BrokerTab } from './broker-tab'

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
  const [activeTab, setActiveTab] = useState<'optimizer' | 'broker'>('optimizer')
  const [activeRevertId, setActiveRevertId] = useState<number | null>(null)
  const {
    scorecard,
    schedule,
    history,
    ytdBacktest,
    ytdFromEt,
    isLoading,
    isScheduleLoading,
    isHistoryLoading,
    isBacktestLoading,
    error,
    scheduleError,
    historyError,
    backtestError,
    isScanning,
    scanError,
    isReverting,
    revertError,
    runScan,
    revertToHistory,
    refresh,
    refreshSchedule,
    refreshHistory,
    refreshBacktest,
  } = useSPXOptimizer()

  const loadError = useMemo(
    () => summarizeError(error) || summarizeError(scheduleError) || summarizeError(historyError) || summarizeError(backtestError),
    [error, scheduleError, historyError, backtestError],
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
      .slice(0, 6)
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
      weightedT1,
      weightedT2,
      weightedFailure,
    }
  }, [scorecard])

  const blockerRows = useMemo(() => {
    if (!scorecard?.blockerMix?.bySetupRegimeTimeBucket) return []
    return [...scorecard.blockerMix.bySetupRegimeTimeBucket]
      .filter((bucket) => Number.isFinite(bucket.totalOpportunityCount) && bucket.totalOpportunityCount > 0)
      .sort((a, b) => {
        if (b.blockedPct !== a.blockedPct) return b.blockedPct - a.blockedPct
        return b.totalOpportunityCount - a.totalOpportunityCount
      })
      .slice(0, 6)
  }, [scorecard])

  const setupActionCounts = useMemo(() => ({
    add: scorecard?.setupActions.add.length ?? 0,
    update: scorecard?.setupActions.update.length ?? 0,
    remove: scorecard?.setupActions.remove.length ?? 0,
  }), [scorecard])

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
    await Promise.all([refresh(), refreshSchedule(), refreshHistory(), refreshBacktest()])
  }, [refresh, refreshBacktest, refreshHistory, refreshSchedule])

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
        className="relative w-full max-w-[1240px] overflow-hidden rounded-2xl border border-white/15 bg-[#070A0F] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-4 py-3.5">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.11em] text-emerald-200">SPX Command Center Settings</p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/52">Optimizer automation and performance governance</p>
            <div className="flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-[0.08em]">
              <span className={cn(
                'rounded border px-1.5 py-0.5',
                scorecard?.optimizationApplied ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100' : 'border-champagne/35 bg-champagne/10 text-champagne',
              )}
              >
                Applied: {scorecard ? String(scorecard.optimizationApplied) : '--'}
              </span>
              <span className={cn(
                'rounded border px-1.5 py-0.5',
                schedule?.enabled ? 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100' : 'border-rose-300/40 bg-rose-500/10 text-rose-100',
              )}
              >
                Nightly: {schedule?.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className="rounded border border-white/18 bg-white/[0.03] px-1.5 py-0.5 text-white/70">
                Updated: {scorecard ? `${formatEtIso(scorecard.generatedAt)} ET` : '--'}
              </span>
            </div>
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

        <div className="flex items-center gap-1 border-b border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('optimizer')}
            data-testid="spx-settings-tab-optimizer"
            className={cn(
              'rounded-md px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-colors',
              activeTab === 'optimizer'
                ? 'border border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                : 'border border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80',
            )}
          >
            Optimizer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('broker')}
            data-testid="spx-settings-tab-broker"
            className={cn(
              'rounded-md px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] transition-colors',
              activeTab === 'broker'
                ? 'border border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
                : 'border border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80',
            )}
          >
            Broker
          </button>
        </div>

        {activeTab === 'optimizer' && (<>
        {(loadError || scanError || revertError) && (
          <div className="px-4 pb-2 pt-2">
            <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
              {revertError || scanError || loadError}
            </p>
          </div>
        )}

        <div className="grid gap-3 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
            <section className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.05] p-3">
              <div className="mb-2 flex items-center gap-1.5 text-emerald-100">
                <Settings2 className="h-3.5 w-3.5" />
                <p className="text-[10px] uppercase tracking-[0.1em]">Nightly Optimization Automation</p>
              </div>
              {(isScheduleLoading && !schedule) ? (
                <p className="text-[11px] text-white/62">Loading schedule…</p>
              ) : (
                <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[10px] text-white/78">
                  <p>Status</p>
                  <p className={cn('font-mono', schedule?.enabled ? 'text-emerald-200' : 'text-rose-200')}>{schedule?.enabled ? 'Enabled' : 'Disabled'}</p>
                  <p>Worker</p>
                  <p className="font-mono text-white/92">{schedule?.isRunning ? 'Running' : 'Stopped'}</p>
                  <p>Mode</p>
                  <p className="font-mono text-white/92">{schedule?.mode || '--'}</p>
                  <p>Target (ET)</p>
                  <p className="font-mono text-white/92">{schedule?.targetTimeEt || '--'}</p>
                  <p>Next run</p>
                  <p className="font-mono text-white/92">{schedule?.nextEligibleRunAtEt || '--'}</p>
                  <p>Last attempt</p>
                  <p className="font-mono text-white/92">{schedule?.lastAttemptAtEt || '--'}</p>
                  <p>Last success</p>
                  <p className="font-mono text-white/92">{schedule?.lastSuccessAtEt || '--'}</p>
                </div>
              )}
              {schedule?.lastErrorMessage && (
                <p className="mt-2 rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
                  {schedule.lastErrorMessage}
                </p>
              )}
            </section>

            <section className="rounded-xl border border-white/12 bg-black/30 p-3 text-[10px] text-white/78">
              <p className="mb-1 text-[10px] uppercase tracking-[0.1em] text-white/58">Scope and Governance</p>
              {scorecard ? (
                <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                  <p>Scan range</p>
                  <p className="font-mono text-white/92">{scorecard.scanRange.from} → {scorecard.scanRange.to}</p>
                  <p>Training range</p>
                  <p className="font-mono text-white/92">{scorecard.trainingRange.from} → {scorecard.trainingRange.to}</p>
                  <p>Validation range</p>
                  <p className="font-mono text-white/92">{scorecard.validationRange.from} → {scorecard.validationRange.to}</p>
                  <p>Action set</p>
                  <p className="font-mono text-white/92">+{setupActionCounts.add} / ~{setupActionCounts.update} / -{setupActionCounts.remove}</p>
                  <p>Trigger guardrail</p>
                  <p className={cn('font-mono', scorecard.blockerMix?.triggerRateGuardrailPassed ? 'text-emerald-200' : 'text-rose-200')}>
                    {scorecard.blockerMix?.triggerRateGuardrailPassed ? 'pass' : 'fail'}
                  </p>
                </div>
              ) : (
                <p className="text-white/60">No scorecard available.</p>
              )}
            </section>
          </aside>

          <main className="max-h-[calc(100vh-260px)] space-y-3 overflow-y-auto pr-1">
            <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/[0.06] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.1em] text-cyan-100">Current YTD Accuracy (Live Backtest)</p>
                <p className="text-[10px] font-mono text-cyan-100/80">
                  {ytdBacktest ? `${ytdBacktest.dateRange.from} → ${ytdBacktest.dateRange.to}` : `${ytdFromEt} → --`}
                </p>
              </div>
              {(isBacktestLoading && !ytdBacktest) ? (
                <p className="text-[11px] text-cyan-50/85">Loading YTD backtest…</p>
              ) : ytdBacktest ? (
                <div className="space-y-2 text-[11px] text-cyan-50/90">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-cyan-100/65">T1 Win Rate</p>
                      <p className="font-mono">{formatPct(ytdBacktest.analytics.t1WinRatePct)}</p>
                    </div>
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-cyan-100/65">T2 Win Rate</p>
                      <p className="font-mono">{formatPct(ytdBacktest.analytics.t2WinRatePct)}</p>
                    </div>
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-cyan-100/65">Expectancy</p>
                      <p className="font-mono">{formatR(ytdBacktest.profitability.expectancyR)}</p>
                    </div>
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-cyan-100/65">Triggered / Resolved</p>
                      <p className="font-mono">{ytdBacktest.analytics.triggeredCount} / {ytdBacktest.analytics.resolvedCount}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 xl:grid-cols-2">
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5 text-[10px]">
                      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
                        <p>Failure rate</p>
                        <p className="font-mono">{formatPct(ytdBacktest.analytics.failureRatePct)}</p>
                        <p>Cumulative realized</p>
                        <p className="font-mono">{formatR(ytdBacktest.profitability.cumulativeRealizedR)}</p>
                        <p>Positive realized rate</p>
                        <p className="font-mono">{formatPct(ytdBacktest.profitability.positiveRealizedRatePct)}</p>
                      </div>
                    </div>
                    <div className="rounded border border-cyan-200/20 bg-black/25 px-2 py-1.5 text-[10px]">
                      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5">
                        <p>Source</p>
                        <p className="font-mono">{ytdBacktest.sourceUsed}</p>
                        <p>Resolution</p>
                        <p className="font-mono">{ytdBacktest.resolutionUsed}</p>
                        <p>Setups evaluated</p>
                        <p className="font-mono">{ytdBacktest.evaluatedSetupCount} / {ytdBacktest.setupCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-cyan-50/80">YTD backtest not available yet.</p>
              )}
            </section>

            <section className="rounded-xl border border-white/12 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/58">Last Optimization Snapshot</p>
                <p className="text-[10px] font-mono text-white/50">
                  {scorecard ? `${formatEtIso(scorecard.generatedAt)} ET` : '--'}
                </p>
              </div>
              {(isLoading && !scorecard) ? (
                <p className="text-[11px] text-white/62">Loading scorecard…</p>
              ) : scorecard ? (
                <div className="space-y-2 text-[11px] text-white/82">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T1 Win Rate</p>
                      <p className="font-mono">{formatPct(scorecard.optimized.t1WinRatePct)}</p>
                      <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.t1WinRateDelta))}>{formatDelta(scorecard.improvementPct.t1WinRateDelta, ' pts')}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T2 Win Rate</p>
                      <p className="font-mono">{formatPct(scorecard.optimized.t2WinRatePct)}</p>
                      <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.t2WinRateDelta))}>{formatDelta(scorecard.improvementPct.t2WinRateDelta, ' pts')}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Expectancy</p>
                      <p className="font-mono">{formatR(scorecard.optimized.expectancyR)}</p>
                      <p className={cn('font-mono text-[10px]', statTone(scorecard.improvementPct.expectancyRDelta))}>{formatDelta(scorecard.improvementPct.expectancyRDelta, 'R')}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Validation Trades</p>
                      <p className="font-mono">{scorecard.optimized.tradeCount}</p>
                      <p className="text-[10px] text-white/55">{scorecard.optimized.resolvedCount} resolved</p>
                    </div>
                  </div>

                  <div className="grid gap-2 xl:grid-cols-2">
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Objective and Confidence</p>
                      <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-white/72">
                        <p>Objective (base → opt)</p>
                        <p className="font-mono text-white/88">{formatObjective(scorecard.baseline.objectiveScore)} → {formatObjective(scorecard.optimized.objectiveScore)}</p>
                        <p>Conservative objective</p>
                        <p className="font-mono text-white/88">{formatObjective(scorecard.baseline.objectiveScoreConservative)} → {formatObjective(scorecard.optimized.objectiveScoreConservative)}</p>
                        <p>95% CI T1 (opt)</p>
                        <p className="font-mono text-white/88">{formatCI(scorecard.optimized.t1Confidence95)}</p>
                        <p>95% CI T2 (opt)</p>
                        <p className="font-mono text-white/88">{formatCI(scorecard.optimized.t2Confidence95)}</p>
                        <p>Positive realized rate</p>
                        <p className="font-mono text-white/88">{formatPct(scorecard.optimized.positiveRealizedRatePct)}</p>
                        {strategyAverages && (
                          <>
                            <p>Weighted strategy T1 / T2 / Fail</p>
                            <p className="font-mono text-white/88">
                              {formatPct(strategyAverages.weightedT1)} / {formatPct(strategyAverages.weightedT2)} / {formatPct(strategyAverages.weightedFailure)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {scorecard.blockerMix && (
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Blocker Mix</p>
                      <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-white/72">
                        <p>Total opportunities</p>
                        <p className="font-mono text-white/88">{scorecard.blockerMix.totalOpportunityCount}</p>
                        <p>Macro blocked</p>
                        <p className="font-mono text-white/88">{formatPct(scorecard.blockerMix.macroBlockedPct)} ({scorecard.blockerMix.macroBlockedCount})</p>
                        <p>Micro blocked</p>
                        <p className="font-mono text-white/88">{formatPct(scorecard.blockerMix.microBlockedPct)} ({scorecard.blockerMix.microBlockedCount})</p>
                        <p>Trigger rate (base → opt)</p>
                        <p className="font-mono text-white/88">{formatPct(scorecard.blockerMix.baselineTriggerRatePct)} → {formatPct(scorecard.blockerMix.optimizedTriggerRatePct)}</p>
                        <p>Trigger delta</p>
                        <p className={cn('font-mono', statTone(scorecard.blockerMix.triggerRateDeltaPct))}>{formatDelta(scorecard.blockerMix.triggerRateDeltaPct, ' pts')}</p>
                      </div>
                    </div>
                    )}
                  </div>

                  <div className="grid gap-2 xl:grid-cols-2">
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">By Strategy</p>
                        <p className="text-[9px] text-white/42">{strategyRows.length} shown</p>
                      </div>
                      {strategyRows.length === 0 ? (
                        <p className="text-[10px] text-white/50">No strategy buckets in this range.</p>
                      ) : (
                        <div className="max-h-[170px] space-y-1 overflow-y-auto pr-0.5">
                          {strategyRows.map((bucket) => (
                            <div key={`strategy_${bucket.key}`} className="rounded border border-white/8 bg-black/30 px-1.5 py-1">
                              <div className="grid grid-cols-[1fr_auto] gap-2 text-[10px]">
                                <p className="truncate text-white/84">{formatBucketLabel(bucket.key)}</p>
                                <p className="font-mono text-white/70">{bucket.tradeCount}</p>
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
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">By Setup + Regime</p>
                        <p className="text-[9px] text-white/42">{comboRows.length} shown</p>
                      </div>
                      {comboRows.length === 0 ? (
                        <p className="text-[10px] text-white/50">No setup/regime buckets in this range.</p>
                      ) : (
                        <div className="max-h-[170px] space-y-1 overflow-y-auto pr-0.5">
                          {comboRows.map((bucket) => (
                            <div key={`combo_${bucket.key}`} className="rounded border border-white/8 bg-black/30 px-1.5 py-1">
                              <div className="grid grid-cols-[1fr_auto] gap-2 text-[10px]">
                                <p className="truncate text-white/84">{formatBucketLabel(bucket.key)}</p>
                                <p className="font-mono text-white/70">{bucket.tradeCount}</p>
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

                  <div className="grid gap-2 xl:grid-cols-2">
                    <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Highest Blocked Buckets</p>
                      {blockerRows.length === 0 ? (
                        <p className="mt-1 text-white/55">No blocker buckets available.</p>
                      ) : (
                        <div className="mt-1 max-h-[130px] space-y-1 overflow-y-auto pr-0.5">
                          {blockerRows.map((bucket) => (
                            <div key={`blocker_${bucket.key}`} className="rounded border border-white/8 bg-black/30 px-1.5 py-1 text-[9px]">
                              <div className="grid grid-cols-[1fr_auto] gap-2">
                                <p className="truncate text-white/84">{formatBucketLabel(bucket.key)}</p>
                                <p className="font-mono text-white/70">{bucket.totalOpportunityCount}</p>
                              </div>
                              <p className="mt-0.5 text-white/55">
                                Blocked {formatPct(bucket.blockedPct)} · Macro {formatPct(bucket.macroBlockedPct)} · Micro {formatPct(bucket.microBlockedPct)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {scorecard.dataQuality && (
                      <div className="rounded border border-emerald-300/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[10px]">
                        <p className="text-[9px] uppercase tracking-[0.08em] text-emerald-100">Execution and Data Quality</p>
                        <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-emerald-50/85">
                          <p>Source / Resolution</p>
                          <p className="font-mono">{scorecard.dataQuality.sourceUsed} / {scorecard.dataQuality.resolutionUsed}</p>
                          <p>Fail-closed gate</p>
                          <p className="font-mono">{scorecard.dataQuality.gatePassed ? 'pass' : 'fail'}</p>
                          <p>Options coverage</p>
                          <p className="font-mono">{formatPct(scorecard.dataQuality.optionsReplayCoveragePct ?? 0)}</p>
                          <p>Any fill coverage</p>
                          <p className="font-mono">{formatPct(scorecard.dataQuality.executionCoveragePct)}</p>
                          <p>Non-proxy fill coverage</p>
                          <p className="font-mono">{formatPct(scorecard.dataQuality.executionNonProxyCoveragePct)}</p>
                          <p>Proxy share (filled)</p>
                          <p className="font-mono">{formatPct(scorecard.dataQuality.executionProxyShareOfFilledPct)}</p>
                          <p>Broker Tradier share (filled)</p>
                          <p className="font-mono">{formatPct(scorecard.dataQuality.executionBrokerTradierShareOfFilledPct)}</p>
                          <p>Entry slip (pts / bps)</p>
                          <p className="font-mono">{formatPoints(scorecard.dataQuality.executionEntryAvgSlippagePts, 4)} / {formatPoints(scorecard.dataQuality.executionEntryAvgSlippageBps, 2)}</p>
                        </div>
                        {(scorecard.dataQuality.warnings || []).length > 0 && (
                          <div className="mt-1 space-y-0.5 border-t border-emerald-200/15 pt-1 text-[9px] text-amber-100/90">
                            {(scorecard.dataQuality.warnings || []).slice(0, 4).map((warning, index) => (
                              <p key={`quality_warning_${index}`}>{warning}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {scorecard.governance && (
                    <div className="rounded border border-amber-300/25 bg-amber-500/[0.08] px-2 py-1.5 text-[10px]">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-amber-100">Promotion Governance</p>
                      <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-amber-50/90">
                        <p>Qualified</p>
                        <p className="font-mono">{scorecard.governance.promotionQualified ? 'yes' : 'no'}</p>
                        <p>Resolved trades</p>
                        <p className="font-mono">{scorecard.governance.observedResolvedTrades} / {scorecard.governance.requiredResolvedTrades}</p>
                        <p>Setup-family diversity</p>
                        <p className="font-mono">{scorecard.governance.observedSetupFamilyDiversity} / {scorecard.governance.requiredSetupFamilyDiversity}</p>
                        <p>Conservative objective delta</p>
                        <p className="font-mono">{scorecard.governance.observedConservativeObjectiveDelta.toFixed(2)} / {scorecard.governance.requiredConservativeObjectiveDelta.toFixed(2)}</p>
                        <p>Execution fills observed</p>
                        <p className="font-mono">{scorecard.governance.observedExecutionFills}</p>
                        <p>Proxy share cap</p>
                        <p className="font-mono">{formatPct(scorecard.governance.observedProxyFillSharePct)} / {formatPct(scorecard.governance.maxProxyFillSharePct)}</p>
                      </div>
                      {scorecard.governance.reasons.length > 0 && (
                        <div className="mt-1 space-y-0.5 border-t border-amber-200/20 pt-1 text-[9px] text-amber-100/90">
                          {scorecard.governance.reasons.slice(0, 4).map((reason, index) => (
                            <p key={`governance_reason_${index}`}>{reason}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5 text-[10px]">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Optimizer Notes</p>
                    <div className="mt-1 max-h-[120px] space-y-0.5 overflow-y-auto pr-0.5 text-white/64">
                      {scorecard.notes.length > 0 ? (
                        scorecard.notes.slice(0, 16).map((note, index) => (
                          <p key={`note_${index}`} className="leading-snug">{note}</p>
                        ))
                      ) : (
                        <p>No notes.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-white/62">No scorecard available.</p>
              )}
            </section>

            <section className="rounded-xl border border-white/12 bg-black/30 p-3">
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
            </section>
          </main>
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
        </>)}

        {activeTab === 'broker' && <BrokerTab />}
      </div>
    </div>
  )
}
