'use client'

import { useCallback } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useSPXOptimizer } from '@/hooks/use-spx-optimizer'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'

interface SPXOptimizerScorecardPanelProps {
  compact?: boolean
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(2)}%`
}

function formatObjective(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(2)
}

function formatR(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(3)
}

function formatCI(value: { lowerPct: number; upperPct: number } | null | undefined): string {
  if (!value || !Number.isFinite(value.lowerPct) || !Number.isFinite(value.upperPct)) return '--'
  return `${value.lowerPct.toFixed(1)}-${value.upperPct.toFixed(1)}%`
}

function deltaTone(value: number): string {
  if (value > 0) return 'text-emerald-200'
  if (value < 0) return 'text-rose-200'
  return 'text-white/65'
}

function formatDelta(value: number, suffix = ''): string {
  if (!Number.isFinite(value)) return '--'
  const abs = Math.abs(value).toFixed(2)
  if (value > 0) return `+${abs}${suffix}`
  if (value < 0) return `-${abs}${suffix}`
  return `0.00${suffix}`
}

function summarizeError(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Error) return value.message
  return String(value)
}

export function SPXOptimizerScorecardPanel({ compact = false }: SPXOptimizerScorecardPanelProps) {
  const {
    scorecard,
    isLoading,
    error,
    isScanning,
    scanError,
    runScan,
  } = useSPXOptimizer()

  const loadError = summarizeError(error)

  const handleScan = useCallback(async () => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'spx_optimizer_panel',
      action: 'scan_start',
    })

    try {
      await runScan()
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'spx_optimizer_panel',
        action: 'scan_success',
      })
    } catch (scanRunError) {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
        surface: 'spx_optimizer_panel',
        action: 'scan_error',
        message: summarizeError(scanRunError),
      }, { level: 'warning' })
    }
  }, [runScan])

  return (
    <section
      className={cn(
        'rounded-xl border border-emerald-400/25 bg-emerald-500/[0.04] p-3',
        compact && 'p-2.5',
      )}
      data-testid="spx-optimizer-scorecard"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.11em] text-emerald-200">Optimizer Scorecard</p>
          <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">
            {scorecard
              ? `${scorecard.scanRange.from} to ${scorecard.scanRange.to}`
              : 'Awaiting scan data'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={isScanning}
          data-testid="spx-optimizer-scan-button"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-emerald-100 transition-colors hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Scan & Optimize
            </>
          )}
        </button>
      </div>

      {isLoading && !scorecard && (
        <p className="text-[11px] text-white/62">Loading optimizer scorecard…</p>
      )}

      {loadError && (
        <p className="rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
          {loadError}
        </p>
      )}
      {scanError && (
        <p className="mt-2 rounded border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100">
          {scanError}
        </p>
      )}

      {scorecard && (
        <div className="space-y-2.5 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">Baseline T1</p>
              <p className="font-mono text-white/88">{formatPct(scorecard.baseline.t1WinRatePct)}</p>
              <p className="text-[9px] text-white/50">95% CI {formatCI(scorecard.baseline.t1Confidence95)}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">Optimized T1</p>
              <p className="font-mono text-white/88">{formatPct(scorecard.optimized.t1WinRatePct)}</p>
              <p className="text-[9px] text-white/50">95% CI {formatCI(scorecard.optimized.t1Confidence95)}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">Baseline T2</p>
              <p className="font-mono text-white/88">{formatPct(scorecard.baseline.t2WinRatePct)}</p>
              <p className="text-[9px] text-white/50">95% CI {formatCI(scorecard.baseline.t2Confidence95)}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/55">Optimized T2</p>
              <p className="font-mono text-white/88">{formatPct(scorecard.optimized.t2WinRatePct)}</p>
              <p className="text-[9px] text-white/50">95% CI {formatCI(scorecard.optimized.t2Confidence95)}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded border border-white/10 bg-black/25 px-2 py-1.5">
            <div>
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T1 Delta</p>
              <p className={cn('font-mono', deltaTone(scorecard.improvementPct.t1WinRateDelta))}>
                {formatDelta(scorecard.improvementPct.t1WinRateDelta, ' pts')}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">T2 Delta</p>
              <p className={cn('font-mono', deltaTone(scorecard.improvementPct.t2WinRateDelta))}>
                {formatDelta(scorecard.improvementPct.t2WinRateDelta, ' pts')}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Objective</p>
              <p className={cn('font-mono', deltaTone(scorecard.improvementPct.objectiveDelta))}>
                {formatDelta(scorecard.improvementPct.objectiveDelta)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Conservative</p>
              <p className={cn('font-mono', deltaTone(scorecard.improvementPct.objectiveConservativeDelta))}>
                {formatDelta(scorecard.improvementPct.objectiveConservativeDelta)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Validation Trades</p>
              <p className="font-mono text-white/82">
                {scorecard.optimized.tradeCount} ({scorecard.optimized.resolvedCount} resolved)
              </p>
            </div>
            <div className="rounded border border-white/10 bg-black/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Objective Score</p>
              <p className="font-mono text-white/82">
                {formatObjective(scorecard.baseline.objectiveScore)} → {formatObjective(scorecard.optimized.objectiveScore)}
              </p>
              <p className="font-mono text-[9px] text-white/55">
                Conservative {formatObjective(scorecard.baseline.objectiveScoreConservative)} → {formatObjective(scorecard.optimized.objectiveScoreConservative)}
              </p>
              <p className="font-mono text-[9px] text-white/55">
                Expectancy(R) {formatR(scorecard.baseline.expectancyR)} → {formatR(scorecard.optimized.expectancyR)} ({formatDelta(scorecard.improvementPct.expectancyRDelta, 'R')})
              </p>
            </div>
          </div>

          {scorecard.governance && (
            <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Promotion Governance</p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-white/75">
                <p>qualified: <span className="font-mono">{scorecard.governance.promotionQualified ? 'yes' : 'no'}</span></p>
                <p>resolved: <span className="font-mono">{scorecard.governance.observedResolvedTrades}/{scorecard.governance.requiredResolvedTrades}</span></p>
                <p>families: <span className="font-mono">{scorecard.governance.observedSetupFamilyDiversity}/{scorecard.governance.requiredSetupFamilyDiversity}</span></p>
                <p>conservative delta: <span className="font-mono">{scorecard.governance.observedConservativeObjectiveDelta.toFixed(2)}/{scorecard.governance.requiredConservativeObjectiveDelta.toFixed(2)}</span></p>
                <p>execution fills: <span className="font-mono">{scorecard.governance.observedExecutionFills}</span></p>
                <p>proxy share: <span className="font-mono">{formatPct(scorecard.governance.observedProxyFillSharePct)} / {formatPct(scorecard.governance.maxProxyFillSharePct)}</span></p>
              </div>
              {scorecard.governance.reasons.length > 0 && (
                <div className="mt-1.5 space-y-0.5 text-[9px] text-amber-100/90">
                  {scorecard.governance.reasons.slice(0, 3).map((reason, index) => (
                    <p key={`governance_reason_${index}`}>{reason}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded border border-white/10 bg-black/25 px-2 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.08em] text-white/50">Recommended Setup Actions</p>
            <div className="mt-1.5 space-y-1 text-[10px] text-white/72">
              {scorecard.setupActions.add.slice(0, 2).map((item) => (
                <p key={`add_${item}`}>ADD: {item}</p>
              ))}
              {scorecard.setupActions.update.slice(0, 2).map((item) => (
                <p key={`update_${item}`}>UPDATE: {item}</p>
              ))}
              {scorecard.setupActions.remove.slice(0, 2).map((item) => (
                <p key={`remove_${item}`}>REMOVE: {item}</p>
              ))}
              {scorecard.setupActions.add.length + scorecard.setupActions.update.length + scorecard.setupActions.remove.length === 0 && (
                <p>No setup changes recommended for the current range.</p>
              )}
            </div>
          </div>

          {scorecard.driftAlerts.length > 0 && (
            <div className="rounded border border-amber-300/35 bg-amber-500/10 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-[0.08em] text-amber-100">
                Drift Control Alerts ({scorecard.driftAlerts.length})
              </p>
              {scorecard.driftAlerts.slice(0, 2).map((alert) => (
                <p key={`${alert.setupType}_${alert.shortWindowDays}`} className="mt-1 text-[10px] text-amber-50">
                  {alert.setupType}: {alert.longT1WinRatePct.toFixed(2)}% → {alert.shortT1WinRatePct.toFixed(2)}%
                </p>
              ))}
            </div>
          )}

          {scorecard.notes.length > 0 && (
            <p className="text-[10px] text-white/58">
              {scorecard.notes[0]}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
