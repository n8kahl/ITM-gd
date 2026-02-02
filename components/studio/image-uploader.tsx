"use client"

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface ImageUploaderProps {
  onImageSelect: (file: File, preview: string) => void
  currentPreview?: string | null
  onClear?: () => void
  maxSize?: number // in bytes
}

export function ImageUploader({
  onImageSelect,
  currentPreview,
  onClear,
  maxSize = 5 * 1024 * 1024, // 5MB default
}: ImageUploaderProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setError(null)

      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${maxSize / 1024 / 1024}MB`)
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Invalid file type. Please upload PNG, JPEG, or WebP images.')
        } else {
          setError('Failed to upload file. Please try again.')
        }
        return
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        const preview = URL.createObjectURL(file)
        onImageSelect(file, preview)
      }
    },
    [onImageSelect, maxSize]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxSize,
    multiple: false,
  })

  if (currentPreview) {
    return (
      <div className="relative">
        <div className="glass-card-heavy rounded-2xl p-4 border border-white/10">
          <div className="relative max-h-96 flex items-center justify-center overflow-hidden rounded-xl">
            <img
              src={currentPreview}
              alt="Uploaded preview"
              className="max-h-96 w-auto object-contain"
            />
          </div>
          {onClear && (
            <Button
              onClick={onClear}
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Image
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "glass-card-heavy rounded-2xl p-8 border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragActive
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-white/20 hover:border-emerald-500/50 hover:bg-white/5"
        )}
      >
        <input {...getInputProps()} />
        <div className="text-center py-12">
          <Upload className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">
            {isDragActive ? 'Drop your image here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-sm text-white/60">
            PNG, JPEG, or WebP (max {maxSize / 1024 / 1024}MB)
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}
