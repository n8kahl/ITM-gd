'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { QuickEntryForm } from '@/components/journal/quick-entry-form'
import { FullEntryForm } from '@/components/journal/full-entry-form'

interface TradeEntrySheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<JournalEntry | null>
  editEntry?: JournalEntry | null
  disabled?: boolean
}

interface EntryFormValues {
  trade_date: string
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  entry_price: string
  exit_price: string
  position_size: string
  pnl: string
  pnl_percentage: string
  is_open: boolean
  stop_loss: string
  initial_target: string
  strategy: string
  strike_price: string
  expiration_date: string
  dte_at_entry: string
  iv_at_entry: string
  delta_at_entry: string
  theta_at_entry: string
  gamma_at_entry: string
  vega_at_entry: string
  underlying_at_entry: string
  underlying_at_exit: string
  mood_before: string
  mood_after: string
  discipline_score: string
  followed_plan: '' | 'yes' | 'no'
  deviation_notes: string
  setup_notes: string
  execution_notes: string
  lessons_learned: string
  tags: string
  rating: string
}

const EMPTY_VALUES: EntryFormValues = {
  trade_date: new Date().toISOString().split('T')[0],
  symbol: '',
  direction: 'long',
  contract_type: 'stock',
  entry_price: '',
  exit_price: '',
  position_size: '',
  pnl: '',
  pnl_percentage: '',
  is_open: false,
  stop_loss: '',
  initial_target: '',
  strategy: '',
  strike_price: '',
  expiration_date: '',
  dte_at_entry: '',
  iv_at_entry: '',
  delta_at_entry: '',
  theta_at_entry: '',
  gamma_at_entry: '',
  vega_at_entry: '',
  underlying_at_entry: '',
  underlying_at_exit: '',
  mood_before: '',
  mood_after: '',
  discipline_score: '',
  followed_plan: '',
  deviation_notes: '',
  setup_notes: '',
  execution_notes: '',
  lessons_learned: '',
  tags: '',
  rating: '',
}

function toOptionalNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getInitialValues(editEntry?: JournalEntry | null): EntryFormValues {
  if (!editEntry) return { ...EMPTY_VALUES }

  return {
    trade_date: editEntry.trade_date.slice(0, 10),
    symbol: editEntry.symbol,
    direction: editEntry.direction,
    contract_type: editEntry.contract_type,
    entry_price: editEntry.entry_price?.toString() ?? '',
    exit_price: editEntry.exit_price?.toString() ?? '',
    position_size: editEntry.position_size?.toString() ?? '',
    pnl: editEntry.pnl?.toString() ?? '',
    pnl_percentage: editEntry.pnl_percentage?.toString() ?? '',
    is_open: editEntry.is_open,
    stop_loss: editEntry.stop_loss?.toString() ?? '',
    initial_target: editEntry.initial_target?.toString() ?? '',
    strategy: editEntry.strategy ?? '',
    strike_price: editEntry.strike_price?.toString() ?? '',
    expiration_date: editEntry.expiration_date ?? '',
    dte_at_entry: editEntry.dte_at_entry?.toString() ?? '',
    iv_at_entry: editEntry.iv_at_entry?.toString() ?? '',
    delta_at_entry: editEntry.delta_at_entry?.toString() ?? '',
    theta_at_entry: editEntry.theta_at_entry?.toString() ?? '',
    gamma_at_entry: editEntry.gamma_at_entry?.toString() ?? '',
    vega_at_entry: editEntry.vega_at_entry?.toString() ?? '',
    underlying_at_entry: editEntry.underlying_at_entry?.toString() ?? '',
    underlying_at_exit: editEntry.underlying_at_exit?.toString() ?? '',
    mood_before: editEntry.mood_before ?? '',
    mood_after: editEntry.mood_after ?? '',
    discipline_score: editEntry.discipline_score?.toString() ?? '',
    followed_plan: editEntry.followed_plan == null ? '' : (editEntry.followed_plan ? 'yes' : 'no'),
    deviation_notes: editEntry.deviation_notes ?? '',
    setup_notes: editEntry.setup_notes ?? '',
    execution_notes: editEntry.execution_notes ?? '',
    lessons_learned: editEntry.lessons_learned ?? '',
    tags: editEntry.tags.join(', '),
    rating: editEntry.rating?.toString() ?? '',
  }
}

export function TradeEntrySheet({
  open,
  onClose,
  onSave,
  editEntry,
  disabled = false,
}: TradeEntrySheetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<EntryFormValues>(EMPTY_VALUES)
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [saving, setSaving] = useState(false)
  const [symbolError, setSymbolError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: () => {
      if (!saving) onClose()
    },
  })

  useEffect(() => {
    if (!open) return

    setValues(getInitialValues(editEntry))
    setMode(editEntry ? 'full' : 'quick')
    setSymbolError(null)
    setSaveError(null)
  }, [editEntry, open])

  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const canSave = useMemo(() => !disabled && !saving, [disabled, saving])

  const updateValue = (key: keyof EntryFormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }))

    if (key === 'symbol' && typeof value === 'string' && value.trim().length > 0) {
      setSymbolError(null)
    }
  }

  const handleSave = async () => {
    if (!values.symbol.trim()) {
      setSymbolError('Symbol is required')
      return
    }

    setSaving(true)
    setSaveError(null)

    const payload: Record<string, unknown> = {
      symbol: values.symbol.trim().toUpperCase(),
      direction: values.direction,
      contract_type: values.contract_type,
      trade_date: new Date(`${values.trade_date}T12:00:00.000Z`).toISOString(),
      entry_price: toOptionalNumber(values.entry_price),
      exit_price: toOptionalNumber(values.exit_price),
      position_size: toOptionalNumber(values.position_size),
      pnl: toOptionalNumber(values.pnl),
      pnl_percentage: toOptionalNumber(values.pnl_percentage),
      is_open: values.is_open,
      stop_loss: toOptionalNumber(values.stop_loss),
      initial_target: toOptionalNumber(values.initial_target),
      strategy: values.strategy,
      strike_price: toOptionalNumber(values.strike_price),
      expiration_date: values.expiration_date || null,
      dte_at_entry: toOptionalNumber(values.dte_at_entry),
      iv_at_entry: toOptionalNumber(values.iv_at_entry),
      delta_at_entry: toOptionalNumber(values.delta_at_entry),
      theta_at_entry: toOptionalNumber(values.theta_at_entry),
      gamma_at_entry: toOptionalNumber(values.gamma_at_entry),
      vega_at_entry: toOptionalNumber(values.vega_at_entry),
      underlying_at_entry: toOptionalNumber(values.underlying_at_entry),
      underlying_at_exit: toOptionalNumber(values.underlying_at_exit),
      mood_before: values.mood_before || null,
      mood_after: values.mood_after || null,
      discipline_score: toOptionalNumber(values.discipline_score),
      followed_plan: values.followed_plan === '' ? null : values.followed_plan === 'yes',
      deviation_notes: values.deviation_notes,
      setup_notes: values.setup_notes,
      execution_notes: values.execution_notes,
      lessons_learned: values.lessons_learned,
      tags: values.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      rating: toOptionalNumber(values.rating),
    }

    if (editEntry) {
      payload.id = editEntry.id
    }

    try {
      const result = await onSave(payload)
      if (!result) {
        setSaveError('Save failed. Please check your inputs and try again.')
        return
      }

      onClose()
    } catch (error) {
      console.error('Trade entry save failed:', error)
      setSaveError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!saving) onClose()
        }}
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-4xl rounded-t-xl border border-white/10 bg-[#101315] p-4 sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ivory">{editEntry ? 'Edit Trade' : 'New Trade'}</h2>
            <p className="text-xs text-muted-foreground">Manual entry only. Session prefill is removed in V2.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-white/10 p-2 text-muted-foreground hover:text-ivory"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={`rounded-md px-3 py-1.5 text-xs ${mode === 'quick' ? 'bg-emerald-600 text-white' : 'border border-white/10 text-muted-foreground'}`}
          >
            Quick Form
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`rounded-md px-3 py-1.5 text-xs ${mode === 'full' ? 'bg-emerald-600 text-white' : 'border border-white/10 text-muted-foreground'}`}
          >
            Full Form
          </button>
        </div>

        {mode === 'quick' ? (
          <QuickEntryForm
            symbol={values.symbol}
            direction={values.direction}
            entryPrice={values.entry_price}
            exitPrice={values.exit_price}
            pnl={values.pnl}
            symbolError={symbolError}
            saving={saving}
            disabled={!canSave}
            onSymbolChange={(value) => updateValue('symbol', value)}
            onDirectionChange={(value) => updateValue('direction', value)}
            onEntryPriceChange={(value) => updateValue('entry_price', value)}
            onExitPriceChange={(value) => updateValue('exit_price', value)}
            onPnlChange={(value) => updateValue('pnl', value)}
            onSave={handleSave}
          />
        ) : (
          <div className="space-y-4">
            <FullEntryForm
              values={values}
              symbolError={symbolError}
              disabled={!canSave}
              onChange={updateValue}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="h-10 rounded-md border border-white/10 px-4 text-sm text-muted-foreground hover:text-ivory"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        )}

        {saveError ? (
          <p className="mt-3 text-sm text-red-400">{saveError}</p>
        ) : null}

        {disabled ? (
          <p className="mt-3 text-xs text-amber-300">You are offline. Saving is disabled.</p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
