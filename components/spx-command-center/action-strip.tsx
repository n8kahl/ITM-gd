'use client'

import { AlertTriangle, Dot, Gauge, Sparkles } from 'lucide-react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import { cn } from '@/lib/utils'

function summarizeFlowBias(flowEvents: Array<{ direction: 'bullish' | 'bearish'; premium: number }>): {
  label: string
  tone: string
} {
  if (flowEvents.length === 0) {
    return { label: 'Flow warming up', tone: 'border-white/20 bg-white/5 text-white/70' }
  }

  const bullish = flowEvents
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0)
  const bearish = flowEvents
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0)

  const gross = bullish + bearish
  const bullishPct = gross > 0 ? Math.round((bullish / gross) * 100) : 50

  if (bullishPct >= 60) {
    return { label: `Bullish pressure ${bullishPct}%`, tone: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' }
  }
  if (bullishPct <= 40) {
    return { label: `Bearish pressure ${100 - bullishPct}%`, tone: 'border-rose-400/35 bg-rose-500/15 text-rose-200' }
  }
  return { label: `Balanced flow ${bullishPct}%`, tone: 'border-amber-400/35 bg-amber-500/12 text-amber-100' }
}

export function ActionStrip() {
  const { activeSetups, coachMessages, regime, prediction, flowEvents } = useSPXCommandCenter()

  const actionableCount = activeSetups.filter((setup) => setup.status === 'ready' || setup.status === 'triggered').length
  const flowBias = summarizeFlowBias(flowEvents.slice(0, 10))
  const topAlert = [...coachMessages]
    .sort((a, b) => {
      const rank = { alert: 0, setup: 1, guidance: 2, behavioral: 3 }
      const priorityDelta = rank[a.priority] - rank[b.priority]
      if (priorityDelta !== 0) return priorityDelta
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })
    .find((message) => message.priority === 'alert' || message.priority === 'setup') || null

  const postureDirection = prediction
    ? prediction.direction.bullish >= prediction.direction.bearish
      ? 'bullish'
      : 'bearish'
    : 'neutral'
  const postureConfidence = prediction?.confidence ?? null
  const postureLabel = `${(regime || 'unknown').toUpperCase()} ${postureDirection.toUpperCase()}${postureConfidence != null ? ` ${postureConfidence.toFixed(0)}%` : ''}`

  return (
    <section className="glass-card-heavy rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.03] via-emerald-500/[0.03] to-champagne/10 p-3 md:p-4">
      {topAlert && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-rose-400/35 bg-rose-500/12 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] text-rose-200/90">Top Coach Alert</p>
            <p className="truncate text-sm text-rose-50">{topAlert.content}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2.5 py-1 text-[11px] text-emerald-200">
          <Sparkles className="h-3 w-3" />
          {actionableCount} setups actionable
        </span>

        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] text-white/80">
          <Gauge className="h-3 w-3 text-champagne" />
          {postureLabel}
        </span>

        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]', flowBias.tone)}>
          <Dot className="h-3 w-3" />
          {flowBias.label}
        </span>

        <span className="ml-auto">
          <InfoTip label="How to use action strip" panelClassName="w-64">
            This strip is your mission briefing: actionable setup count, current market posture, and flow bias confirmation.
          </InfoTip>
        </span>
      </div>
    </section>
  )
}
