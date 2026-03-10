'use client'

import { ShieldCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton-loader'
import type {
  SwingSniperMemoPayload,
  SwingSniperMonitoringPayload,
} from '@/lib/swing-sniper/types'

interface SwingSniperMemoRailProps {
  memo: SwingSniperMemoPayload | null
  memoLoading: boolean
  monitoring: SwingSniperMonitoringPayload | null
}

function formatIvDrift(from: number | null, to: number | null): string | null {
  if (from == null || to == null) return null
  const drift = to - from
  return `${drift > 0 ? '+' : ''}${drift.toFixed(0)} IVr`
}

export function SwingSniperMemoRail({
  memo,
  memoLoading,
  monitoring,
}: SwingSniperMemoRailProps) {
  const shouldRenderRiskSentinel = Boolean(
    monitoring
    && (monitoring.savedTheses.length > 0 || monitoring.alerts.length > 0 || monitoring.portfolio.openPositions > 0),
  )

  const shouldRenderActionQueue = Boolean(memo?.action_queue && memo.action_queue.length > 0)

  return (
    <aside className="glass-card-heavy rounded-2xl border border-white/10 p-5 xl:sticky xl:top-24 xl:self-start">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-champagne" strokeWidth={1.5} />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">Memo Rail</p>
      </div>

      <div className="mt-4 space-y-4">
        {memoLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : null}

        {!memoLoading && memo?.regime ? (
          <div className="rounded-full border border-champagne/35 bg-champagne/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-champagne">
            Regime: {memo.regime.label} · {memo.regime.market_posture}
          </div>
        ) : null}

        {!memoLoading && memo ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Swing Sniper Memo</p>
            <p className="mt-2 font-[family-name:var(--font-playfair)] text-lg text-white">Desk note for the next 7-14 trading days</p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{memo.desk_note}</p>
          </div>
        ) : null}

        {!memoLoading && memo?.themes.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Top board themes</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {memo.themes.slice(0, 4).map((theme) => (
                <li key={theme} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2">{theme}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {!memoLoading && memo ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Saved thesis queue</p>
            {memo.saved_theses.length > 0 ? (
              <div className="mt-3 space-y-2">
                {memo.saved_theses.map((item) => {
                  const monitoringSnapshot = monitoring?.savedTheses.find((snapshot) => snapshot.symbol === item.symbol)
                  const ivDrift = formatIvDrift(monitoringSnapshot?.ivRankAtSave ?? null, monitoringSnapshot?.ivRankNow ?? null)
                  return (
                    <div key={`${item.symbol}-${item.saved_at}`} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                      <p className="font-medium text-white">{item.symbol} - {item.label}</p>
                      {ivDrift ? (
                        <p className="mt-1 text-xs text-muted-foreground">{ivDrift} · {monitoringSnapshot?.monitoring.status ?? 'forming'}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No saved theses yet.</p>
            )}
          </div>
        ) : null}

        {shouldRenderRiskSentinel ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Risk Sentinel</p>
            <div className="mt-3 space-y-2">
              {monitoring?.alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                  <p className="font-medium text-white">{alert.title}</p>
                  <p className="mt-1 text-muted-foreground">{alert.message}</p>
                </div>
              ))}
              {monitoring?.alerts.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                  Thesis monitoring is active with no immediate alerts.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {shouldRenderActionQueue ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Action queue</p>
            <div className="mt-3 space-y-2">
              {memo?.action_queue?.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
