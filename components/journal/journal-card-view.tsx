'use client'

import { Star, Pencil, Trash2, Image as ImageIcon, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JournalEntry } from '@/lib/types/journal'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(val: number | null): string {
  if (val == null) return '—'
  const prefix = val >= 0 ? '+$' : '-$'
  return `${prefix}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function gradeColor(grade: string | null | undefined): string {
  if (!grade) return 'bg-white/10 text-muted-foreground'
  if (grade.startsWith('A')) return 'bg-emerald-900/30 text-emerald-400'
  if (grade.startsWith('B')) return 'bg-champagne/10 text-champagne'
  if (grade.startsWith('C')) return 'bg-amber-900/30 text-amber-400'
  return 'bg-red-900/30 text-red-400'
}

interface JournalCardViewProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (entryId: string) => void
}

export function JournalCardView({ entries, onSelectEntry, onEditEntry, onDeleteEntry }: JournalCardViewProps) {
  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {entries.map((entry) => {
        const isWinner = (entry.pnl ?? 0) > 0
        const isLoss = (entry.pnl ?? 0) < 0
        const grade = entry.ai_analysis?.grade
        const hasScreenshot = !!(entry.screenshot_url || entry.screenshot_storage_path)
        const isVerified = entry.verification?.isVerified

        return (
          <div
            key={entry.id}
            onClick={() => onSelectEntry(entry)}
            className={cn(
              'glass-card rounded-xl p-4 cursor-pointer transition-all duration-200',
              'hover:-translate-y-0.5 hover:border-white/[0.14]',
              'border-t-2',
              isWinner ? 'border-t-emerald-500/50' : isLoss ? 'border-t-red-500/50' : 'border-t-transparent'
            )}
          >
            {/* Top Row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-base font-bold text-ivory">{entry.symbol}</span>
                {entry.direction && (
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                    entry.direction === 'long' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
                  )}>
                    {entry.direction}
                  </span>
                )}
              </div>
              <span className={cn(
                'font-mono text-base font-semibold tabular-nums',
                isWinner ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-muted-foreground'
              )}>
                {formatCurrency(entry.pnl)}
              </span>
            </div>

            {/* Prices + Date */}
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span className="font-mono tabular-nums">
                {entry.entry_price != null && entry.exit_price != null
                  ? `$${entry.entry_price.toLocaleString()} → $${entry.exit_price.toLocaleString()}`
                  : '—'}
              </span>
              <span>{formatDate(entry.trade_date)}</span>
            </div>

            {/* Grade + Rating + Tags */}
            <div className="flex items-center gap-2">
              {grade && (
                <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold', gradeColor(grade))}>
                  {grade}
                </span>
              )}
              {entry.rating && (
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={cn('w-3 h-3', i < entry.rating! ? 'fill-emerald-400 text-emerald-400' : 'text-white/10')} />
                  ))}
                </div>
              )}
              <div className="flex gap-1 ml-auto flex-wrap justify-end">
                {entry.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded-full bg-white/[0.05] text-muted-foreground">{tag}</span>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
              {hasScreenshot && <ImageIcon className="w-3 h-3 text-muted-foreground/50" />}
              {isVerified && (
                <span className="flex items-center gap-1 text-[9px] text-emerald-400">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditEntry(entry) }}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-ivory transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
