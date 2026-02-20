'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { resolveSpatialAnchorX, type SpatialAnchorMode } from '@/lib/spx/spatial-hud'

interface SpatialCoachNodeProps {
  message: CoachMessage
  anchorPrice: number
  anchorTimeSec: number | null
  fallbackIndex: number
  yOffsetPx?: number
  popoverLane?: number
  getCoordinates: () => ChartCoordinateAPI | null
  onDismiss: (id: string) => void
  onAction: (actionId: string, messageId: string) => void
  onExpand?: (messageId: string, expanded: boolean, anchorMode: SpatialAnchorMode) => void
  onAnchorModeChange?: (messageId: string, anchorMode: SpatialAnchorMode) => void
}

export function SpatialCoachNode({
  message,
  anchorPrice,
  anchorTimeSec,
  fallbackIndex,
  yOffsetPx = 0,
  popoverLane = 0,
  getCoordinates,
  onDismiss,
  onAction,
  onExpand,
  onAnchorModeChange,
}: SpatialCoachNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const lastAnchorModeRef = useRef<SpatialAnchorMode | null>(null)
  const coordinates = getCoordinates()
  const anchorXResolution = resolveSpatialAnchorX({
    width: coordinates?.chartDimensions.width || 0,
    fallbackIndex,
    anchorTimeSec,
    timeToPixel: coordinates?.timeToPixel || (() => null),
  })

  useEffect(() => {
    if (!coordinates?.ready) return
    if (lastAnchorModeRef.current === anchorXResolution.mode) return
    lastAnchorModeRef.current = anchorXResolution.mode
    onAnchorModeChange?.(message.id, anchorXResolution.mode)
  }, [anchorXResolution.mode, coordinates?.ready, message.id, onAnchorModeChange])

  if (!coordinates?.ready) return null

  const baseY = coordinates.priceToPixel(anchorPrice)
  if (baseY == null || baseY < 48 || baseY > coordinates.chartDimensions.height - 48) return null

  const x = anchorXResolution.x
  const y = baseY + yOffsetPx

  const isBearish = message.type === 'pre_trade' && message.content.toLowerCase().includes('fade')
  const color = isBearish ? '#FB7185' : '#10B981'
  const popoverWidth = 260
  const openToLeft = x + popoverWidth + 32 > coordinates.chartDimensions.width
  const popoverX = openToLeft ? -(popoverWidth + 20) : 20
  const popoverTop = -62 + (Math.min(popoverLane, 4) * 10)
  const connectorLength = Math.max(24, openToLeft ? x - 56 : coordinates.chartDimensions.width - x - 80)

  return (
    <div
      className="pointer-events-auto absolute z-20"
      style={{ left: x, top: y, transform: 'translate(-16px, -16px)' }}
      data-testid="spx-spatial-coach-node"
      data-anchor-mode={anchorXResolution.mode}
    >
      <svg
        className="pointer-events-none absolute"
        style={{ left: 16, top: 16, overflow: 'visible' }}
        width={1}
        height={1}
      >
        <line
          x1={0}
          y1={0}
          x2={openToLeft ? -connectorLength : connectorLength}
          y2={0}
          stroke={color}
          strokeWidth={0.5}
          strokeOpacity={0.25}
          strokeDasharray="2 4"
        />
      </svg>

      <button
        type="button"
        onClick={() => {
          const next = !expanded
          setExpanded(next)
          onExpand?.(message.id, next, anchorXResolution.mode)
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full"
        aria-label={`Toggle AI coach node at ${anchorPrice.toFixed(0)}`}
      >
        <span
          className="h-3.5 w-3.5 rounded-full"
          style={{
            background: color,
            border: '2px solid #0A0A0B',
            boxShadow: `0 0 12px ${color}66, 0 0 4px ${color}`,
            animation: 'spatial-pulse 2s ease-in-out infinite',
          }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, x: popoverX }}
            animate={{ opacity: 1, scale: 1, x: popoverX }}
            exit={{ opacity: 0, scale: 0.92, x: popoverX }}
            className="glass-card-heavy absolute z-50 w-[260px] rounded-xl p-3.5"
            style={{ left: 0, top: popoverTop }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.1em]" style={{ color: `${color}cc` }}>
                AI Coach
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-white/35">@ {anchorPrice.toFixed(0)}</span>
                {anchorXResolution.mode === 'fallback' && (
                  <span className="rounded border border-champagne/35 bg-champagne/12 px-1 py-0.5 text-[7px] font-mono uppercase tracking-[0.08em] text-champagne">
                    Fallback
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss(message.id)}
                  className="min-h-[36px] rounded-md p-1 text-white/30 transition-colors hover:text-white/60"
                  aria-label="Dismiss spatial coach node"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-white/80">
              {message.content.slice(0, 220)}
              {message.content.length > 220 ? '...' : ''}
            </p>
            <div className="mt-2.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => onAction('stage_trade', message.id)}
                className="min-h-[36px] rounded-md border px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.06em] transition-colors"
                style={{
                  background: `${color}15`,
                  borderColor: `${color}33`,
                  color,
                }}
              >
                Stage Trade
              </button>
              <button
                type="button"
                onClick={() => onAction('details', message.id)}
                className="min-h-[36px] rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.06em] text-white/50 transition-colors hover:text-white/70"
              >
                Details
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
