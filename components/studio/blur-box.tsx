"use client"

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlurBoxProps {
  id: string
  initialX?: number
  initialY?: number
  initialWidth?: number
  initialHeight?: number
  onDelete: (id: string) => void
  containerBounds?: DOMRect | null
}

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export function BlurBox({
  id,
  initialX = 50,
  initialY = 50,
  initialWidth = 200,
  initialHeight = 100,
  onDelete,
  containerBounds,
}: BlurBoxProps) {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight })
  const [isResizing, setIsResizing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const isSelected = selectedId === id

  useEffect(() => {
    const handlePointerAway = (event: PointerEvent) => {
      if (!boxRef.current) return
      if (boxRef.current.contains(event.target as Node)) return
      setSelectedId(null)
    }

    document.addEventListener('pointerdown', handlePointerAway)
    return () => document.removeEventListener('pointerdown', handlePointerAway)
  }, [])

  const handleResize = (e: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(id)
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      let newWidth = startWidth
      let newHeight = startHeight

      if (corner.includes('right')) {
        newWidth = Math.max(100, startWidth + deltaX)
      }
      if (corner.includes('left')) {
        newWidth = Math.max(100, startWidth - deltaX)
      }
      if (corner.includes('bottom')) {
        newHeight = Math.max(60, startHeight + deltaY)
      }
      if (corner.includes('top')) {
        newHeight = Math.max(60, startHeight - deltaY)
      }

      setSize({ width: newWidth, height: newHeight })
    }

    const handlePointerUp = () => {
      setIsResizing(false)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <motion.div
      ref={boxRef}
      drag={!isResizing}
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={containerBounds ? {
        left: 0,
        right: containerBounds.width - size.width,
        top: 0,
        bottom: containerBounds.height - size.height,
      } : undefined}
      initial={{ x: initialX, y: initialY }}
      onPointerDown={() => setSelectedId(id)}
      className={cn(
        "absolute z-20 border-2 border-emerald-500/50 rounded-lg group touch-action-none",
        isSelected && 'ring-2 ring-emerald-400/70',
        isResizing ? "cursor-nwse-resize" : "cursor-move"
      )}
      style={{
        width: size.width,
        height: size.height,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(id)
        }}
        className={cn(
          "absolute -top-4 -right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white transition-opacity duration-200 hover:bg-red-600 touch-manipulation",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        )}
        aria-label="Delete privacy blur"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Drag handle (center) */}
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50 transition-opacity duration-200 pointer-events-none",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <GripVertical className="w-6 h-6" />
      </div>

      {/* Resize handles */}
      {/* Top-left */}
      <button
        type="button"
        onPointerDown={(e) => handleResize(e, 'top-left')}
        className={cn(
          "absolute -top-4 -left-4 z-30 flex h-11 w-11 items-center justify-center cursor-nwse-resize touch-manipulation transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label="Resize privacy blur from top left"
      >
        <span className="h-3 w-3 rounded-full bg-emerald-500" />
      </button>

      {/* Top-right */}
      <button
        type="button"
        onPointerDown={(e) => handleResize(e, 'top-right')}
        className={cn(
          "absolute -top-4 -right-4 z-30 flex h-11 w-11 items-center justify-center cursor-nesw-resize touch-manipulation transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label="Resize privacy blur from top right"
      >
        <span className="h-3 w-3 rounded-full bg-emerald-500" />
      </button>

      {/* Bottom-left */}
      <button
        type="button"
        onPointerDown={(e) => handleResize(e, 'bottom-left')}
        className={cn(
          "absolute -bottom-4 -left-4 z-30 flex h-11 w-11 items-center justify-center cursor-nesw-resize touch-manipulation transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label="Resize privacy blur from bottom left"
      >
        <span className="h-3 w-3 rounded-full bg-emerald-500" />
      </button>

      {/* Bottom-right */}
      <button
        type="button"
        onPointerDown={(e) => handleResize(e, 'bottom-right')}
        className={cn(
          "absolute -bottom-4 -right-4 z-30 flex h-11 w-11 items-center justify-center cursor-nwse-resize touch-manipulation transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
        )}
        aria-label="Resize privacy blur from bottom right"
      >
        <span className="h-3 w-3 rounded-full bg-emerald-500" />
      </button>

      {/* Privacy indicator */}
      <div
        className={cn(
          "absolute bottom-2 right-2 text-xs text-white/40 transition-opacity pointer-events-none",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        Privacy Blur
      </div>
    </motion.div>
  )
}
