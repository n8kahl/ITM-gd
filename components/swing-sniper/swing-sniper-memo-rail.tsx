'use client'

import { ArrowRight, BookmarkCheck, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton-loader'
import { cn } from '@/lib/utils'
import type {
  SwingSniperMemoPayload,
  SwingSniperMonitoringPayload,
  SwingSniperWatchlistPayload,
} from '@/lib/swing-sniper/types'

interface SwingSniperMemoRailProps {
  memo: SwingSniperMemoPayload | null
  memoLoading: boolean
  monitoring: SwingSniperMonitoringPayload | null
  savedTheses: SwingSniperWatchlistPayload['savedTheses']
  activeSymbol: string | null
  onOpenSavedTheses: () => void
  onOpenSymbol: (symbol: string) => void
}

function formatIvDrift(from: number | null, to: number | null): string | null {
  if (from == null || to == null) return null
  const drift = to - from
  return `${drift > 0 ? '+' : ''}${drift.toFixed(1)} IVr`
}

function statusTone(status: string): string {
  if (status === 'active') return 'text-emerald-100'
  if (status === 'degrading') return 'text-amber-100'
  if (status === 'invalidated') return 'text-red-100'
  return 'text-white/70'
}

export function SwingSniperMemoRail({
  memo,
  memoLoading,
  monitoring,
  savedTheses,
  activeSymbol,
  onOpenSavedTheses,
  onOpenSymbol,
}: SwingSniperMemoRailProps) {
  const nextActions = memo?.action_queue?.length
    ? memo.action_queue
    : monitoring?.alerts.slice(0, 3).map((alert) => alert.suggestedAction || alert.title) || []

  return (
    <aside className="glass-card-heavy rounded-[28px] border border-white/10 p-5 xl:sticky xl:top-24 xl:self-start">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-champagne" strokeWidth={1.5} />
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-champagne">Strategic Rail</p>
      </div>

      <div className="mt-4 space-y-4">
        {memoLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-[24px]" />
            <Skeleton className="h-28 w-full rounded-[24px]" />
            <Skeleton className="h-24 w-full rounded-[24px]" />
          </div>
        ) : null}

        {!memoLoading && memo ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            {memo.regime ? (
              <div className="rounded-full border border-champagne/35 bg-champagne/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-champagne">
                Regime: {memo.regime.label} · {memo.regime.market_posture}
              </div>
            ) : null}
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-white/75">Regime snapshot</p>
            <p className="mt-2 text-sm leading-7 text-white/85">{memo.desk_note}</p>
          </div>
        ) : null}

        {!memoLoading && memo?.themes.length ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Top themes</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              {memo.themes.slice(0, 4).map((theme) => (
                <li key={theme} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2">
                  {theme}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {nextActions.length > 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Next actions</p>
            <div className="mt-3 space-y-2">
              {nextActions.slice(0, 4).map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-[#050505] px-3 py-2 text-sm text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200/80" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-emerald-200/85" />
              <p className="text-sm font-medium text-white">Saved theses</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSavedTheses}
              className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              Manage
            </Button>
          </div>

          {savedTheses.length > 0 ? (
            <div className="mt-3 space-y-2">
              {savedTheses.slice(0, 4).map((item) => {
                const snapshot = monitoring?.savedTheses.find((candidate) => candidate.symbol === item.symbol)
                const ivDrift = formatIvDrift(snapshot?.ivRankAtSave ?? null, snapshot?.ivRankNow ?? null)
                const status = snapshot?.monitoring.status ?? 'forming'
                const isActive = activeSymbol === item.symbol

                return (
                  <button
                    key={`${item.symbol}-${item.savedAt}`}
                    type="button"
                    onClick={() => onOpenSymbol(item.symbol)}
                    className={cn(
                      'w-full rounded-2xl border bg-[#050505] px-3 py-3 text-left transition-colors',
                      isActive ? 'border-emerald-500/35' : 'border-white/10 hover:bg-white/[0.04]',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.symbol}</p>
                      <span className={cn('text-[11px] uppercase tracking-[0.14em]', statusTone(status))}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/75">{item.setupLabel}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {ivDrift ? `${ivDrift} · ` : ''}{item.catalystLabel ?? 'Monitoring only'}
                    </p>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No saved theses yet. Save a setup to track it here.</p>
          )}
        </div>

        {monitoring?.alerts.length ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-medium text-white">Monitoring alerts</p>
            <div className="mt-3 space-y-2">
              {monitoring.alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-white/10 bg-[#050505] px-3 py-2 text-sm">
                  <p className="font-medium text-white">{alert.title}</p>
                  <p className="mt-1 text-muted-foreground">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
