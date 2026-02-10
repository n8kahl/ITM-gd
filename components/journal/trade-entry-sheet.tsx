'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Loader2, Bot, CheckCircle, AlertTriangle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { uploadScreenshot, type UploadProgress } from '@/lib/uploads/supabaseStorage'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import type { JournalEntry, AITradeAnalysis } from '@/lib/types/journal'
import type { JournalPrefillPayload } from '@/lib/journal/ai-coach-bridge'
import { QuickEntryForm } from '@/components/journal/quick-entry-form'
import { FullEntryForm } from '@/components/journal/full-entry-form'
import type { AIFieldKey, AIFieldStatus, TradeEntryFormData } from '@/components/journal/trade-entry-types'
import { createAppError, notifyAppError, type AppError } from '@/lib/error-handler'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { useIsMobile } from '@/hooks/use-is-mobile'

const QUICK_TAGS = [
  'Breakout',
  'Reversal',
  'Support',
  'Resistance',
  'Momentum',
  'Scalp',
  'Swing',
  'VWAP Play',
  'PDH Break',
  'Opening Range',
]

const EMPTY_FORM: TradeEntryFormData = {
  trade_date: new Date().toISOString().split('T')[0],
  symbol: '',
  direction: 'long',
  contract_type: 'stock',
  strike_price: '',
  expiration_date: '',
  dte_at_entry: '',
  dte_at_exit: '',
  iv_at_entry: '',
  iv_at_exit: '',
  delta_at_entry: '',
  theta_at_entry: '',
  gamma_at_entry: '',
  vega_at_entry: '',
  underlying_at_entry: '',
  underlying_at_exit: '',
  entry_price: '',
  exit_price: '',
  position_size: '',
  stop_loss: '',
  initial_target: '',
  strategy: '',
  mood_before: '',
  mood_after: '',
  discipline_score: '',
  followed_plan: '',
  deviation_notes: '',
  pnl: '',
  pnl_percentage: '',
  screenshot_url: '',
  notes: '',
  tags: [],
  rating: 0,
}

interface TradeEntrySheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<JournalEntry | null>
  editEntry?: JournalEntry | null
  prefill?: JournalPrefillPayload | null
  onRequestEditEntry?: (entry: JournalEntry) => void
}

function parseMaybeNumber(value: string): number | null {
  if (!value || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMaybeInteger(value: string): number | null {
  const parsed = parseMaybeNumber(value)
  if (parsed == null) return null
  return Number.isInteger(parsed) ? parsed : Math.round(parsed)
}

function calculateDte(dateText: string, tradeDateText: string): number | null {
  if (!dateText || !tradeDateText) return null
  const expiry = new Date(`${dateText}T00:00:00Z`)
  const trade = new Date(`${tradeDateText}T00:00:00Z`)
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(trade.getTime())) return null
  const ms = expiry.getTime() - trade.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function calculatePnl(
  entryPrice: number | null,
  exitPrice: number | null,
  direction: 'long' | 'short',
): number | null {
  if (entryPrice == null || exitPrice == null) return null
  return direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
}

function calculatePnlPercent(
  entryPrice: number | null,
  exitPrice: number | null,
  direction: 'long' | 'short',
): number | null {
  if (entryPrice == null || entryPrice === 0 || exitPrice == null) return null
  const raw = direction === 'long'
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100
  return Number.isFinite(raw) ? raw : null
}

function composeNotes(entry: JournalEntry): string {
  const chunks: string[] = []
  if (entry.setup_notes?.trim()) {
    chunks.push(`Setup:\n${entry.setup_notes.trim()}`)
  }
  if (entry.execution_notes?.trim()) {
    chunks.push(`Execution:\n${entry.execution_notes.trim()}`)
  }
  if (entry.lessons_learned?.trim()) {
    chunks.push(`Lessons:\n${entry.lessons_learned.trim()}`)
  }
  return chunks.join('\n\n')
}

function splitNotes(notes: string): {
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
} {
  const trimmed = notes.trim()
  if (!trimmed) {
    return { setup_notes: null, execution_notes: null, lessons_learned: null }
  }

  const setupMatch = trimmed.match(/(?:^|\n)Setup:\s*([\s\S]*?)(?=\n(?:Execution|Lessons):|$)/i)
  const executionMatch = trimmed.match(/(?:^|\n)Execution:\s*([\s\S]*?)(?=\n(?:Setup|Lessons):|$)/i)
  const lessonsMatch = trimmed.match(/(?:^|\n)Lessons:\s*([\s\S]*?)(?=\n(?:Setup|Execution):|$)/i)

  const setup = setupMatch?.[1]?.trim() || null
  const execution = executionMatch?.[1]?.trim() || null
  const lessons = lessonsMatch?.[1]?.trim() || null

  if (!setup && !execution && !lessons) {
    return {
      setup_notes: trimmed,
      execution_notes: null,
      lessons_learned: null,
    }
  }

  return {
    setup_notes: setup,
    execution_notes: execution,
    lessons_learned: lessons,
  }
}

export function TradeEntrySheet({
  open,
  onClose,
  onSave,
  editEntry,
  prefill,
  onRequestEditEntry,
}: TradeEntrySheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()
  const [form, setForm] = useState<TradeEntryFormData>(EMPTY_FORM)
  const [sourceSessionId, setSourceSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<AITradeAnalysis | null>(null)
  const [aiFieldStatus, setAiFieldStatus] = useState<Partial<Record<AIFieldKey, AIFieldStatus>>>({})
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadProgress | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
  })

  useEffect(() => {
    if (!open) return

    const originalOverflow = document.body.style.overflow
    const originalOverscrollBehavior = document.body.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.overscrollBehavior = originalOverscrollBehavior
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (editEntry) {
      setForm({
        trade_date: editEntry.trade_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        symbol: editEntry.symbol || '',
        direction: editEntry.direction === 'short' ? 'short' : 'long',
        contract_type: editEntry.contract_type || 'stock',
        strike_price: editEntry.strike_price?.toString() || '',
        expiration_date: editEntry.expiration_date || '',
        dte_at_entry: editEntry.dte_at_entry?.toString() || '',
        dte_at_exit: editEntry.dte_at_exit?.toString() || '',
        iv_at_entry: editEntry.iv_at_entry?.toString() || '',
        iv_at_exit: editEntry.iv_at_exit?.toString() || '',
        delta_at_entry: editEntry.delta_at_entry?.toString() || '',
        theta_at_entry: editEntry.theta_at_entry?.toString() || '',
        gamma_at_entry: editEntry.gamma_at_entry?.toString() || '',
        vega_at_entry: editEntry.vega_at_entry?.toString() || '',
        underlying_at_entry: editEntry.underlying_at_entry?.toString() || '',
        underlying_at_exit: editEntry.underlying_at_exit?.toString() || '',
        entry_price: editEntry.entry_price?.toString() || '',
        exit_price: editEntry.exit_price?.toString() || '',
        position_size: editEntry.position_size?.toString() || '',
        stop_loss: editEntry.stop_loss?.toString() || '',
        initial_target: editEntry.initial_target?.toString() || '',
        strategy: editEntry.strategy || '',
        mood_before: editEntry.mood_before || '',
        mood_after: editEntry.mood_after || '',
        discipline_score: editEntry.discipline_score?.toString() || '',
        followed_plan: editEntry.followed_plan == null ? '' : editEntry.followed_plan ? 'yes' : 'no',
        deviation_notes: editEntry.deviation_notes || '',
        pnl: editEntry.pnl?.toString() || '',
        pnl_percentage: editEntry.pnl_percentage?.toString() || '',
        screenshot_url: editEntry.screenshot_url || '',
        notes: composeNotes(editEntry),
        tags: editEntry.tags || [],
        rating: editEntry.rating || 0,
      })
      setSourceSessionId(editEntry.session_id || null)
      setAiAnalysis(editEntry.ai_analysis || null)
      setScreenshotPreview(editEntry.screenshot_url || null)
      setMode('full')
    } else {
      const today = new Date().toISOString().split('T')[0]
      const hasAdvancedPrefill = Boolean(
        prefill?.stop_loss
        || prefill?.initial_target
        || prefill?.strategy,
      )

      setForm({
        ...EMPTY_FORM,
        trade_date: prefill?.trade_date || today,
        symbol: prefill?.symbol || '',
        direction: prefill?.direction === 'short' ? 'short' : 'long',
        entry_price: prefill?.entry_price || '',
        stop_loss: prefill?.stop_loss || '',
        initial_target: prefill?.initial_target || '',
        strategy: prefill?.strategy || '',
      })
      setSourceSessionId(prefill?.session_id || null)
      setAiAnalysis(null)
      setScreenshotPreview(null)
      setMode(hasAdvancedPrefill ? 'full' : 'quick')
    }

    setAiFieldStatus({})
    setUploadStatus(null)
    setAnalyzeError(null)
  }, [editEntry, open, prefill])

  const handleScreenshotDrop = useCallback(async (accepted: File[]) => {
    if (accepted.length === 0) return
    const file = accepted[0]
    setScreenshotPreview(URL.createObjectURL(file))
    setUploadStatus({ status: 'validating' })

    const supabase = createBrowserSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadStatus({ status: 'error', error: 'You must be logged in to upload screenshots.' })
      return
    }

    const result = await uploadScreenshot(
      file,
      user.id,
      editEntry?.id,
      (progress) => setUploadStatus(progress),
    )

    if (result.status === 'complete' && result.url) {
      setScreenshotPreview(result.url)
      setForm((prev) => ({ ...prev, screenshot_url: result.url! }))
    }
  }, [editEntry?.id])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
    onDrop: handleScreenshotDrop,
  })

  const updateField = useCallback((
    field: keyof TradeEntryFormData,
    value: string | string[] | number,
  ) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'expiration_date' || field === 'trade_date') {
        const dte = calculateDte(String(next.expiration_date || ''), String(next.trade_date || ''))
        if (dte != null) {
          next.dte_at_entry = String(dte)
        }
      }
      return next
    })
  }, [])

  const quickPnlPreview = useMemo(() => {
    const entryPrice = parseMaybeNumber(form.entry_price)
    const exitPrice = parseMaybeNumber(form.exit_price)
    return calculatePnl(entryPrice, exitPrice, form.direction)
  }, [form.direction, form.entry_price, form.exit_price])

  const canSaveQuick = useMemo(() => {
    return Boolean(
      form.symbol.trim()
      && parseMaybeNumber(form.entry_price) != null
      && parseMaybeNumber(form.exit_price) != null,
    )
  }, [form.entry_price, form.exit_price, form.symbol])

  const acceptAiField = useCallback((field: AIFieldKey) => {
    setAiFieldStatus((prev) => ({ ...prev, [field]: 'accepted' }))
  }, [])

  const rejectAiField = useCallback((field: AIFieldKey) => {
    setAiFieldStatus((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })

    if (field === 'direction') {
      updateField('direction', 'long')
      return
    }

    if (field === 'symbol') {
      updateField('symbol', '')
      return
    }

    updateField(field as keyof TradeEntryFormData, '')
  }, [updateField])

  const handleAnalyze = useCallback(async () => {
    const imageUrl = form.screenshot_url
    if (!imageUrl) return
    if (imageUrl.startsWith('blob:')) {
      setAnalyzeError('Screenshot is still uploading. Please wait for the upload to complete.')
      return
    }

    setAnalyzing(true)
    setAnalyzeError(null)

    try {
      const res = await fetch('/api/members/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Analysis failed (${res.status})`)
      }

      const data = await res.json()
      const nextStatus: Partial<Record<AIFieldKey, AIFieldStatus>> = {}

      if (data.symbol) {
        updateField('symbol', String(data.symbol).toUpperCase())
        nextStatus.symbol = 'pending'
      }
      if (data.direction === 'long' || data.direction === 'short') {
        updateField('direction', data.direction)
        nextStatus.direction = 'pending'
      }
      if (typeof data.entry_price === 'number') {
        updateField('entry_price', String(data.entry_price))
        nextStatus.entry_price = 'pending'
      }
      if (typeof data.exit_price === 'number') {
        updateField('exit_price', String(data.exit_price))
        nextStatus.exit_price = 'pending'
      }
      if (typeof data.pnl === 'number') {
        updateField('pnl', String(data.pnl))
        nextStatus.pnl = 'pending'
      }
      if (typeof data.pnl_percentage === 'number') {
        updateField('pnl_percentage', String(data.pnl_percentage))
        nextStatus.pnl_percentage = 'pending'
      }

      setAiFieldStatus((prev) => ({ ...prev, ...nextStatus }))

      if (data.analysis_summary) {
        setAiAnalysis({
          summary: data.analysis_summary,
          grade: data.grade || 'B',
        })
      }
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }, [form.screenshot_url, updateField])

  const buildPayload = useCallback((saveMode: 'quick' | 'full'): Record<string, unknown> => {
    const entryPrice = parseMaybeNumber(form.entry_price)
    const exitPrice = parseMaybeNumber(form.exit_price)
    const computedPnl = calculatePnl(entryPrice, exitPrice, form.direction)
    const computedPnlPercent = calculatePnlPercent(entryPrice, exitPrice, form.direction)

    const pnlOverride = parseMaybeNumber(form.pnl)
    const pnlPctOverride = parseMaybeNumber(form.pnl_percentage)

    const payload: Record<string, unknown> = {
      trade_date: form.trade_date,
      symbol: form.symbol.toUpperCase(),
      direction: form.direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      pnl: pnlOverride ?? computedPnl,
      pnl_percentage: pnlPctOverride ?? computedPnlPercent,
      is_winner: (pnlOverride ?? computedPnl) != null
        ? (pnlOverride ?? computedPnl)! > 0
          ? true
          : (pnlOverride ?? computedPnl)! < 0
            ? false
            : null
        : null,
    }

    if (saveMode === 'full' || editEntry) {
      const notes = splitNotes(form.notes)
      const derivedDteAtEntry = calculateDte(form.expiration_date, form.trade_date)
      payload.position_size = parseMaybeNumber(form.position_size)
      payload.stop_loss = parseMaybeNumber(form.stop_loss)
      payload.initial_target = parseMaybeNumber(form.initial_target)
      payload.strategy = form.strategy.trim() || null
      payload.contract_type = form.contract_type
      payload.strike_price = parseMaybeNumber(form.strike_price)
      payload.expiration_date = form.expiration_date || null
      payload.dte_at_entry = parseMaybeInteger(form.dte_at_entry) ?? derivedDteAtEntry
      payload.dte_at_exit = parseMaybeInteger(form.dte_at_exit)
      payload.iv_at_entry = parseMaybeNumber(form.iv_at_entry)
      payload.iv_at_exit = parseMaybeNumber(form.iv_at_exit)
      payload.delta_at_entry = parseMaybeNumber(form.delta_at_entry)
      payload.theta_at_entry = parseMaybeNumber(form.theta_at_entry)
      payload.gamma_at_entry = parseMaybeNumber(form.gamma_at_entry)
      payload.vega_at_entry = parseMaybeNumber(form.vega_at_entry)
      payload.underlying_at_entry = parseMaybeNumber(form.underlying_at_entry)
      payload.underlying_at_exit = parseMaybeNumber(form.underlying_at_exit)
      payload.mood_before = form.mood_before || null
      payload.mood_after = form.mood_after || null
      payload.discipline_score = parseMaybeInteger(form.discipline_score)
      payload.followed_plan = form.followed_plan === '' ? null : form.followed_plan === 'yes'
      payload.deviation_notes = form.deviation_notes.trim() || null
      payload.screenshot_url = form.screenshot_url || null
      payload.screenshot_storage_path = uploadStatus?.storagePath || editEntry?.screenshot_storage_path || null
      payload.setup_notes = notes.setup_notes
      payload.execution_notes = notes.execution_notes
      payload.lessons_learned = notes.lessons_learned
      payload.tags = form.tags
      payload.rating = form.rating || null
    }

    if (aiAnalysis) {
      payload.ai_analysis = aiAnalysis
    }

    if (!editEntry && sourceSessionId) {
      payload.session_id = sourceSessionId
    }

    if (editEntry) {
      payload.id = editEntry.id
    }

    return payload
  }, [aiAnalysis, editEntry, form, sourceSessionId, uploadStatus?.storagePath])

  const submit = useCallback(async (saveMode: 'quick' | 'full') => {
    if (!form.symbol.trim()) return
    setSaving(true)

    try {
      const savedEntry = await onSave(buildPayload(saveMode))

      if (saveMode === 'quick' && !editEntry) {
        toast.success('Trade saved! Add a screenshot for AI analysis?', {
          action: savedEntry && onRequestEditEntry
            ? {
                label: 'Add Screenshot',
                onClick: () => onRequestEditEntry(savedEntry),
              }
            : undefined,
        })
      } else {
        toast.success(editEntry ? 'Trade updated' : 'Trade saved')
      }

      onClose()
    } catch (error) {
      const appError = (error && typeof error === 'object' && 'category' in error)
        ? error as AppError
        : createAppError(error)

      notifyAppError(appError, {
        onRetry: () => {
          void submit(saveMode)
        },
      })
    } finally {
      setSaving(false)
    }
  }, [buildPayload, editEntry, form.symbol, onClose, onRequestEditEntry, onSave])

  const toggleTag = useCallback((tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((existing) => existing !== tag)
        : [...prev.tags, tag],
    }))
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn('fixed inset-0 z-50 flex', isMobile ? 'items-end justify-center' : 'justify-end')}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          ref={panelRef}
          initial={isMobile ? { y: '100%' } : { x: '100%' }}
          animate={isMobile ? { y: 0 } : { x: 0 }}
          exit={isMobile ? { y: '100%' } : { x: '100%' }}
          transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 35 }}
          role="dialog"
          aria-modal="true"
          aria-label={editEntry ? 'Edit trade entry' : 'Log trade entry'}
          tabIndex={-1}
          className={cn(
            'relative w-full bg-[#0A0A0B] flex flex-col overflow-hidden',
            isMobile
              ? 'h-[92dvh] max-h-[92dvh] rounded-t-2xl border-t border-white/[0.08]'
              : 'max-w-[680px] h-[100dvh] max-h-[100dvh] border-l border-white/[0.08]',
          )}
        >
          {isMobile && (
            <div className="pt-2 flex justify-center">
              <div className="h-1 w-12 rounded-full bg-white/20" />
            </div>
          )}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="space-y-1">
              <h2 className="text-base font-medium text-ivory">
                {editEntry ? 'Edit Trade' : 'Log Trade'}
              </h2>
              <div className="inline-flex items-center bg-white/[0.03] rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={cn(
                    'focus-champagne px-2.5 py-1 rounded-md text-xs transition-colors',
                    mode === 'quick' ? 'bg-emerald-900/30 text-emerald-300' : 'text-muted-foreground',
                  )}
                  aria-pressed={mode === 'quick'}
                  aria-label="Switch to quick entry mode"
                >
                  Quick Entry
                </button>
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className={cn(
                    'focus-champagne px-2.5 py-1 rounded-md text-xs transition-colors',
                    mode === 'full' ? 'bg-emerald-900/30 text-emerald-300' : 'text-muted-foreground',
                  )}
                  aria-pressed={mode === 'full'}
                  aria-label="Switch to full entry mode"
                >
                  Full Entry
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-champagne p-1.5 rounded-lg text-muted-foreground hover:text-ivory hover:bg-white/5 transition-colors"
              aria-label="Close trade entry"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <QuickEntryForm
              form={form}
              saving={saving}
              quickPnlPreview={quickPnlPreview}
              onFieldChange={updateField}
              onSaveAndClose={() => submit('quick')}
              onSaveAndAddDetails={() => setMode('full')}
              canSaveQuick={canSaveQuick}
              showActions={mode === 'quick'}
              aiFieldStatus={aiFieldStatus}
              onAcceptAiField={acceptAiField}
              onRejectAiField={rejectAiField}
            />

            <AnimatePresence initial={false}>
              {mode === 'full' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 8 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: 8 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <FullEntryForm
                    form={form}
                    onFieldChange={updateField}
                    aiFieldStatus={aiFieldStatus}
                    onAcceptAiField={acceptAiField}
                    onRejectAiField={rejectAiField}
                    quickTags={QUICK_TAGS}
                    onToggleTag={toggleTag}
                    screenshotPreview={screenshotPreview}
                    uploadStatus={uploadStatus}
                    getRootProps={getRootProps}
                    getInputProps={getInputProps}
                    isDragActive={isDragActive}
                    onRemoveScreenshot={() => {
                      setScreenshotPreview(null)
                      setUploadStatus(null)
                      setForm((prev) => ({ ...prev, screenshot_url: '' }))
                    }}
                    onAnalyze={handleAnalyze}
                    analyzing={analyzing}
                    analyzeError={analyzeError}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {aiAnalysis && (
              <section className="glass-card rounded-xl p-4 border-champagne/10">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-4 h-4 text-champagne" />
                  <h4 className="text-sm font-medium text-ivory">AI Analysis</h4>
                  {aiAnalysis.grade && (
                    <span className={cn(
                      'ml-auto inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold',
                      aiAnalysis.grade.startsWith('A') ? 'bg-emerald-900/30 text-emerald-400' :
                      aiAnalysis.grade.startsWith('B') ? 'bg-champagne/10 text-champagne' :
                      'bg-amber-900/30 text-amber-400',
                    )}>
                      {aiAnalysis.grade}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ivory/80 leading-relaxed">{aiAnalysis.summary}</p>

                {aiAnalysis.entry_analysis && (
                  <div className="mt-3 space-y-2">
                    {aiAnalysis.entry_analysis.observations.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Strengths</p>
                        {aiAnalysis.entry_analysis.observations.map((observation, index) => (
                          <p key={index} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                            <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                            {observation}
                          </p>
                        ))}
                      </div>
                    )}
                    {aiAnalysis.entry_analysis.improvements.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Improvements</p>
                        {aiAnalysis.entry_analysis.improvements.map((improvement, index) => (
                          <p key={index} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                            {improvement}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>

          {mode === 'full' && (
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className="focus-champagne px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-ivory border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
                >
                  Back To Quick
                </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="focus-champagne px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-ivory border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submit('full')}
                  disabled={saving || !form.symbol.trim()}
                  className="focus-champagne px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors min-w-[112px] flex items-center justify-center"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editEntry ? 'Save Changes' : 'Save Trade'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
