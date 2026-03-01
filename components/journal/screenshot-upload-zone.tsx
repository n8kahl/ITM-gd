'use client'

import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { uploadScreenshot, type UploadProgress } from '@/lib/uploads/supabaseStorage'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import {
  analyzeScreenshot,
  type ExtractedPosition,
  type ScreenshotActionId,
  type ScreenshotAnalysisResponse,
} from '@/lib/api/ai-coach'

const SCREENSHOT_ANALYSIS_TIMEOUT_MS = 20_000
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

interface ScreenshotUploadZoneProps {
  currentScreenshotUrl?: string | null
  onUploadComplete: (url: string, storagePath: string) => void
  onRemove: () => void
  onApplyExtractedPosition?: (position: ExtractedPosition) => void
  onOpenAICoach?: (prompt: string) => void
  disabled?: boolean
}

export function ScreenshotUploadZone({
  currentScreenshotUrl,
  onUploadComplete,
  onRemove,
  onApplyExtractedPosition,
  onOpenAICoach,
  disabled = false,
}: ScreenshotUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<ScreenshotAnalysisResponse | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null)
  const [selectedPositionIndex, setSelectedPositionIndex] = useState(0)

  const hasMultiplePositions = (analysis?.positionCount ?? 0) > 1
  const hasNoPositions = (analysis?.positionCount ?? 0) === 0

  useEffect(() => {
    setPreviewLoaded(false)
    setPreviewError(null)
  }, [currentScreenshotUrl])

  const runAnalysisWithTimeout = useCallback(async (
    file: File,
    token: string,
  ): Promise<ScreenshotAnalysisResponse> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SCREENSHOT_ANALYSIS_TIMEOUT_MS)

    try {
      const base64 = await fileToBase64(file)
      return await analyzeScreenshot(base64, file.type, token, { signal: controller.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('AI analysis timed out. You can still save the screenshot and fill fields manually.')
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI analysis timed out. You can still save the screenshot and fill fields manually.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }, [])

  const openAICoach = useCallback((prompt: string) => {
    if (onOpenAICoach) {
      onOpenAICoach(prompt)
      return
    }

    if (typeof window === 'undefined') return
    const query = encodeURIComponent(prompt)
    window.open(`/members/ai-coach?prompt=${query}`, '_blank', 'noopener,noreferrer')
  }, [onOpenAICoach])

  const summarizePositions = useCallback((positions: ExtractedPosition[]) => {
    return positions
      .slice(0, 5)
      .map((position) => {
        const strike = position.strike ? ` ${position.strike}` : ''
        const expiry = position.expiry ? ` ${position.expiry}` : ''
        return `${position.symbol} ${position.type}${strike}${expiry} x${position.quantity}`
      })
      .join(', ')
  }, [])

  const runSuggestedAction = useCallback((actionId: ScreenshotActionId | 'set_alert') => {
    const selectedPosition = analysis?.positions?.[selectedPositionIndex] ?? analysis?.positions?.[0]
    const summary = summarizePositions(analysis?.positions || [])

    switch (actionId) {
      case 'log_trade':
        if (selectedPosition) onApplyExtractedPosition?.(selectedPosition)
        return
      case 'analyze_next_steps':
        openAICoach(
          summary
            ? `Analyze next steps for these screenshot positions with risk-managed guidance: ${summary}`
            : 'Analyze next steps from this uploaded screenshot with risk-managed guidance.',
        )
        return
      case 'add_to_monitor':
        openAICoach(
          summary
            ? `Help me add these positions to monitoring and define risk checkpoints: ${summary}`
            : 'Help me add the uploaded screenshot positions to monitoring and define risk checkpoints.',
        )
        return
      case 'create_setup':
        openAICoach('Create a structured setup from this screenshot with entry, stop, target, and invalidation.')
        return
      case 'set_alert':
      case 'suggest_alerts':
        openAICoach('Suggest practical alerts from this screenshot and explain each trigger.')
        return
      case 'review_journal_context':
        openAICoach('Compare this screenshot context with my trade journal and highlight repeated patterns.')
        return
      default:
        return
    }
  }, [analysis?.positions, onApplyExtractedPosition, openAICoach, selectedPositionIndex, summarizePositions])

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      setProgress(0)
      setAnalysis(null)
      setAnalysisError(null)
      setSelectedPositionIndex(0)
      setLastUploadedFile(file)

      try {
        const supabase = createBrowserSupabase()
        const userId = await resolveCurrentUserId(supabase)

        if (!userId) {
          setError('You must be logged in to upload screenshots')
          setUploading(false)
          return
        }

        const result = await uploadScreenshot(file, userId, undefined, (progressUpdate: UploadProgress) => {
          if (progressUpdate.status === 'uploading' && progressUpdate.percent != null) {
            setProgress(progressUpdate.percent)
          }
        })

        if (result.status === 'error') {
          setError(result.error || 'Upload failed')
          setUploading(false)
          return
        }

        if (result.status === 'complete' && result.url && result.storagePath) {
          onUploadComplete(result.url, result.storagePath)

          const {
            data: { session },
          } = await supabase.auth.getSession()

          if (!session?.access_token) {
            setAnalysisError('Screenshot uploaded. Sign in again to run AI extraction.')
            return
          }

          setAnalyzing(true)
          try {
            const extracted = await runAnalysisWithTimeout(file, session.access_token)
            setAnalysis(extracted)
            setSelectedPositionIndex(0)
          } catch (analysisErr) {
            setAnalysisError(analysisErr instanceof Error ? analysisErr.message : 'Screenshot uploaded, but AI extraction failed.')
          } finally {
            setAnalyzing(false)
          }
        }
      } catch (err) {
        console.error('Screenshot upload failed:', err)
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [onUploadComplete, runAnalysisWithTimeout],
  )

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)

      if (disabled) return

      const file = event.dataTransfer.files[0]
      if (file) {
        handleUpload(file)
      }
    },
    [disabled, handleUpload],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleRemove = useCallback(() => {
    onRemove()
    setError(null)
    setAnalysis(null)
    setAnalysisError(null)
    setPreviewLoaded(false)
    setPreviewError(null)
    setLastUploadedFile(null)
    setSelectedPositionIndex(0)
  }, [onRemove])

  const handleRetryAnalysis = useCallback(async () => {
    if (!lastUploadedFile || uploading || analyzing) return

    try {
      const supabase = createBrowserSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setAnalysisError('Screenshot uploaded. Sign in again to run AI extraction.')
        return
      }

      setAnalysisError(null)
      setAnalyzing(true)
      const extracted = await runAnalysisWithTimeout(lastUploadedFile, session.access_token)
      setAnalysis(extracted)
      setSelectedPositionIndex(0)
    } catch (analysisErr) {
      setAnalysisError(analysisErr instanceof Error ? analysisErr.message : 'Screenshot uploaded, but AI extraction failed.')
    } finally {
      setAnalyzing(false)
    }
  }, [analyzing, lastUploadedFile, runAnalysisWithTimeout, uploading])

  const applyPositionToForm = useCallback((position: ExtractedPosition, index: number) => {
    setSelectedPositionIndex(index)
    onApplyExtractedPosition?.(position)
  }, [onApplyExtractedPosition])

  if (currentScreenshotUrl) {
    return (
      <div className="relative space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="relative h-52 w-full overflow-hidden rounded-md border border-white/10 bg-black/30 sm:h-64 lg:h-72">
          {!previewError ? (
            <>
              {!previewLoaded ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
                  <span className="text-xs text-white/60">Loading screenshot preview...</span>
                </div>
              ) : null}
              <Image
                src={currentScreenshotUrl}
                alt="Trade screenshot preview"
                fill
                unoptimized
                className={`object-contain transition-opacity duration-200 ${previewLoaded ? 'opacity-100' : 'opacity-0'}`}
                sizes="(max-width: 768px) 100vw, 768px"
                onLoad={() => setPreviewLoaded(true)}
                onError={() => {
                  setPreviewLoaded(false)
                  setPreviewError('Unable to render preview.')
                }}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <p className="text-xs text-amber-300">Preview unavailable for this screenshot.</p>
              <a
                href={currentScreenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-white/20 px-2.5 py-1 text-xs text-ivory transition-colors hover:border-white/30 hover:bg-white/[0.06]"
              >
                Open screenshot in new tab
              </a>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className="absolute right-1 top-1 rounded-md bg-black/80 p-1.5 text-red-300 hover:bg-black disabled:opacity-60"
          aria-label="Remove screenshot"
        >
          <X className="h-4 w-4" />
        </button>

        {analyzing && (
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing screenshot for positions and next actions...
          </div>
        )}

        {analysis && (
          <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
            <p className="text-xs text-white/70">
              Found <span className="text-emerald-300">{analysis.positionCount}</span> position{analysis.positionCount === 1 ? '' : 's'}
              {' '}({analysis.intent.replace('_', ' ')})
            </p>

            {hasMultiplePositions ? (
              <div className="space-y-2">
                <p className="text-[11px] text-white/65">
                  Multiple positions detected. Choose one position to apply to this trade entry.
                </p>
                <div className="max-h-36 space-y-1.5 overflow-y-auto">
                  {analysis.positions.map((position, index) => {
                    const normalized = normalizeSymbol(position.symbol)
                    const symbolReady = normalized.length > 0 && !isAmbiguousSymbol(normalized)
                    const selected = selectedPositionIndex === index
                    return (
                      <div
                        key={`${position.symbol}-${index}`}
                        className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5"
                        data-testid={`screenshot-position-${index}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs text-ivory">
                            {normalized || position.symbol || 'Unknown symbol'}
                          </p>
                          <p className="text-[10px] text-white/55">
                            {position.type.toUpperCase()} x{Math.abs(position.quantity)}
                            {position.strike ? ` • ${position.strike}` : ''}
                            {position.expiry ? ` • ${position.expiry}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => applyPositionToForm(position, index)}
                          disabled={disabled || !symbolReady}
                          className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                            selected
                              ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100'
                              : 'border-white/20 text-white/80 hover:border-white/30 hover:bg-white/[0.06]'
                          } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {selected ? 'Applied' : `Use ${normalized || 'Position'}`}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-white/45">
                  Need to log all positions? Use Quick Screenshot Entry from the Journal header.
                </p>
              </div>
            ) : analysis.positions[0] && onApplyExtractedPosition ? (
              <button
                type="button"
                onClick={() => applyPositionToForm(analysis.positions[0], 0)}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/15"
              >
                Apply Top Position To Form
              </button>
            ) : null}

            {hasNoPositions ? (
              <p className="text-xs text-white/65">
                No trade positions detected. Keep the screenshot and complete fields manually, or ask AI Coach for context.
              </p>
            ) : null}

            {analysis.suggestedActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysis.suggestedActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => runSuggestedAction(action.id)}
                    className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80 hover:border-emerald-500/30 hover:text-emerald-200"
                    title={action.description}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            {analysis.warnings.length > 0 ? (
              <div className="space-y-1 border-t border-white/10 pt-2">
                {analysis.warnings.slice(0, 3).map((warning, index) => (
                  <p key={`screenshot-warning-${index}`} className="text-[11px] text-amber-300/90">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {analysisError ? (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
            <p className="text-xs text-amber-200">{analysisError}</p>
            {lastUploadedFile ? (
              <button
                type="button"
                onClick={() => void handleRetryAnalysis()}
                disabled={analyzing || uploading || disabled}
                className="rounded border border-white/20 px-2.5 py-1 text-xs text-ivory transition-colors hover:border-white/30 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Retry Analysis
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-white/20 bg-white/5 hover:border-white/30'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <label className={`flex min-h-[200px] flex-col items-center justify-center p-6 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            disabled={disabled || uploading}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
            </div>
          ) : (
            <>
              <ImagePlus className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium text-ivory">
                {isDragging ? 'Drop screenshot here' : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP (max 5MB)</p>
            </>
          )}
        </label>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
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
