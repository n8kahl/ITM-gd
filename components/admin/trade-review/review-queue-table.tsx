import Link from 'next/link'
import Image from 'next/image'
import type { CoachReviewQueueItem } from '@/lib/types/coach-review'

interface ReviewQueueTableProps {
  items: CoachReviewQueueItem[]
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatTradeDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatWaitTime(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return '—'
  const deltaMs = Date.now() - parsed
  const hours = Math.max(0, Math.floor(deltaMs / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function statusClasses(status: CoachReviewQueueItem['status']): string {
  if (status === 'pending') return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
  if (status === 'in_review') return 'border-sky-400/40 bg-sky-500/10 text-sky-200'
  if (status === 'completed') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  return 'border-white/20 bg-white/5 text-muted-foreground'
}

export function ReviewQueueTable({ items }: ReviewQueueTableProps) {
  if (items.length === 0) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
        No flagged trades in the current queue.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[1160px]">
        <thead className="bg-white/5">
          <tr>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Member</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Symbol</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Direction</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">P&L</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Trade Date</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Waiting</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Priority</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-white/10">
              <td className="px-4 py-3 text-sm text-ivory">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/15 bg-black/30">
                    {item.member_avatar_url ? (
                      <Image
                        src={item.member_avatar_url}
                        alt={item.member_display_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-ivory/70">
                        {item.member_display_name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-ivory">{item.member_display_name}</p>
                    <p className="text-xs text-muted-foreground">{item.member_discord_username ?? '—'}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-ivory">{item.symbol}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.direction}</td>
              <td className={`px-4 py-3 text-right font-mono text-sm ${item.pnl != null && item.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatCurrency(item.pnl)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatTradeDate(item.trade_date)}</td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatWaitTime(item.requested_at)}</td>
              <td className="px-4 py-3 text-right text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs ${item.priority === 'urgent' ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-white/20 bg-white/5 text-muted-foreground'}`}>
                  {item.priority}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClasses(item.status)}`}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <Link
                  href={`/admin/trade-review/${item.journal_entry_id}`}
                  className="text-emerald-300 transition-colors hover:text-emerald-200"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
