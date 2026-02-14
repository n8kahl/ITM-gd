'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { FileText, ImagePlus, X, Upload, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface ChatImageUploadProps {
  /** Called with the base64 data and MIME type when the user confirms the image */
  onImageReady: (base64: string, mimeType: string) => void
  /** Called with raw CSV text when a CSV file is uploaded */
  onCsvReady: (csvText: string, fileName: string) => void
  /** Called when user clears the pending image */
  onClear: () => void
  /** Whether the image is currently being sent/analyzed */
  isSending: boolean
  /** Currently staged image (base64 data URL for preview) */
  stagedPreview: string | null
  /** Currently staged CSV file name (when a CSV is queued) */
  stagedCsvName: string | null
}

/**
 * Chat image upload component with:
 * - Drag-and-drop overlay on the chat window
 * - Click-to-upload button in the input bar
 * - Thumbnail preview before sending
 */
export function ChatImageUpload({
  onImageReady,
  onCsvReady,
  onClear,
  isSending,
  stagedPreview,
  stagedCsvName,
}: ChatImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return

    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const csvText = typeof ev.target?.result === 'string' ? ev.target.result : ''
        if (!csvText.trim()) return
        onCsvReady(csvText, file.name)
      }
      reader.readAsText(file)
      return
    }

    // Validate type
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) return

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) return

    // Convert to base64
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) return
      // Extract raw base64 without the data URL prefix
      const base64 = dataUrl.split(',')[1]
      onImageReady(base64, file.type)
    }
    reader.readAsDataURL(file)
  }, [onCsvReady, onImageReady])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }, [handleFileSelect])

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,.csv,text/csv"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Upload button (shown in input bar) */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isSending}
        className={cn(
          'p-2 rounded-lg transition-all',
          stagedPreview || stagedCsvName
            ? 'text-emerald-400 bg-emerald-500/10'
            : 'text-white/30 hover:text-white/60 hover:bg-white/5',
          isSending && 'opacity-50 cursor-not-allowed'
        )}
        title="Upload screenshot or CSV"
      >
        <ImagePlus className="w-5 h-5" />
      </button>

      {/* Thumbnail preview strip (shown above input when image is staged) */}
      {(stagedPreview || stagedCsvName) && (
        <div className="absolute -top-16 left-3 right-3 flex items-center gap-3 p-2 rounded-lg bg-black/40 border border-white/10 backdrop-blur-md">
          {stagedPreview ? (
            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-white/10 shrink-0">
              <Image
                src={stagedPreview}
                alt="Upload preview"
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex w-10 h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 shrink-0">
              <FileText className="w-4 h-4 text-emerald-300" />
            </div>
          )}
          <span className="text-xs text-white/50 truncate flex-1">
            {stagedPreview ? 'Screenshot ready to send' : `${stagedCsvName} ready to send`}
          </span>
          {isSending ? (
            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          ) : (
            <button
              onClick={onClear}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Full-screen drag-and-drop overlay for the chat area.
 * Mounts as a portal over the chat container.
 */
export function ChatDropOverlay({
  containerRef,
  onFileDrop,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  onFileDrop: (file: File) => void
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCountRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCountRef.current++
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragOver(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCountRef.current--
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0
        setIsDragOver(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCountRef.current = 0
      setIsDragOver(false)

      const file = e.dataTransfer?.files?.[0]
      const isCsv = file?.type === 'text/csv' || file?.name.toLowerCase().endsWith('.csv')
      if (file && (file.type.startsWith('image/') || isCsv)) {
        onFileDrop(file)
      }
    }

    container.addEventListener('dragenter', handleDragEnter)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragenter', handleDragEnter)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
    }
  }, [containerRef, onFileDrop])

  if (!isDragOver) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm border-2 border-dashed border-emerald-500/50 rounded-xl pointer-events-none">
      <div className="text-center">
        <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-3 animate-pulse" />
        <p className="text-sm font-medium text-white">Drop screenshot or CSV</p>
        <p className="text-xs text-white/40 mt-1">PNG, JPEG, WebP, GIF, or CSV up to 10MB</p>
      </div>
    </div>
  )
}
