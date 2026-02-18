'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Dot, Gauge, Hexagon, Sparkles } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { cn } from '@/lib/utils'
import { buildSetupDisplayPolicy, DEFAULT_PRIMARY_SETUP_LIMIT } from '@/lib/spx/setup-display-policy'
import {
  COACH_ALERT_DISMISS_EVENT,
  acknowledgeCoachAlert,
  findTopCoachAlert,
  loadDismissedCoachAlertIds,
} from '@/lib/spx/coach-alert-state'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

function formatGexShort(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`
  return `${(value / 1_000).toFixed(0)}K`
}

function summarizeFlowBias(flowEvents: Array<{ direction: 'bullish' | 'bearish'; premium: number }>): {
  label: string
  tone: string
} {
  if (flowEvents.length === 0) {
    return { label: 'Flow warming', tone: 'border-white/15 bg-white/[0.04] text-white/60' }
  }
  const bullish = flowEvents.filter((e) => e.direction === 'bullish').reduce((s, e) => s + e.premium, 0)
  const bearish = flowEvents.filter((e) => e.direction === 'bearish').reduce((s, e) => s + e.premium, 0)
  const gross = bullish + bearish
  const pct = gross > 0 ? Math.round((bullish / gross) * 100) : 50
  if (pct >= 60) return { label: `Bullish pressure ${pct}%`, tone: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200' }
  if (pct <= 40) return { label: `Bearish pressure ${100 - pct}%`, tone: 'border-rose-400/30 bg-rose-500/10 text-rose-200' }
  return { label: `Balanced ${pct}%`, tone: 'border-amber-400/25 bg-amber-500/8 text-amber-200' }
}

export function ActionStrip() {
  const { activeSetups, coachMessages, regime, prediction, flowEvents, gexProfile, selectedSetup } = useSPXCommandCenter()
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => loadDismissedCoachAlertIds())

  useEffect(() => {
    const handleDismissSync = (event: Event) => {
      const custom = event as CustomEvent<{ ids?: string[] }>
      const ids = custom.detail?.ids
      if (!Array.isArray(ids)) return
      setDismissedAlertIds(new Set(ids))
    }

    window.addEventListener(COACH_ALERT_DISMISS_EVENT, handleDismissSync as EventListener)
    return () => {
      window.removeEventListener(COACH_ALERT_DISMISS_EVENT, handleDismissSync as EventListener)
    }
  }, [])

  const setupPolicy = useMemo(
    () => buildSetupDisplayPolicy({
      setups: activeSetups,
      regime,
      prediction,
      selectedSetup,
      primaryLimit: DEFAULT_PRIMARY_SETUP_LIMIT,
    }),
    [activeSetups, regime, prediction, selectedSetup],
  )
  const flowBias = summarizeFlowBias(flowEvents.slice(0, 10))

  const topAlert = useMemo(
    () => findTopCoachAlert(coachMessages, dismissedAlertIds),
    [coachMessages, dismissedAlertIds],
  )

  const postureDir = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish'
    : 'neutral'
  const postureConf = prediction?.confidence ?? null
  const postureLabel = `${(regime || '--').toUpperCase()} ${postureDir.toUpperCase()}${postureConf != null ? ` ${postureConf.toFixed(0)}%` : ''}`

  const gexNet = gexProfile?.combined?.netGex ?? null
  const gexLabel = gexNet != null
    ? `GEX ${gexNet >= 0 ? 'Supportive' : 'Unstable'} ${formatGexShort(gexNet)}`
    : null

  return (
    <section
      className="rounded-2xl border border-white/8 bg-gradient-to-r from-white/[0.02] via-emerald-500/[0.02] to-champagne/[0.04] px-3 py-2.5"
      data-testid="spx-action-strip"
    >
      {topAlert && (
        <div
          className="mb-2 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/8 px-3 py-2"
          data-testid="spx-action-strip-alert"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-200" />
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.1em] text-rose-200/80">Top Coach Alert</p>
            <p className="text-[13px] leading-snug text-rose-50">{topAlert.content}</p>
          </div>
          <button
            type="button"
            data-testid="spx-action-strip-alert-ack"
            onClick={() => {
              setDismissedAlertIds((previous) => acknowledgeCoachAlert(previous, topAlert.id))
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.COACH_ALERT_ACK, {
                messageId: topAlert.id,
                priority: topAlert.priority,
                setupId: topAlert.setupId,
                surface: 'action_strip',
              }, { persist: true })
            }}
            className="shrink-0 rounded border border-rose-300/30 bg-rose-400/15 px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] text-rose-100 hover:bg-rose-400/25"
          >
            Ack
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200" title="Number of trade setups currently in 'ready' or 'triggered' status">
          <Sparkles className="h-3 w-3" />
          Setups: {setupPolicy.actionableVisibleCount} actionable
          {setupPolicy.hiddenOppositeCount > 0 ? ` · ${setupPolicy.hiddenOppositeCount} hidden` : ''}
        </span>

        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] text-white/70" title="AI-predicted market posture combining regime, direction, and confidence">
          <Gauge className="h-3 w-3 text-champagne" />
          Posture: {postureLabel}
        </span>

        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', flowBias.tone)} title="Options order flow bias — comparing bullish vs bearish premium in recent transactions">
          <Dot className="h-3 w-3" />
          Flow: {flowBias.label}
        </span>

        {gexLabel && (
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
            gexNet != null && gexNet >= 0
              ? 'border-emerald-400/20 bg-emerald-500/8 text-emerald-200/80'
              : 'border-rose-400/20 bg-rose-500/8 text-rose-200/80',
          )} title="Net gamma exposure posture — Supportive means dealers dampen moves, Unstable means they amplify">
            <Hexagon className="h-3 w-3" />
            {gexLabel}
          </span>
        )}
      </div>
    </section>
  )
}
