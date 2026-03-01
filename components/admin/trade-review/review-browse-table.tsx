import Link from 'next/link'
import type { JournalEntry } from '@/lib/types/journal'

export interface ReviewBrowseItem extends JournalEntry {
  member_display_name: string
}

interface ReviewBrowseTableProps {
  items: ReviewBrowseItem[]
}

function formatTradeDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatPnl(value: number | null): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function coachStatusClasses(status: ReviewBrowseItem['coach_review_status']): string {
  if (status === 'pending') return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
  if (status === 'in_review') return 'border-sky-400/40 bg-sky-500/10 text-sky-200'
  if (status === 'completed') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
  return 'border-white/20 bg-white/5 text-muted-foreground'
}

export function ReviewBrowseTable({ items }: ReviewBrowseTableProps) {
  if (items.length === 0) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
        No journal entries found for current filters.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[1260px]">
        <thead className="bg-white/5">
          <tr>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Member</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Symbol</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Direction</th>
            <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">Contract</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Entry</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Exit</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">P&L</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Trade Date</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Coach Status</th>
            <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-white/10">
              <td className="px-4 py-3 text-sm text-ivory">{item.member_display_name}</td>
              <td className="px-4 py-3 text-sm font-semibold text-ivory">{item.symbol}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.direction}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{item.contract_type}</td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatPrice(item.entry_price)}</td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatPrice(item.exit_price)}</td>
              <td className={`px-4 py-3 text-right font-mono text-sm ${item.pnl != null && item.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatPnl(item.pnl)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatTradeDate(item.trade_date)}</td>
              <td className="px-4 py-3 text-right text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs ${coachStatusClasses(item.coach_review_status)}`}>
                  {item.coach_review_status ?? 'none'}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-sm">
                <Link
                  href={`/admin/trade-review/${item.id}`}
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
