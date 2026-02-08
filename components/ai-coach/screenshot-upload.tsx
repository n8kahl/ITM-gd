'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Camera,
  Upload,
  Loader2,
  Check,
  AlertTriangle,
  X,
  Edit3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  analyzeScreenshot as apiAnalyzeScreenshot,
  AICoachAPIError,
  type ExtractedPosition,
  type ScreenshotAnalysisResponse,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface ScreenshotUploadProps {
  onPositionsConfirmed?: (positions: ExtractedPosition[]) => void
  onClose: () => void
}

type UploadStep = 'upload' | 'analyzing' | 'review' | 'error'

// ============================================
// COMPONENT
// ============================================

export function ScreenshotUpload({ onPositionsConfirmed, onClose }: ScreenshotUploadProps) {
  const { session } = useMemberAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<UploadStep>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ScreenshotAnalysisResponse | null>(null)
  const [editablePositions, setEditablePositions] = useState<ExtractedPosition[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Please upload a PNG, JPEG, WebP, or GIF image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB')
      return
    }

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Convert to base64 and analyze
    setStep('analyzing')
    setError(null)

    try {
      const base64 = await fileToBase64(file)
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const result = await apiAnalyzeScreenshot(base64, file.type, token)
      setAnalysis(result)
      setEditablePositions(result.positions)
      setStep('review')
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : err instanceof Error ? err.message : 'Failed to analyze screenshot'
      setError(msg)
      setStep('error')
    }
  }, [session?.access_token])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && fileInputRef.current) {
      const dt = new DataTransfer()
      dt.items.add(file)
      fileInputRef.current.files = dt.files
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, [])

  const handleConfirm = useCallback(() => {
    const validPositions = editablePositions.filter(p => p.entryPrice > 0 && p.symbol)
    onPositionsConfirmed?.(validPositions)
    onClose()
  }, [editablePositions, onPositionsConfirmed, onClose])

  const removePosition = (index: number) => {
    setEditablePositions(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Screenshot Analysis</h2>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Upload Step */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-white/10 hover:border-emerald-500/30 rounded-xl p-8 text-center transition-all cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
            <p className="text-sm text-white/60 mb-1">
              Drop a screenshot or click to upload
            </p>
            <p className="text-xs text-white/30">
              Supports TastyTrade, Thinkorswim, IBKR, Robinhood, Webull
            </p>
            <p className="text-xs text-white/20 mt-2">PNG, JPEG, WebP up to 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Analyzing Step */}
        {step === 'analyzing' && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
            <p className="text-sm text-white/60">Analyzing screenshot...</p>
            <p className="text-xs text-white/30 mt-1">Extracting positions with AI Vision</p>
            {preview && (
              <div className="mt-4 mx-auto max-w-xs rounded-lg overflow-hidden border border-white/10 opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Screenshot preview" className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-4" />
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button
              onClick={() => { setStep('upload'); setError(null); setPreview(null); }}
              className="text-xs text-emerald-500 hover:text-emerald-400"
            >
              Try again
            </button>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && analysis && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">
                  Found <span className="text-emerald-400 font-medium">{editablePositions.length}</span> position{editablePositions.length !== 1 ? 's' : ''}
                </p>
                {analysis.broker && (
                  <p className="text-xs text-white/40">Detected: {analysis.broker}</p>
                )}
              </div>
              <button
                onClick={() => { setStep('upload'); setPreview(null); setAnalysis(null); }}
                className="text-xs text-white/40 hover:text-white/60"
              >
                Upload another
              </button>
            </div>

            {/* Warnings */}
            {analysis.warnings.length > 0 && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            {/* Positions */}
            <div className="space-y-2">
              {editablePositions.map((pos, i) => (
                <div
                  key={i}
                  className={cn(
                    'glass-card-heavy rounded-lg p-3 border',
                    pos.confidence >= 0.8
                      ? 'border-emerald-500/20'
                      : pos.confidence >= 0.5
                      ? 'border-amber-500/20'
                      : 'border-red-500/20'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{pos.symbol}</span>
                      <span className="text-xs text-white/40 capitalize">{pos.type.replace('_', ' ')}</span>
                      {pos.strike && <span className="text-xs text-white/40">${pos.strike}</span>}
                      {pos.expiry && <span className="text-xs text-white/30">{pos.expiry}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        pos.confidence >= 0.8
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : pos.confidence >= 0.5
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-red-500/10 text-red-400'
                      )}>
                        {Math.round(pos.confidence * 100)}%
                      </span>
                      <button
                        onClick={() => removePosition(i)}
                        className="text-white/20 hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-white/30">Qty:</span>
                      <span className="text-white/70 ml-1">{pos.quantity}</span>
                    </div>
                    <div>
                      <span className="text-white/30">Entry:</span>
                      <span className="text-white/70 ml-1">${pos.entryPrice.toFixed(2)}</span>
                    </div>
                    {pos.pnl != null && (
                      <div>
                        <span className="text-white/30">P&L:</span>
                        <span className={cn(
                          'ml-1',
                          pos.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {editablePositions.length === 0 && (
              <p className="text-sm text-white/40 text-center py-4">
                No positions to confirm. Try uploading a different screenshot.
              </p>
            )}

            {/* Confirm button */}
            {editablePositions.length > 0 && (
              <button
                onClick={handleConfirm}
                className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm {editablePositions.length} Position{editablePositions.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// UTILITY
// ============================================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data URL prefix to get just the base64
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
