'use client'

import { Star, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalEntry } from '@/lib/types/journal'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  if (!grade) return 'bg-white/10 text-muted-foreground'
  if (grade.startsWith('A')) return 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30'
  if (grade.startsWith('B')) return 'bg-champagne/10 text-champagne border-champagne/20'
  if (grade.startsWith('C')) return 'bg-amber-900/30 text-amber-400 border-amber-800/30'
  return 'bg-red-900/30 text-red-400 border-red-800/30'
}

interface JournalTableViewProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (entryId: string) => void
}

export function JournalTableView({ entries, onSelectEntry, onEditEntry, onDeleteEntry }: JournalTableViewProps) {
  if (entries.length === 0) return null

  return (
    <div className="glass-card-heavy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]" aria-label="Journal trades table">
          <thead>
            <tr className="bg-white/[0.04]">
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Date</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Symbol</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Direction</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entry</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Exit</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">P&L</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">P&L %</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Grade</th>
              <th className="text-center px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Rating</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tags</th>
              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isWinner = (entry.pnl ?? 0) > 0
              const isLoss = (entry.pnl ?? 0) < 0
              const grade = entry.ai_analysis?.grade

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
                    'border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors group',
                    'odd:bg-white/[0.005]'
                  )}
                  style={{
                    borderLeft: `2px solid ${isWinner ? 'rgba(16,185,129,0.4)' : isLoss ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                  }}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(entry.trade_date)}</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-ivory">{entry.symbol}</td>
                  <td className="px-4 py-3">
                    {entry.direction && (
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                        entry.direction === 'long'
                          ? 'bg-emerald-900/30 text-emerald-400'
                          : 'bg-red-900/30 text-red-400'
                      )}>
                        {entry.direction}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {entry.entry_price != null ? `$${entry.entry_price.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {entry.exit_price != null ? `$${entry.exit_price.toLocaleString()}` : '—'}
                  </td>
                  <td className={cn(
                    'px-4 py-3 text-right font-mono text-sm tabular-nums font-medium',
                    isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {formatCurrency(entry.pnl)}
                  </td>
                  <td className={cn(
                    'px-4 py-3 text-right font-mono text-xs tabular-nums',
                    isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {formatPercent(entry.pnl_percentage)}
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  <td className="px-4 py-3 text-center">
                    {entry.rating ? (
                      <div className="flex gap-0.5 justify-center">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} className={cn('w-3 h-3', i < entry.rating! ? 'fill-emerald-400 text-emerald-400' : 'text-white/10')} />
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {entry.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded-full bg-white/[0.05] text-muted-foreground">{tag}</span>
                      ))}
                      {entry.tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{entry.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label="Edit trade"
                        onClick={(e) => { e.stopPropagation(); onEditEntry(entry) }}
                        className="focus-champagne p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-ivory transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete trade"
                        onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                        className="focus-champagne p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
