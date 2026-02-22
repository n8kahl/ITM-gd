'use client'

import { useCallback, useMemo } from 'react'
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

export function SPXSettingsSheet({ open, onOpenChange }: SPXSettingsSheetProps) {
  const {
    scorecard,
    schedule,
    isLoading,
    isScheduleLoading,
    error,
    scheduleError,
    isScanning,
    scanError,
    runScan,
    refresh,
    refreshSchedule,
  } = useSPXOptimizer()

  const loadError = useMemo(() => summarizeError(error) || summarizeError(scheduleError), [error, scheduleError])

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
    await Promise.all([refresh(), refreshSchedule()])
  }, [refresh, refreshSchedule])

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
              </div>
            ) : (
              <p className="text-[11px] text-white/62">No scorecard available.</p>
            )}
          </section>
        </div>

        {(loadError || scanError) && (
          <div className="px-4 pb-2">
            <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
              {scanError || loadError}
            </p>
          </div>
        )}

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
            disabled={isScanning}
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
