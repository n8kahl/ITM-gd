'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Gauge } from 'lucide-react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { cn } from '@/lib/utils'
import {
  COACH_ALERT_DISMISS_EVENT,
  acknowledgeCoachAlert,
  findTopCoachAlert,
  loadDismissedCoachAlertIds,
} from '@/lib/spx/coach-alert-state'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

export function ActionStrip() {
  const { regime, prediction } = useSPXAnalyticsContext()
  const { selectedSetup, tradeMode, inTradeSetup, tradePnlPoints } = useSPXSetupContext()
  const { coachMessages } = useSPXCoachContext()
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

  const topAlert = useMemo(
    () => findTopCoachAlert(coachMessages, dismissedAlertIds),
    [coachMessages, dismissedAlertIds],
  )

  const postureDir = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish'
    : 'neutral'
  const postureConf = prediction?.confidence ?? null
  const postureLabel = `${(regime || '--').toUpperCase()} ${postureDir.toUpperCase()}${postureConf != null ? ` ${postureConf.toFixed(0)}%` : ''}`

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
        {tradeMode === 'in_trade' && inTradeSetup && (
          <span className="inline-flex items-center gap-1 rounded-full border border-champagne/35 bg-champagne/12 px-2 py-0.5 text-[10px] text-champagne">
            In Trade: {inTradeSetup.direction.toUpperCase()}
            {tradePnlPoints != null ? ` · ${tradePnlPoints >= 0 ? '+' : ''}${tradePnlPoints.toFixed(2)} pts` : ''}
          </span>
        )}

        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] text-white/70" title="AI-predicted market posture combining regime, direction, and confidence">
          <Gauge className="h-3 w-3 text-champagne" />
          Posture: {postureLabel}
        </span>

        {prediction ? (
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2 py-0.5 text-emerald-100">
              Bull {prediction.direction.bullish.toFixed(0)}%
            </span>
            <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2 py-0.5 text-rose-100">
              Bear {prediction.direction.bearish.toFixed(0)}%
            </span>
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-white/75">
              Flat {prediction.direction.neutral.toFixed(0)}%
            </span>
          </div>
        ) : (
          <span className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/60">
            Direction warming up
          </span>
        )}

        {selectedSetup && tradeMode !== 'in_trade' && (
          <span className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em]',
            selectedSetup.status === 'triggered'
              ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
              : selectedSetup.status === 'ready'
                ? 'border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-100'
                : 'border-amber-300/25 bg-amber-500/[0.08] text-amber-100',
          )}>
            Selected {selectedSetup.direction} {selectedSetup.regime} ({selectedSetup.status})
          </span>
        )}
      </div>
    </section>
  )
}
