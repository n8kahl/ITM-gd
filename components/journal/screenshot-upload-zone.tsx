'use client'

import { useCallback, useState } from 'react'
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

  const runSuggestedAction = useCallback((actionId: ScreenshotActionId) => {
    const topPosition = analysis?.positions?.[0]
    const summary = summarizePositions(analysis?.positions || [])

    switch (actionId) {
      case 'log_trade':
        if (topPosition) onApplyExtractedPosition?.(topPosition)
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
        openAICoach('Suggest practical alerts from this screenshot and explain each trigger.')
        return
      case 'review_journal_context':
        openAICoach('Compare this screenshot context with my trade journal and highlight repeated patterns.')
        return
      default:
        return
    }
  }, [analysis?.positions, onApplyExtractedPosition, openAICoach, summarizePositions])

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      setProgress(0)
      setAnalysis(null)
      setAnalysisError(null)

      try {
        const supabase = createBrowserSupabase()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError('You must be logged in to upload screenshots')
          setUploading(false)
          return
        }

        const result = await uploadScreenshot(file, user.id, undefined, (progressUpdate: UploadProgress) => {
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
          const base64 = await fileToBase64(file)
          const extracted = await analyzeScreenshot(base64, file.type, session.access_token)
          setAnalysis(extracted)
        }
      } catch (err) {
        console.error('Screenshot upload failed:', err)
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
        setAnalyzing(false)
        setProgress(0)
      }
    },
    [onUploadComplete],
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
  }, [onRemove])

  if (currentScreenshotUrl) {
    return (
      <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-md">
          <Image src={currentScreenshotUrl} alt="Trade screenshot" fill className="object-contain" />
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

            {analysis.positions[0] && onApplyExtractedPosition && (
              <button
                type="button"
                onClick={() => onApplyExtractedPosition(analysis.positions[0])}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/15"
              >
                Apply Top Position To Form
              </button>
            )}

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
          </div>
        )}

        {analysisError && <p className="text-xs text-amber-300">{analysisError}</p>}
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
