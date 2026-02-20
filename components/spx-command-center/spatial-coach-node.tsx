'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'

interface SpatialCoachNodeProps {
  message: CoachMessage
  anchorPrice: number
  getCoordinates: () => ChartCoordinateAPI | null
  onDismiss: (id: string) => void
  onAction: (actionId: string, messageId: string) => void
  onExpand?: (messageId: string, expanded: boolean) => void
}

export function SpatialCoachNode({
  message,
  anchorPrice,
  getCoordinates,
  onDismiss,
  onAction,
  onExpand,
}: SpatialCoachNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const coordinates = getCoordinates()
  if (!coordinates?.ready) return null

  const y = coordinates.priceToPixel(anchorPrice)
  if (y == null || y < 48 || y > coordinates.chartDimensions.height - 48) return null

  const x = coordinates.chartDimensions.width * 0.65
  const isBearish = message.type === 'pre_trade' && message.content.toLowerCase().includes('fade')
  const color = isBearish ? '#FB7185' : '#10B981'

  return (
    <div className="pointer-events-auto absolute z-20" style={{ left: x, top: y, transform: 'translate(-16px, -16px)' }}>
      <svg
        className="pointer-events-none absolute"
        style={{ left: 16, top: 16, overflow: 'visible' }}
        width={1}
        height={1}
      >
        <line
          x1={0}
          y1={0}
          x2={coordinates.chartDimensions.width - x - 80}
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
          onExpand?.(message.id, next)
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
            initial={{ opacity: 0, scale: 0.92, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 20 }}
            exit={{ opacity: 0, scale: 0.92, x: 20 }}
            className="glass-card-heavy absolute left-5 top-[-62px] z-50 w-[260px] rounded-xl p-3.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.1em]" style={{ color: `${color}cc` }}>
                AI Coach
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-mono text-white/35">@ {anchorPrice.toFixed(0)}</span>
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
