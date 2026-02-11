'use client'

import { useCallback, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { uploadScreenshot, type UploadProgress } from '@/lib/uploads/supabaseStorage'
import { createBrowserSupabase } from '@/lib/supabase-browser'

interface ScreenshotUploadZoneProps {
  currentScreenshotUrl?: string | null
  onUploadComplete: (url: string, storagePath: string) => void
  onRemove: () => void
  disabled?: boolean
}

export function ScreenshotUploadZone({
  currentScreenshotUrl,
  onUploadComplete,
  onRemove,
  disabled = false,
}: ScreenshotUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      setProgress(0)

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
        }
      } catch (err) {
        console.error('Screenshot upload failed:', err)
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
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
  }, [onRemove])

  if (currentScreenshotUrl) {
    return (
      <div className="relative rounded-lg border border-white/10 bg-white/5 p-3">
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
