'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
}

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false })

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMouse({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
    })
  }

  const handleMouseLeave = () => {
    setMouse((current) => ({ ...current, active: false }))
  }

  const borderSpotlight: CSSProperties = {
    background: mouse.active
      ? `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, rgba(245,237,204,0.15), transparent 40%)`
      : undefined,
    opacity: mouse.active ? 1 : 0,
    WebkitMask:
      'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    padding: '1px',
  }

  const surfaceSpotlight: CSSProperties = {
    background: mouse.active
      ? `radial-gradient(800px circle at ${mouse.x}px ${mouse.y}px, rgba(255,255,255,0.06), transparent 40%)`
      : undefined,
    opacity: mouse.active ? 1 : 0,
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        'group relative rounded-xl border border-white/[0.12] transition-colors duration-300',
        className,
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={surfaceSpotlight}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={borderSpotlight}
      />
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  )
}
