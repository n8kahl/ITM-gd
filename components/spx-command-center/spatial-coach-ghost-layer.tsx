'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { extractSpatialCoachAnchors, type SpatialCoachAnchorMessage } from '@/lib/spx/spatial-hud'
import type { CoachMessage } from '@/lib/types/spx-command-center'

interface SpatialCoachGhostLayerProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface GhostRenderItem {
  id: string
  anchorPrice: number
  anchorX: number
  anchorY: number
  cardX: number
  cardY: number
  path: string
  title: string
  excerpt: string
}

interface GhostRenderState {
  width: number
  height: number
  items: GhostRenderItem[]
}

const GHOST_REFRESH_INTERVAL_MS = 180
const MAX_GHOST_ITEMS = 2

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function renderStateEquals(left: GhostRenderState | null, right: GhostRenderState | null): boolean {
  if (!left || !right) return left === right
  if (left.width !== right.width || left.height !== right.height || left.items.length !== right.items.length) return false
  for (let index = 0; index < left.items.length; index += 1) {
    const l = left.items[index]
    const r = right.items[index]
    if (!l || !r) return false
    if (
      l.id !== r.id
      || l.anchorX !== r.anchorX
      || l.anchorY !== r.anchorY
      || l.cardX !== r.cardX
      || l.cardY !== r.cardY
      || l.path !== r.path
      || l.title !== r.title
      || l.excerpt !== r.excerpt
      || l.anchorPrice !== r.anchorPrice
    ) {
      return false
    }
  }
  return true
}

function titleForMessage(message: CoachMessage): string {
  if (message.priority === 'alert') return 'AI Alert'
  if (message.type === 'in_trade') return 'In-Trade Brief'
  if (message.type === 'pre_trade') return 'Pre-Trade Brief'
  return 'AI Coach'
}

function sliceExcerpt(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= 120) return trimmed
  return `${trimmed.slice(0, 120)}...`
}

function buildFallbackAnchors(
  setup: ReturnType<typeof useSPXSetupContext>['selectedSetup'],
  coachMessages: CoachMessage[],
): SpatialCoachAnchorMessage<CoachMessage>[] {
  if (!setup) return []
  const latestMessage = coachMessages[0]
  if (!latestMessage) return []
  const entryMid = (setup.entryZone.low + setup.entryZone.high) / 2
  if (!Number.isFinite(entryMid)) return []
  return [{ message: latestMessage, anchorPrice: entryMid }]
}

export function SpatialCoachGhostLayer({ coordinatesRef }: SpatialCoachGhostLayerProps) {
  const { coachMessages } = useSPXCoachContext()
  const { selectedSetup } = useSPXSetupContext()
  const [renderState, setRenderState] = useState<GhostRenderState | null>(null)

  const sourceAnchors = useMemo(() => {
    const anchored = extractSpatialCoachAnchors(coachMessages, { maxNodes: MAX_GHOST_ITEMS })
    if (anchored.length > 0) return anchored
    return buildFallbackAnchors(selectedSetup, coachMessages)
  }, [coachMessages, selectedSetup])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || sourceAnchors.length === 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const width = coordinates.chartDimensions.width
    const height = coordinates.chartDimensions.height
    if (width <= 0 || height <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const items: GhostRenderItem[] = []
    for (let index = 0; index < sourceAnchors.length; index += 1) {
      const item = sourceAnchors[index]
      if (!item) continue
      const anchorY = coordinates.priceToPixel(item.anchorPrice)
      if (anchorY == null || anchorY < 36 || anchorY > height - 36) continue

      const anchorX = width * (0.64 + (index * 0.04))
      const cardX = clamp(width * 0.34 - (index * 20), 20, width - 250)
      const cardY = clamp(anchorY - 46 - (index * 64), 16, height - 110)
      const cardAttachX = cardX + 220
      const cardAttachY = cardY + 32
      const controlX1 = anchorX - 40
      const controlX2 = cardAttachX + 28
      const path = `M${anchorX},${anchorY} C${controlX1},${anchorY} ${controlX2},${cardAttachY} ${cardAttachX},${cardAttachY}`

      items.push({
        id: item.message.id,
        anchorPrice: item.anchorPrice,
        anchorX,
        anchorY,
        cardX,
        cardY,
        path,
        title: titleForMessage(item.message),
        excerpt: sliceExcerpt(item.message.content),
      })
    }

    const nextState: GhostRenderState = { width, height, items }
    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, sourceAnchors])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }

    tick()
    const intervalId = window.setInterval(tick, GHOST_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [refreshRenderState])

  if (!renderState || renderState.items.length === 0) return null

  return (
    <div className="absolute inset-0 z-[21] pointer-events-none" data-testid="spx-spatial-ghost-layer" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${renderState.width} ${renderState.height}`}>
        {renderState.items.map((item) => (
          <path
            key={`path-${item.id}`}
            d={item.path}
            fill="none"
            stroke="#F5EDCC"
            strokeOpacity={0.28}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
      </svg>

      {renderState.items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="glass-card-heavy absolute w-[220px] rounded-xl px-3 py-2.5 pointer-events-auto text-left"
          style={{ left: item.cardX, top: item.cardY }}
          data-testid="spx-coach-ghost-card"
          aria-label={`Open ghost brief at ${item.anchorPrice.toFixed(0)}`}
          onClick={() => {
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_GHOST_INTERACTION, {
              messageId: item.id,
              anchorPrice: item.anchorPrice,
            })
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-champagne/90">{item.title}</span>
            <span className="text-[8px] font-mono text-white/45">@ {item.anchorPrice.toFixed(0)}</span>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-white/78">{item.excerpt}</p>
        </button>
      ))}
    </div>
  )
}
