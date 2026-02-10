'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Star, Trash2, X } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface EntryDetailSheetProps {
  entry: JournalEntry | null
  onClose: () => void
  onEdit: (entry: JournalEntry) => void
  onDelete: (entryId: string) => void
  disableActions?: boolean
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${value >= 0 ? '+' : '-'}$${abs}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EntryDetailSheet({
  entry,
  onClose,
  onEdit,
  onDelete,
  disableActions = false,
}: EntryDetailSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [confirmEntryId, setConfirmEntryId] = useState<string | null>(null)
  const confirmOpen = Boolean(entry?.id && confirmEntryId === entry.id)

  useFocusTrap({
    active: Boolean(entry) && !confirmOpen,
    containerRef: panelRef,
    onEscape: onClose,
  })

  useFocusTrap({
    active: confirmOpen,
    containerRef: modalRef,
    onEscape: () => setConfirmEntryId(null),
  })

  useEffect(() => {
    if (!entry) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [entry])

  if (!entry || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[92vh] w-full max-w-2xl flex-col rounded-t-xl border border-white/10 bg-[#101315] p-4 sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ivory">{entry.symbol} Trade</h2>
            <p className="text-xs text-muted-foreground">{formatDate(entry.trade_date)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 p-2 text-muted-foreground hover:text-ivory"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <Info label="Direction" value={entry.direction.toUpperCase()} />
          <Info label="Contract" value={entry.contract_type.toUpperCase()} />
          <Info label="Entry Price" value={entry.entry_price == null ? '—' : `$${entry.entry_price}`} />
          <Info label="Exit Price" value={entry.exit_price == null ? '—' : `$${entry.exit_price}`} />
          <Info label="P&L" value={formatCurrency(entry.pnl)} />
          <Info label="P&L %" value={entry.pnl_percentage == null ? '—' : `${entry.pnl_percentage.toFixed(2)}%`} />
          <Info label="Open Position" value={entry.is_open ? 'Yes' : 'No'} />
          <Info label="Favorite" value={entry.is_favorite ? 'Yes' : 'No'} />
        </div>

        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {entry.strategy ? <TextBlock label="Strategy" value={entry.strategy} /> : null}
          {entry.setup_notes ? <TextBlock label="Setup Notes" value={entry.setup_notes} /> : null}
          {entry.execution_notes ? <TextBlock label="Execution Notes" value={entry.execution_notes} /> : null}
          {entry.lessons_learned ? <TextBlock label="Lessons Learned" value={entry.lessons_learned} /> : null}
          {entry.deviation_notes ? <TextBlock label="Deviation Notes" value={entry.deviation_notes} /> : null}

          {entry.tags.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-ivory">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {entry.ai_analysis ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-2 text-xs text-muted-foreground">AI Grade</p>
              <div className="flex items-center gap-2 text-sm text-ivory">
                <Star className="h-4 w-4 text-amber-300" />
                Grade {entry.ai_analysis.grade}
              </div>
              <p className="mt-2 text-xs text-ivory/80">{entry.ai_analysis.entry_quality}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmEntryId(entry.id)}
            disabled={disableActions}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/40 px-4 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {confirmOpen ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
            className="w-full max-w-md rounded-lg border border-white/10 bg-[#111416] p-4"
          >
            <h3 className="text-sm font-semibold text-ivory">Delete trade entry?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {entry.symbol} on {formatDate(entry.trade_date)} with P&L {formatCurrency(entry.pnl)} will be permanently removed.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmEntryId(null)}
                className="h-10 rounded-md border border-white/10 px-4 text-sm text-ivory hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(entry.id)
                  setConfirmEntryId(null)
                  onClose()
                }}
                className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}

function Info({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-ivory">{value}</p>
    </div>
  )
}

function TextBlock({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-ivory/90">{value}</p>
    </div>
  )
}
