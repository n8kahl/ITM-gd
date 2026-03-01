'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ImagePlus, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { uploadScreenshot, type UploadProgress } from '@/lib/uploads/supabaseStorage'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import {
  analyzeScreenshot,
  type ExtractedPosition,
  type ScreenshotAnalysisResponse,
} from '@/lib/api/ai-coach'
import { useFocusTrap } from '@/hooks/use-focus-trap'

const ALLOWED_SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const AMBIGUOUS_SCREENSHOT_SYMBOLS = new Set([
  'MULTIPLE',
  'MULTI',
  'PORTFOLIO',
  'VARIOUS',
  'MIXED',
  'ACCOUNT',
  'POSITIONS',
  'POSITION',
  'HOLDINGS',
  'TOTAL',
])

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9./]/g, '')
}

function isAmbiguousSymbol(value: string): boolean {
  return AMBIGUOUS_SCREENSHOT_SYMBOLS.has(normalizeSymbol(value))
}

function isValidPosition(pos: ExtractedPosition): boolean {
  return Boolean(pos.symbol) && !isAmbiguousSymbol(pos.symbol)
}

function formatPositionLabel(pos: ExtractedPosition): string {
  const parts: string[] = [pos.symbol]
  if (pos.type !== 'stock') {
    parts.push(pos.type.toUpperCase())
  }
  if (pos.strike) parts.push(`$${pos.strike}`)
  if (pos.expiry) parts.push(pos.expiry)
  return parts.join(' ')
}

function formatPnl(pnl: number | undefined): string {
  if (pnl == null) return ''
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function resolveCurrentUserId(supabase: ReturnType<typeof createBrowserSupabase>): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.user?.id) return session.user.id

  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

interface ScreenshotQuickAddProps {
  open: boolean
  onClose: () => void
  onEntryCreated: (entryId: string) => void
}

export function ScreenshotQuickAdd({ open, onClose, onEntryCreated }: ScreenshotQuickAddProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <ScreenshotQuickAddDialog onClose={onClose} onEntryCreated={onEntryCreated} />,
    document.body
  )
}

function ScreenshotQuickAddDialog({
  onClose,
  onEntryCreated,
}: Omit<ScreenshotQuickAddProps, 'open'>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ScreenshotAnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set())
  const [saveResult, setSaveResult] = useState<{ created: number; failed: number } | null>(null)

  const hasMultiplePositions = (analysis?.positionCount ?? 0) > 1
  const validPositions = useMemo(() => analysis?.positions.filter(isValidPosition) ?? [], [analysis?.positions])

  useFocusTrap({
    active: !uploading,
    containerRef,
    onEscape: onClose,
  })

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const openAICoach = useCallback((actionPrompt: string) => {
    if (typeof window === 'undefined') return
    // Build position summary for context
    const positions = analysis?.positions ?? []
    const summary = positions
      .slice(0, 10)
      .map((p) => {
        const label = formatPositionLabel(p)
        const qty = `x${Math.abs(p.quantity)}`
        const pnl = p.pnl != null ? ` P&L: ${formatPnl(p.pnl)}` : ''
        return `${label} ${qty}${pnl}`
      })
      .join('; ')

    const fullPrompt = summary
      ? `${actionPrompt}\n\nPositions from screenshot: ${summary}`
      : actionPrompt

    const query = encodeURIComponent(fullPrompt)
    window.open(`/members/ai-coach?prompt=${query}`, '_blank', 'noopener,noreferrer')
  }, [analysis?.positions])

  const runScreenshotAnalysis = useCallback(async (selectedFile: File) => {
    setAnalysis(null)
    setAnalysisError(null)
    setAnalyzing(true)
    setSelectedPositions(new Set())
    setSaveResult(null)
    try {
      const supabase = createBrowserSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setAnalysisError('Screenshot attached. Sign in again to run AI extraction.')
        return
      }

      const base64 = await fileToBase64(selectedFile)
      const result = await analyzeScreenshot(base64, selectedFile.type, session.access_token)
      setAnalysis(result)

      // Auto-fill symbol only for single non-ambiguous position
      const top = result.positions[0]
      if (result.positionCount === 1 && top?.symbol && !symbol.trim() && !isAmbiguousSymbol(top.symbol)) {
        setSymbol(normalizeSymbol(top.symbol))
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze screenshot')
    } finally {
      setAnalyzing(false)
    }
  }, [symbol])

  const togglePosition = useCallback((index: number) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const selectAllPositions = useCallback(() => {
    setSelectedPositions(new Set(validPositions.map((_, i) => i)))
  }, [validPositions])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!ALLOWED_SCREENSHOT_TYPES.has(selectedFile.type)) {
      setError('Please select a PNG, JPEG, or WebP image')
      return
    }

    setFile(selectedFile)
    setError(null)
    setAnalysis(null)
    setAnalysisError(null)
    setSelectedPositions(new Set())
    setSaveResult(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
    void runScreenshotAnalysis(selectedFile)
  }, [runScreenshotAnalysis])

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const pasteFile = new File([blob], `screenshot-${Date.now()}.png`, { type })
            handleFileSelect(pasteFile)
            return
          }
        }
      }
      setError('No image found in clipboard')
    } catch (err) {
      console.error('Clipboard paste failed:', err)
      setError('Failed to paste from clipboard. Try uploading instead.')
    }
  }, [handleFileSelect])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)

      const droppedFile = event.dataTransfer.files[0]
      if (droppedFile) {
        handleFileSelect(droppedFile)
      }
    },
    [handleFileSelect],
  )

  const buildEntryPayload = useCallback((
    position: ExtractedPosition,
    screenshotUrl: string,
    storagePath: string,
  ) => {
    const exitPrice = position.currentPrice && position.currentPrice > 0 ? position.currentPrice : null
    const entryPrice = position.entryPrice && position.entryPrice > 0 ? position.entryPrice : null
    const positionSize = position.quantity ? Math.abs(position.quantity) : 1
    const direction = position.quantity < 0 ? 'short' as const : 'long' as const

    let pnl: number | null = position.pnl != null ? position.pnl : null
    if (pnl == null && entryPrice != null && exitPrice != null) {
      const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
      pnl = Math.round(perUnit * positionSize * 100) / 100
    }

    return {
      symbol: normalizeSymbol(position.symbol),
      trade_date: new Date().toISOString(),
      direction,
      contract_type: position.type === 'call' || position.type === 'put' ? position.type : 'stock',
      entry_price: entryPrice,
      exit_price: exitPrice,
      position_size: positionSize,
      pnl,
      strike_price: typeof position.strike === 'number' ? position.strike : null,
      expiration_date: typeof position.expiry === 'string' ? position.expiry.slice(0, 10) : null,
      is_open: exitPrice == null,
      screenshot_url: screenshotUrl,
      screenshot_storage_path: storagePath,
      setup_notes: notes.trim() || null,
      tags: ['screenshot:quick-add'],
    }
  }, [notes])

  const handleSave = useCallback(async () => {
    if (!file) {
      setError('Please select a screenshot first')
      return
    }

    // Determine which positions to save
    const positionsToSave: ExtractedPosition[] = []

    if (hasMultiplePositions && selectedPositions.size > 0) {
      // Multi-position mode: save selected positions
      for (const idx of selectedPositions) {
        const pos = validPositions[idx]
        if (pos) positionsToSave.push(pos)
      }
    } else if (!hasMultiplePositions && analysis?.positions[0]) {
      // Single position: use symbol field (manual or auto-filled)
      const fallbackSymbol = (
        analysis.positionCount === 1
        && analysis.positions[0]?.symbol
        && !isAmbiguousSymbol(analysis.positions[0].symbol)
      )
        ? normalizeSymbol(analysis.positions[0].symbol)
        : ''
      const typedSymbol = normalizeSymbol(symbol)
      const normalizedSymbol = typedSymbol || fallbackSymbol
      if (!normalizedSymbol) {
        setError('Please enter a symbol before creating the entry')
        return
      }
      if (isAmbiguousSymbol(normalizedSymbol)) {
        setError('Detected symbol is ambiguous. Enter a specific ticker symbol to continue.')
        return
      }
      // Use a synthetic position with the user's symbol override
      positionsToSave.push({ ...analysis.positions[0], symbol: normalizedSymbol })
    } else if (!analysis && normalizeSymbol(symbol)) {
      // No analysis but user typed a symbol — create a bare entry
      positionsToSave.push({
        symbol: normalizeSymbol(symbol),
        type: 'stock',
        quantity: 1,
        entryPrice: 0,
        confidence: 0,
      })
    } else {
      setError(
        hasMultiplePositions
          ? 'Select at least one position to log'
          : 'Please enter a symbol before creating the entry',
      )
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)
    setSaveResult(null)

    try {
      const supabase = createBrowserSupabase()
      const userId = await resolveCurrentUserId(supabase)

      if (!userId) {
        setError('You must be logged in')
        setUploading(false)
        return
      }

      // Upload screenshot once
      const result = await uploadScreenshot(file, userId, undefined, (progress: UploadProgress) => {
        if (progress.status === 'uploading' && progress.percent != null) {
          setUploadProgress(progress.percent)
        }
      })

      if (result.status === 'error') {
        setError(result.error || 'Upload failed')
        setUploading(false)
        return
      }

      if (result.status !== 'complete' || !result.url || !result.storagePath) {
        setError('Upload failed')
        setUploading(false)
        return
      }

      // Create journal entries (one per position)
      let created = 0
      let failed = 0
      let lastCreatedId: string | null = null

      for (const position of positionsToSave) {
        const payload = buildEntryPayload(position, result.url, result.storagePath)

        const createResponse = await fetch('/api/members/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const createPayload = await createResponse.json().catch(() => null)
        if (createResponse.ok && createPayload?.success && createPayload?.data?.id) {
          created += 1
          lastCreatedId = createPayload.data.id as string
        } else {
          failed += 1
        }
      }

      if (created === 0) {
        setError('Failed to create any entries')
        setUploading(false)
        return
      }

      if (positionsToSave.length > 1) {
        setSaveResult({ created, failed })
      }

      onEntryCreated(lastCreatedId!)
    } catch (err) {
      console.error('Quick screenshot save failed:', err)
      setError(err instanceof Error ? err.message : 'Save failed')
      setUploading(false)
    }
  }, [analysis, buildEntryPayload, file, hasMultiplePositions, onEntryCreated, selectedPositions, symbol, validPositions])

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={!uploading ? onClose : undefined} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl rounded-t-xl border border-white/10 bg-[var(--onyx)] p-6 sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ivory">Quick Screenshot Entry</h2>
            <p className="text-xs text-muted-foreground">Upload a screenshot to extract and log positions</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-md border border-white/10 p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              isDragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/20 bg-white/5'
            }`}
          >
            <div className="flex min-h-[300px] flex-col items-center justify-center p-8">
              <ImagePlus className="mb-4 h-16 w-16 text-muted-foreground" />
              <p className="mb-4 text-center text-sm font-medium text-ivory">
                {isDragging ? 'Drop screenshot here' : 'Add screenshot of your trade'}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <ImagePlus className="h-4 w-4" />
                  Paste from Clipboard
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm text-ivory transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  Upload File
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0]
                  if (selectedFile) handleFileSelect(selectedFile)
                }}
                className="hidden"
              />

              <p className="mt-4 text-xs text-muted-foreground">PNG, JPEG, or WebP (max 5MB)</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10">
              <Image src={previewUrl!} alt="Screenshot preview" fill className="object-contain" />
              {!uploading && (
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreviewUrl(null)
                    setAnalysis(null)
                    setAnalysisError(null)
                    setSelectedPositions(new Set())
                    setSaveResult(null)
                  }}
                  className="absolute right-2 top-2 rounded-md bg-black/80 p-1.5 text-red-300 transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                  aria-label="Remove screenshot"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {analyzing && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing screenshot for positions and next-step actions...
                </div>
              )}

              {analysis && (
                <div className="space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white/70">
                      Found <span className="text-emerald-300">{analysis.positionCount}</span> position{analysis.positionCount === 1 ? '' : 's'}
                      {' '}({analysis.intent.replace(/_/g, ' ')})
                    </p>
                    {hasMultiplePositions && validPositions.length > 1 && (
                      <button
                        type="button"
                        onClick={selectAllPositions}
                        disabled={uploading}
                        className="text-[11px] text-emerald-300 transition-colors hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      >
                        {selectedPositions.size === validPositions.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  {/* Position list */}
                  <div className="max-h-48 space-y-1.5 overflow-y-auto">
                    {analysis.positions.map((pos, idx) => {
                      const valid = isValidPosition(pos)
                      const isSelected = selectedPositions.has(idx)

                      return (
                        <div
                          key={`${pos.symbol}-${idx}`}
                          className={`flex items-center gap-2.5 rounded-md border px-2.5 py-2 transition-colors ${
                            hasMultiplePositions && valid
                              ? isSelected
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : 'border-white/10 bg-white/5 hover:border-white/20 cursor-pointer'
                              : !hasMultiplePositions
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-white/5 bg-white/[0.02] opacity-50'
                          }`}
                          onClick={hasMultiplePositions && valid && !uploading ? () => togglePosition(idx) : undefined}
                        >
                          {/* Checkbox for multi-position mode */}
                          {hasMultiplePositions && valid && (
                            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-black" />}
                            </div>
                          )}

                          {/* Position details */}
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-xs font-medium text-ivory">
                                {pos.symbol}
                              </span>
                              {pos.type !== 'stock' && (
                                <span className="ml-1.5 text-[10px] text-white/50">
                                  {pos.type.toUpperCase()}
                                  {pos.strike ? ` $${pos.strike}` : ''}
                                  {pos.expiry ? ` ${pos.expiry}` : ''}
                                </span>
                              )}
                              <span className="ml-1.5 text-[10px] text-white/40">
                                x{Math.abs(pos.quantity)}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {pos.pnl != null && (
                                <span className={`font-mono text-xs ${pos.pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                  {formatPnl(pos.pnl)}
                                </span>
                              )}
                              <span className="text-[10px] text-white/30">
                                {Math.round(pos.confidence * 100)}%
                              </span>
                            </div>
                          </div>

                          {/* Single-position: click to use */}
                          {!hasMultiplePositions && valid && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSymbol(normalizeSymbol(pos.symbol))
                              }}
                              className="shrink-0 rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            >
                              Use
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Action chips — always visible */}
                  {analysis.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-2">
                      {analysis.suggestedActions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => openAICoach(`${action.label}: ${action.description}`)}
                          className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80 transition-colors hover:border-emerald-500/30 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                          title={action.description}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {analysisError && <p className="text-xs text-amber-300">{analysisError}</p>}

              {/* Symbol input: only shown for single-position or no-analysis mode */}
              {!hasMultiplePositions && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Symbol (required)</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g., AAPL"
                    disabled={uploading}
                    className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory placeholder:text-muted-foreground transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Quick notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What made you take this trade?"
                  disabled={uploading}
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory placeholder:text-muted-foreground transition-colors hover:border-white/20 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                />
              </div>
            </div>

            {saveResult && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                Created {saveResult.created} journal {saveResult.created === 1 ? 'entry' : 'entries'}
                {saveResult.failed > 0 && ` (${saveResult.failed} failed)`}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="h-10 rounded-md border border-white/10 px-4 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={uploading || (hasMultiplePositions && selectedPositions.size === 0 && !symbol.trim())}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress > 0 ? `${uploadProgress}%` : 'Saving...'}
                  </>
                ) : hasMultiplePositions && selectedPositions.size > 0 ? (
                  `Log ${selectedPositions.size} ${selectedPositions.size === 1 ? 'Entry' : 'Entries'}`
                ) : (
                  'Create Entry'
                )}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
