"use client"

import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { Download, Plus, BadgeCheck } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ImageUploader } from './image-uploader'
import { BlurBox } from './blur-box'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

interface BlurBoxData {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function ScreenshotWrapper() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [blurBoxes, setBlurBoxes] = useState<BlurBoxData[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleImageSelect = useCallback((file: File, preview: string) => {
    setUploadedImage(preview)
    setBlurBoxes([]) // Clear blur boxes when new image uploaded

    // Get container bounds after image loads
    setTimeout(() => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect())
      }
    }, 100)
  }, [])

  const handleClearImage = useCallback(() => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage)
    }
    setUploadedImage(null)
    setBlurBoxes([])
    setContainerBounds(null)
  }, [uploadedImage])

  const addBlurBox = useCallback(() => {
    const newBox: BlurBoxData = {
      id: `blur-${Date.now()}`,
      x: 50,
      y: 50,
      width: 200,
      height: 100,
    }
    setBlurBoxes((prev) => [...prev, newBox])
  }, [])

  const deleteBlurBox = useCallback((id: string) => {
    setBlurBoxes((prev) => prev.filter((box) => box.id !== id))
  }, [])

  const exportImage = async () => {
    if (!canvasRef.current) return

    setIsExporting(true)
    try {
      const dataUrl = await toPng(canvasRef.current, {
        quality: 1.0,
        pixelRatio: 2, // 2x for Retina displays
        backgroundColor: '#050505',
        cacheBust: true,
      })

      // Trigger download
      const link = document.createElement('a')
      link.download = `tradeitm-wrapped-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to export image:', error)
      alert('Failed to export image. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif text-white mb-2">Screenshot Wrapper</h2>
        <p className="text-white/60">
          Frame your trading screenshots with TradeITM branding and privacy blur.
        </p>
      </div>

      {/* Upload section */}
      {!uploadedImage ? (
        <ImageUploader
          onImageSelect={handleImageSelect}
          currentPreview={uploadedImage}
          onClear={handleClearImage}
        />
      ) : (
        <div className="space-y-4">
          {/* Canvas with frame */}
          <div ref={canvasRef} className="relative bg-[#050505] p-8 rounded-3xl">
            {/* Emerald glass frame */}
            <div className="absolute inset-0 border-[8px] border-emerald-500/30 rounded-3xl backdrop-blur-xl pointer-events-none z-10" />

            {/* Champagne accent line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#F3E5AB] to-transparent pointer-events-none z-10" />

            {/* Image container */}
            <div ref={containerRef} className="relative rounded-2xl overflow-hidden">
              <img
                src={uploadedImage}
                alt="Uploaded screenshot"
                className="w-full h-auto rounded-2xl relative z-0"
              />

              {/* Blur boxes */}
              {blurBoxes.map((box) => (
                <BlurBox
                  key={box.id}
                  id={box.id}
                  initialX={box.x}
                  initialY={box.y}
                  initialWidth={box.width}
                  initialHeight={box.height}
                  onDelete={deleteBlurBox}
                  containerBounds={containerBounds}
                />
              ))}
            </div>

            {/* Verified badge */}
            <div className="absolute top-12 right-12 glass-card-heavy px-4 py-2 rounded-full border border-emerald-500/30 z-10">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-white">TradeITM Verified</span>
              </div>
            </div>

            {/* Logo watermark */}
            <div className="absolute bottom-10 right-10 opacity-50 z-10">
              <Image
                src={BRAND_LOGO_SRC}
                width={60}
                height={60}
                alt={BRAND_NAME}
                className="pointer-events-none"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={addBlurBox} variant="outline" size="default">
              <Plus className="w-4 h-4 mr-2" />
              Add Privacy Blur
            </Button>

            <Button onClick={handleClearImage} variant="outline" size="default">
              Upload Different Image
            </Button>

            <Button
              onClick={exportImage}
              disabled={isExporting}
              variant="default"
              size="default"
              className="ml-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export PNG'}
            </Button>
          </div>

          {/* Instructions */}
          <div className="glass-card-heavy p-4 rounded-xl border border-white/10">
            <p className="text-sm text-white/60">
              <span className="text-emerald-500 font-medium">Tip:</span> Click &quot;Add Privacy Blur&quot; to hide sensitive information like account numbers. Drag to position, resize from corners, and delete with the X button.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
