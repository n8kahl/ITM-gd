'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { Button } from '@/components/ui/button'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { QuickEntryForm } from '@/components/journal/quick-entry-form'
import { FullEntryForm } from '@/components/journal/full-entry-form'
import { parseNumericInput } from '@/lib/journal/number-parsing'
import { deleteScreenshot } from '@/lib/uploads/supabaseStorage'

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
  screenshot_url: string
  screenshot_storage_path: string
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
  screenshot_url: '',
  screenshot_storage_path: '',
}

function toTradeDateIso(dateInput: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return `${dateInput}T00:00:00.000Z`
  }

  return new Date().toISOString()
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
    screenshot_url: editEntry.screenshot_url ?? '',
    screenshot_storage_path: editEntry.screenshot_storage_path ?? '',
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
  const initialScreenshotPathRef = useRef('')
  const transientScreenshotPathsRef = useRef<Set<string>>(new Set())
  const dragStartYRef = useRef<number | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const dragOffsetRef = useRef(0)
  const [values, setValues] = useState<EntryFormValues>(EMPTY_VALUES)
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [saving, setSaving] = useState(false)
  const [symbolError, setSymbolError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isMobileSheet, setIsMobileSheet] = useState(false)
  const [isDraggingSheet, setIsDraggingSheet] = useState(false)
  const [sheetDragOffset, setSheetDragOffset] = useState(0)

  const cleanupTransientScreenshots = useCallback(async () => {
    const pendingPaths = Array.from(transientScreenshotPathsRef.current)
    transientScreenshotPathsRef.current.clear()

    if (pendingPaths.length === 0) return

    await Promise.all(pendingPaths.map(async (path) => {
      try {
        await deleteScreenshot(path)
      } catch {
        // Best-effort cleanup; failures should not block user flow.
      }
    }))
  }, [])

  const closeWithoutSave = useCallback(() => {
    if (saving) return
    void cleanupTransientScreenshots()
    onClose()
  }, [cleanupTransientScreenshots, onClose, saving])

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: closeWithoutSave,
  })

  useEffect(() => {
    if (!open) return

    setValues(getInitialValues(editEntry))
    setMode(editEntry ? 'full' : 'quick')
    setSymbolError(null)
    setSaveError(null)
    initialScreenshotPathRef.current = editEntry?.screenshot_storage_path ?? ''
    transientScreenshotPathsRef.current = new Set()
    dragStartYRef.current = null
    dragPointerIdRef.current = null
    dragOffsetRef.current = 0
    setIsDraggingSheet(false)
    setSheetDragOffset(0)
  }, [editEntry, open])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const syncMobileState = () => setIsMobileSheet(mediaQuery.matches)

    syncMobileState()
    mediaQuery.addEventListener('change', syncMobileState)
    return () => mediaQuery.removeEventListener('change', syncMobileState)
  }, [])

  useEffect(() => {
    if (!open) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const canSave = useMemo(() => !disabled && !saving, [disabled, saving])

  const handleSheetDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileSheet || saving || event.pointerType === 'mouse') return

    dragStartYRef.current = event.clientY
    dragPointerIdRef.current = event.pointerId
    dragOffsetRef.current = 0
    setIsDraggingSheet(true)
    setSheetDragOffset(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [isMobileSheet, saving])

  const handleSheetDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet || event.pointerId !== dragPointerIdRef.current || dragStartYRef.current == null) return

    const delta = Math.max(0, event.clientY - dragStartYRef.current)
    dragOffsetRef.current = delta
    setSheetDragOffset(delta)
  }, [isDraggingSheet])

  const handleSheetDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet || event.pointerId !== dragPointerIdRef.current) return

    const shouldDismiss = dragOffsetRef.current >= 120
    dragStartYRef.current = null
    dragPointerIdRef.current = null
    dragOffsetRef.current = 0
    setIsDraggingSheet(false)
    setSheetDragOffset(0)

    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer may already be released on some mobile browsers.
    }

    if (shouldDismiss) {
      closeWithoutSave()
    }
  }, [closeWithoutSave, isDraggingSheet])

  const updateValue = (key: keyof EntryFormValues, value: string | boolean) => {
    setValues((prev) => {
      if (key === 'screenshot_storage_path' && typeof value === 'string') {
        const nextPath = value.trim()
        if (nextPath && nextPath !== initialScreenshotPathRef.current) {
          transientScreenshotPathsRef.current.add(nextPath)
        }
      }

      return { ...prev, [key]: value }
    })

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

    try {
      const parseField = (label: string, value: string): number | null => {
        const parsed = parseNumericInput(value)
        if (!parsed.valid) {
          throw new Error(`${label} must be a valid number`)
        }
        return parsed.value
      }

      const payload: Record<string, unknown> = {
        symbol: values.symbol.trim().toUpperCase(),
        direction: values.direction,
        contract_type: values.contract_type,
        trade_date: toTradeDateIso(values.trade_date),
        entry_price: parseField('Entry price', values.entry_price),
        exit_price: parseField('Exit price', values.exit_price),
        position_size: parseField('Position size', values.position_size),
        pnl: parseField('P&L', values.pnl),
        pnl_percentage: parseField('P&L %', values.pnl_percentage),
        is_open: values.is_open,
        stop_loss: parseField('Stop loss', values.stop_loss),
        initial_target: parseField('Initial target', values.initial_target),
        strategy: values.strategy,
        strike_price: parseField('Strike price', values.strike_price),
        expiration_date: values.expiration_date || null,
        dte_at_entry: parseField('DTE at entry', values.dte_at_entry),
        iv_at_entry: parseField('IV at entry', values.iv_at_entry),
        delta_at_entry: parseField('Delta at entry', values.delta_at_entry),
        theta_at_entry: parseField('Theta at entry', values.theta_at_entry),
        gamma_at_entry: parseField('Gamma at entry', values.gamma_at_entry),
        vega_at_entry: parseField('Vega at entry', values.vega_at_entry),
        underlying_at_entry: parseField('Underlying at entry', values.underlying_at_entry),
        underlying_at_exit: parseField('Underlying at exit', values.underlying_at_exit),
        mood_before: values.mood_before || null,
        mood_after: values.mood_after || null,
        discipline_score: parseField('Discipline score', values.discipline_score),
        followed_plan: values.followed_plan === '' ? null : values.followed_plan === 'yes',
        deviation_notes: values.deviation_notes,
        setup_notes: values.setup_notes,
        execution_notes: values.execution_notes,
        lessons_learned: values.lessons_learned,
        tags: values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        rating: parseField('Rating', values.rating),
        screenshot_url: values.screenshot_url || null,
        screenshot_storage_path: values.screenshot_storage_path || null,
      }

      if (editEntry) {
        payload.id = editEntry.id
      }

      const result = await onSave(payload)
      if (!result) {
        setSaveError('Save failed. Please check your inputs and try again.')
        return
      }

      const persistedScreenshotPath = typeof result.screenshot_storage_path === 'string'
        ? result.screenshot_storage_path
        : ''
      if (persistedScreenshotPath) {
        transientScreenshotPathsRef.current.delete(persistedScreenshotPath)
      }
      void cleanupTransientScreenshots()
      onClose()
    } catch (error) {
      console.error('Trade entry save failed:', error)
      setSaveError(error instanceof Error ? error.message : 'Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 animate-in fade-in-0 duration-200 sm:items-center sm:p-6">
      <div
        className="absolute inset-0"
        onClick={() => {
          closeWithoutSave()
        }}
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-white/10 bg-[var(--onyx)] animate-in slide-in-from-bottom-4 duration-300 sm:max-h-[90vh] sm:rounded-xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
        style={{
          transform: isMobileSheet ? `translateY(${sheetDragOffset}px)` : undefined,
          transition: isMobileSheet && !isDraggingSheet
            ? 'transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : undefined,
        }}
      >
        <div
          className="flex justify-center py-2 sm:hidden touch-none"
          onPointerDown={handleSheetDragStart}
          onPointerMove={handleSheetDragMove}
          onPointerUp={handleSheetDragEnd}
          onPointerCancel={handleSheetDragEnd}
        >
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/10 bg-[var(--onyx)] pb-4">
          <div>
            <h2 className="text-base font-semibold text-ivory">{editEntry ? 'Edit Trade' : 'New Trade'}</h2>
            <p className="text-xs text-muted-foreground">Manual entry only. Session prefill is removed in V2.</p>
          </div>
          <Button
            type="button"
            onClick={closeWithoutSave}
            disabled={saving}
            variant="luxury-outline"
            size="icon-sm"
            className="h-10 w-10 text-muted-foreground hover:text-ivory"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          <div className="mb-4 flex gap-2">
            <Button
              type="button"
              onClick={() => setMode('quick')}
              variant={mode === 'quick' ? 'default' : 'luxury-outline'}
              size="sm"
              className="h-10 px-3 text-xs"
            >
              Quick Form
            </Button>
            <Button
              type="button"
              onClick={() => setMode('full')}
              variant={mode === 'full' ? 'default' : 'luxury-outline'}
              size="sm"
              className="h-10 px-3 text-xs"
            >
              Full Form
            </Button>
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
            <>
              <FullEntryForm
                values={values}
                symbolError={symbolError}
                disabled={!canSave}
                onChange={updateValue}
              />
            </>
          )}
        </div>

        {mode === 'full' && (
          <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-end gap-2 border-t border-white/10 bg-[var(--onyx)] p-4">
            <Button
              type="button"
              onClick={closeWithoutSave}
              disabled={saving}
              variant="luxury-outline"
              size="sm"
              className="h-10 px-4 text-muted-foreground hover:text-ivory"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              size="sm"
              className="h-10 px-4"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
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
