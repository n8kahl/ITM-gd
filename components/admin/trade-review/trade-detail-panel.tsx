'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { JournalEntry } from '@/lib/types/journal'

interface TradeDetailPanelProps {
  entry: JournalEntry | null
  memberDisplayName?: string
  memberDiscordUsername?: string | null
  memberAvatarUrl?: string | null
  memberTier?: string | null
}

export function TradeDetailPanel({
  entry,
  memberDisplayName,
  memberDiscordUsername,
  memberAvatarUrl,
  memberTier,
}: TradeDetailPanelProps) {
  const [zoomOpen, setZoomOpen] = useState(false)

  if (!entry) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
        No trade selected.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy space-y-4 rounded-xl border border-white/10 p-5">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Member</p>
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/15 bg-black/30">
            {memberAvatarUrl ? (
              <Image
                src={memberAvatarUrl}
                alt={memberDisplayName ?? 'Member avatar'}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ivory/70">
                {(memberDisplayName ?? 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ivory">{memberDisplayName ?? 'Unknown Member'}</p>
            <p className="truncate text-xs text-muted-foreground">{memberDiscordUsername ?? 'No Discord username'}</p>
          </div>
          {memberTier ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
              {memberTier}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Symbol" value={entry.symbol} />
        <Metric label="Direction" value={entry.direction} />
        <Metric label="Contract" value={entry.contract_type} />
        <Metric label="Review Status" value={entry.coach_review_status ?? 'none'} />
        <Metric
          label="P&L"
          value={entry.pnl == null
            ? '—'
            : `${entry.pnl >= 0 ? '+' : '-'}$${Math.abs(entry.pnl).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
          valueClassName={entry.pnl != null ? (entry.pnl >= 0 ? 'text-emerald-300' : 'text-red-300') : undefined}
        />
        <Metric
          label="P&L %"
          value={entry.pnl_percentage == null
            ? '—'
            : `${entry.pnl_percentage >= 0 ? '+' : ''}${entry.pnl_percentage.toFixed(2)}%`}
          valueClassName={entry.pnl_percentage != null ? (entry.pnl_percentage >= 0 ? 'text-emerald-300' : 'text-red-300') : undefined}
        />
        <Metric label="Entry Price" value={entry.entry_price == null ? '—' : `$${entry.entry_price}`} />
        <Metric label="Exit Price" value={entry.exit_price == null ? '—' : `$${entry.exit_price}`} />
        <Metric label="Position Size" value={entry.position_size == null ? '—' : String(entry.position_size)} />
        <Metric label="Hold (min)" value={entry.hold_duration_min == null ? '—' : String(entry.hold_duration_min)} />
      </div>

      {(entry.contract_type === 'call' || entry.contract_type === 'put') ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Options Data</p>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Strike" value={entry.strike_price == null ? '—' : String(entry.strike_price)} />
            <Metric label="Expiration" value={entry.expiration_date ?? '—'} />
            <Metric label="DTE" value={entry.dte_at_entry == null ? '—' : String(entry.dte_at_entry)} />
            <Metric label="IV" value={entry.iv_at_entry == null ? '—' : String(entry.iv_at_entry)} />
            <Metric label="Delta" value={entry.delta_at_entry == null ? '—' : String(entry.delta_at_entry)} />
            <Metric label="Gamma" value={entry.gamma_at_entry == null ? '—' : String(entry.gamma_at_entry)} />
            <Metric label="Theta" value={entry.theta_at_entry == null ? '—' : String(entry.theta_at_entry)} />
            <Metric label="Vega" value={entry.vega_at_entry == null ? '—' : String(entry.vega_at_entry)} />
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Psychology</p>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Mood Before" value={entry.mood_before ?? '—'} />
          <Metric label="Mood After" value={entry.mood_after ?? '—'} />
          <Metric label="Discipline" value={entry.discipline_score == null ? '—' : `${entry.discipline_score}/5`} />
          <Metric label="Followed Plan" value={entry.followed_plan == null ? '—' : (entry.followed_plan ? 'Yes' : 'No')} />
          <Metric label="Rating" value={entry.rating == null ? '—' : `${entry.rating}/5`} />
        </div>
      </div>

      <details className="rounded-lg border border-white/10 bg-white/5 p-3" open>
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
          Notes
        </summary>
        <div className="mt-3 space-y-3">
          {entry.strategy ? <TextBlock label="Strategy" value={entry.strategy} /> : null}
          {entry.setup_type ? <TextBlock label="Setup Type" value={entry.setup_type} /> : null}
          {entry.setup_notes ? <TextBlock label="Setup Notes" value={entry.setup_notes} /> : null}
          {entry.execution_notes ? <TextBlock label="Execution Notes" value={entry.execution_notes} /> : null}
          {entry.lessons_learned ? <TextBlock label="Lessons Learned" value={entry.lessons_learned} /> : null}
          {entry.deviation_notes ? <TextBlock label="Deviation Notes" value={entry.deviation_notes} /> : null}
          {!entry.strategy && !entry.setup_notes && !entry.execution_notes && !entry.lessons_learned && !entry.deviation_notes ? (
            <p className="text-xs text-muted-foreground">No narrative notes on this trade.</p>
          ) : null}
        </div>
      </details>

      {entry.ai_analysis ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-xs uppercase tracking-wider text-emerald-200">Member AI Grade</p>
          <p className="mt-1 text-sm text-emerald-100">Grade {entry.ai_analysis.grade}</p>
          <p className="mt-2 text-xs text-emerald-100/80">{entry.ai_analysis.risk_management}</p>
        </div>
      ) : null}

      {entry.screenshot_url ? (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Member Screenshot</p>
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="relative h-56 w-full overflow-hidden rounded-lg border border-white/10 bg-black/30"
          >
            <Image
              src={entry.screenshot_url}
              alt={`${entry.symbol} trade screenshot`}
              fill
              className="object-contain"
              unoptimized
            />
          </button>
        </div>
      ) : null}

      {zoomOpen && entry.screenshot_url ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close screenshot zoom"
            onClick={() => setZoomOpen(false)}
          />
          <div className="relative z-10 h-[80vh] w-[92vw] max-w-5xl overflow-hidden rounded-xl border border-white/15 bg-black">
            <Image
              src={entry.screenshot_url}
              alt={`${entry.symbol} trade screenshot full size`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm text-ivory ${valueClassName ?? ''}`}>{value}</p>
    </div>
  )
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ivory/90">{value}</p>
    </div>
  )
}
