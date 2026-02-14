'use client'

import { Star, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalEntry } from '@/lib/types/journal'

function formatDate(dateStr: string): string {
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  const prefix = val >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatPercent(val: number | null): string {
  if (val == null) return '—'
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
}

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return 'border-white/15 bg-white/[0.02] text-muted-foreground'
  if (grade.startsWith('A')) return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 shadow-[0_0_14px_-8px_rgba(16,185,129,0.3)]'
  if (grade.startsWith('B')) return 'border-champagne/30 bg-champagne/5 text-champagne shadow-[0_0_14px_-8px_rgba(245,237,204,0.35)]'
  if (grade.startsWith('C')) return 'border-amber-500/30 bg-amber-500/5 text-amber-300 shadow-[0_0_14px_-8px_rgba(251,191,36,0.28)]'
  return 'border-red-500/30 bg-red-500/5 text-red-400 shadow-[0_0_14px_-8px_rgba(239,68,68,0.3)]'
}

interface JournalTableViewProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (entryId: string) => void
  disableActions?: boolean
}

export function JournalTableView({
  entries,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  disableActions = false,
}: JournalTableViewProps) {
  if (entries.length === 0) return null

  return (
    <div className="glass-card-heavy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]" aria-label="Journal trades table">
          <thead>
            <tr className="bg-white/[0.02]">
              <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Date</th>
              <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Symbol</th>
              <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Direction</th>
              <th className="text-right px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Entry</th>
              <th className="text-right px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Exit</th>
              <th className="text-right px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">P&L</th>
              <th className="text-right px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">P&L %</th>
              <th className="text-center px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Grade</th>
              <th className="text-center px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Rating</th>
              <th className="text-left px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold">Tags</th>
              <th className="text-right px-4 py-3 text-[9px] uppercase tracking-[0.15em] text-champagne/60 font-semibold w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isWinner = (entry.pnl ?? 0) > 0
              const isLoss = (entry.pnl ?? 0) < 0
              const grade = entry.ai_analysis?.grade
              const tags = Array.isArray(entry.tags) ? entry.tags : []

              return (
                <tr
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectEntry(entry)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${entry.symbol} trade details`}
                  className={cn(
                    'border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors duration-300 group',
                    'odd:bg-white/[0.005]'
                  )}
                  style={{
                    borderLeft: `2px solid ${isWinner ? 'rgba(16,185,129,0.4)' : isLoss ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                  }}
                >
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(entry.trade_date)}</td>
                  <td className="px-4 py-2.5 text-sm font-bold text-white tracking-wide">{entry.symbol}</td>
                  <td className="px-4 py-2.5">
                    {entry.direction && (
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                        entry.direction === 'long'
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 shadow-[0_0_12px_-8px_rgba(16,185,129,0.45)]'
                          : 'border-red-500/30 bg-red-500/5 text-red-400 shadow-[0_0_12px_-8px_rgba(239,68,68,0.45)]'
                      )}>
                        {entry.direction}
                      </span>
                    )}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono text-xs tabular-nums',
                    entry.entry_price == null || entry.entry_price === 0
                      ? 'text-white/20'
                      : isLoss
                        ? 'text-red-400'
                        : 'text-emerald-400'
                  )}>
                    {entry.entry_price != null ? `$${entry.entry_price.toLocaleString()}` : '—'}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono text-xs tabular-nums',
                    entry.exit_price == null || entry.exit_price === 0
                      ? 'text-white/20'
                      : isLoss
                        ? 'text-red-400'
                        : 'text-emerald-400'
                  )}>
                    {entry.exit_price != null ? `$${entry.exit_price.toLocaleString()}` : '—'}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono text-sm tabular-nums font-medium',
                    isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-white/20'
                  )}>
                    {formatCurrency(entry.pnl)}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono text-xs tabular-nums',
                    isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-white/20'
                  )}>
                    {formatPercent(entry.pnl_percentage)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {grade ? (
                      <span className={cn(
                        'inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold border',
                        gradeColor(grade)
                      )}>
                        {grade}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {entry.rating ? (
                      <div className="flex gap-0.5 justify-center">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star strokeWidth={1.5} key={i} className={cn('w-3 h-3', i < entry.rating! ? 'fill-emerald-400 text-emerald-400' : 'text-white/10')} />
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400">{tag}</span>
                      ))}
                      {tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label="Edit trade"
                        disabled={disableActions}
                        onClick={(e) => { e.stopPropagation(); onEditEntry(entry) }}
                        className="focus-champagne p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-ivory transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Pencil strokeWidth={1.5} className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete trade"
                        disabled={disableActions}
                        onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                        className="focus-champagne p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 strokeWidth={1.5} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
