"use client"

import { useState } from 'react'
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

  const handleResize = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startY = e.clientY
    const startWidth = size.width
    const startHeight = size.height

    const handleMouseMove = (moveEvent: MouseEvent) => {
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

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={containerBounds ? {
        left: 0,
        right: containerBounds.width - size.width,
        top: 0,
        bottom: containerBounds.height - size.height,
      } : undefined}
      initial={{ x: initialX, y: initialY }}
      className={cn(
        "absolute z-20 border-2 border-emerald-500/50 rounded-lg group",
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
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 z-30"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Drag handle (center) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <GripVertical className="w-6 h-6" />
      </div>

      {/* Resize handles */}
      {/* Top-left */}
      <div
        onMouseDown={(e) => handleResize(e, 'top-left')}
        className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-emerald-500 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      {/* Top-right */}
      <div
        onMouseDown={(e) => handleResize(e, 'top-right')}
        className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      {/* Bottom-left */}
      <div
        onMouseDown={(e) => handleResize(e, 'bottom-left')}
        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-emerald-500 rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      {/* Bottom-right */}
      <div
        onMouseDown={(e) => handleResize(e, 'bottom-right')}
        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

      {/* Privacy indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-white/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        Privacy Blur
      </div>
    </motion.div>
  )
}
