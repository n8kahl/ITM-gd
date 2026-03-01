'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface DeleteConfirmationModalProps {
  entry: {
    symbol: string
    trade_date: string
    pnl: number | null
  }
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  busy?: boolean
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${value >= 0 ? '+' : '-'}$${abs}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DeleteConfirmationModal({ entry, onConfirm, onCancel, busy = false }: DeleteConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    active: true,
    containerRef: modalRef,
    onEscape: onCancel,
  })

  useEffect(() => {
    // Auto-focus Cancel button (safe default)
    cancelButtonRef.current?.focus()
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4 animate-in fade-in-0 duration-200">
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-[var(--onyx)] p-4 animate-in zoom-in-95 duration-200"
      >
        <h3 id="delete-dialog-title" className="text-sm font-semibold text-ivory">
          Delete trade entry?
        </h3>
        <p id="delete-dialog-description" className="mt-2 text-sm text-muted-foreground">
          {entry.symbol} on {formatDate(entry.trade_date)} with P&L {formatCurrency(entry.pnl)} will be permanently
          removed.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            variant="luxury-outline"
            size="sm"
            className="h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            variant="destructive"
            size="sm"
            className="h-10 px-4"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
