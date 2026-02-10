'use client'

import { useReducer } from 'react'
import { Pencil, Star, Trash2 } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'

interface JournalCardViewProps {
  entries: JournalEntry[]
  onSelectEntry: (entry: JournalEntry) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (entryId: string) => void
  onToggleFavorite: (entry: JournalEntry, nextValue?: boolean) => void | Promise<void>
  disableActions?: boolean
}

type CardViewState = {
  favoriteUpdatingId: string | null
}

type CardViewAction =
  | { type: 'favorite-updating', entryId: string }
  | { type: 'favorite-idle' }

function reducer(state: CardViewState, action: CardViewAction): CardViewState {
  switch (action.type) {
    case 'favorite-updating':
      return { ...state, favoriteUpdatingId: action.entryId }
    case 'favorite-idle':
      return { ...state, favoriteUpdatingId: null }
    default:
      return state
  }
}

function formatDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${value >= 0 ? '+' : '-'}$${abs}`
}

export function JournalCardView({
  entries,
  onSelectEntry,
  onEditEntry,
  onDeleteEntry,
  onToggleFavorite,
  disableActions = false,
}: JournalCardViewProps) {
  const [state, dispatch] = useReducer(reducer, { favoriteUpdatingId: null })

  if (entries.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((entry) => {
        const pnl = entry.pnl ?? 0
        const pnlColor = pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-muted-foreground'

        return (
          <article
            key={entry.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <button
              type="button"
              onClick={() => onSelectEntry(entry)}
              className="w-full text-left"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-mono text-base font-semibold text-ivory">{entry.symbol}</h3>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {entry.direction}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">{formatDate(entry.trade_date)}</p>
                <p className={pnlColor}>{formatCurrency(entry.pnl)}</p>
              </div>
            </button>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => onEditEntry(entry)}
                disabled={disableActions}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-white/10 px-3 text-xs text-ivory hover:bg-white/5 disabled:opacity-60"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>

              <button
                type="button"
                onClick={async () => {
                  dispatch({ type: 'favorite-updating', entryId: entry.id })
                  await Promise.resolve(onToggleFavorite(entry, !entry.is_favorite))
                  dispatch({ type: 'favorite-idle' })
                }}
                disabled={disableActions || state.favoriteUpdatingId === entry.id}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-white/10 px-3 text-xs text-ivory hover:bg-white/5 disabled:opacity-60"
              >
                <Star className={`h-3.5 w-3.5 ${entry.is_favorite ? 'fill-amber-300 text-amber-300' : ''}`} />
                Favorite
              </button>

              <button
                type="button"
                onClick={() => onDeleteEntry(entry.id)}
                disabled={disableActions}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-red-500/40 px-3 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
