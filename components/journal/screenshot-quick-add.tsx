'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { uploadScreenshot, type UploadProgress } from '@/lib/uploads/supabaseStorage'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { analyzeScreenshot, type ScreenshotAnalysisResponse } from '@/lib/api/ai-coach'
import { useFocusTrap } from '@/hooks/use-focus-trap'

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

  const openAICoach = useCallback((prompt: string) => {
    if (typeof window === 'undefined') return
    const query = encodeURIComponent(prompt)
    window.open(`/members/ai-coach?prompt=${query}`, '_blank', 'noopener,noreferrer')
  }, [])

  const runScreenshotAnalysis = useCallback(async (selectedFile: File) => {
    setAnalysis(null)
    setAnalysisError(null)
    setAnalyzing(true)
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

      const top = result.positions[0]
      if (top?.symbol && !symbol.trim()) {
        setSymbol(top.symbol)
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze screenshot')
    } finally {
      setAnalyzing(false)
    }
  }, [symbol])

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setFile(selectedFile)
    setError(null)
    setAnalysis(null)
    setAnalysisError(null)

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
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type })
            handleFileSelect(file)
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

  const handleSave = useCallback(async () => {
    if (!file) {
      setError('Please select a screenshot first')
      return
    }

    const fallbackSymbol = analysis?.positions?.[0]?.symbol || ''
    const normalizedSymbol = symbol.trim().toUpperCase() || fallbackSymbol
    if (!normalizedSymbol) {
      setError('Please enter a symbol before creating the entry')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in')
        setUploading(false)
        return
      }

      // Upload screenshot
      const result = await uploadScreenshot(file, user.id, undefined, (progress: UploadProgress) => {
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

      // Create journal entry with screenshot
      const { data: entry, error: createError } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          symbol: normalizedSymbol,
          trade_date: new Date().toISOString(),
          direction: 'long',
          contract_type: 'stock',
          is_open: false,
          screenshot_url: result.url,
          screenshot_storage_path: result.storagePath,
          setup_notes: notes.trim() || null,
        })
        .select()
        .single()

      if (createError) {
        console.error('Failed to create journal entry:', createError)
        setError('Failed to create entry')
        setUploading(false)
        return
      }

      // Success! Call parent callback
      onEntryCreated(entry.id)
    } catch (err) {
      console.error('Quick screenshot save failed:', err)
      setError(err instanceof Error ? err.message : 'Save failed')
      setUploading(false)
    }
  }, [analysis?.positions, file, symbol, notes, onEntryCreated])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0" onClick={!uploading ? onClose : undefined} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl rounded-t-xl border border-white/10 bg-[#101315] p-6 sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-ivory">Quick Screenshot Entry</h2>
            <p className="text-xs text-muted-foreground">Fastest way to log a trade - just 10 seconds</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-md border border-white/10 p-2 text-muted-foreground hover:text-ivory disabled:opacity-60"
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
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  <ImagePlus className="h-4 w-4" />
                  Paste from Clipboard
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm text-ivory hover:bg-white/5"
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
                  }}
                  className="absolute right-2 top-2 rounded-md bg-black/80 p-1.5 text-red-300 hover:bg-black"
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
                <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/70">
                    Found <span className="text-emerald-300">{analysis.positionCount}</span> position{analysis.positionCount === 1 ? '' : 's'}
                    {' '}({analysis.intent.replace('_', ' ')})
                  </p>

                  {analysis.positions[0] && (
                    <button
                      type="button"
                      onClick={() => setSymbol(analysis.positions[0]?.symbol || symbol)}
                      className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/15"
                    >
                      Use Detected Symbol ({analysis.positions[0].symbol})
                    </button>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {analysis.suggestedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => openAICoach(`I uploaded a screenshot. ${action.label}: ${action.description}`)}
                        className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80 hover:border-emerald-500/30 hover:text-emerald-200"
                        title={action.description}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {analysisError && <p className="text-xs text-amber-300">{analysisError}</p>}

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Symbol (required)</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., AAPL"
                  disabled={uploading}
                  className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory placeholder:text-muted-foreground disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Quick notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What made you take this trade?"
                  disabled={uploading}
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-ivory placeholder:text-muted-foreground disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="h-10 rounded-md border border-white/10 px-4 text-sm text-muted-foreground hover:text-ivory disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={uploading}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress > 0 ? `${uploadProgress}%` : 'Saving...'}
                  </>
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
