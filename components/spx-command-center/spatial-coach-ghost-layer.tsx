'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import {
  evolveSpatialGhostLifecycle,
  extractSpatialCoachAnchors,
  parseIsoToUnixSeconds,
  resolveSpatialAnchorX,
  spatialGhostLifecycleEquals,
  type SpatialAnchorMode,
  type SpatialCoachAnchorMessage,
  type SpatialGhostLifecycleMap,
  type SpatialGhostLifecycleState,
} from '@/lib/spx/spatial-hud'
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
  lifecycleState: SpatialGhostLifecycleState
  anchorMode: SpatialAnchorMode
}

interface GhostRenderState {
  width: number
  height: number
  items: GhostRenderItem[]
}

const GHOST_REFRESH_INTERVAL_MS = 180
const GHOST_LIFECYCLE_TICK_MS = 240
const MAX_GHOST_ITEMS = 2
const MAX_RENDER_ITEMS = 3

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
      || l.lifecycleState !== r.lifecycleState
      || l.anchorMode !== r.anchorMode
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
  const [lifecycleMap, setLifecycleMap] = useState<SpatialGhostLifecycleMap>({})
  const anchorSnapshotRef = useRef<Record<string, SpatialCoachAnchorMessage<CoachMessage>>>({})
  const previousLifecycleRef = useRef<SpatialGhostLifecycleMap>({})
  const anchorModeByIdRef = useRef<Record<string, SpatialAnchorMode>>({})

  const sourceAnchors = useMemo(() => {
    const anchored = extractSpatialCoachAnchors(coachMessages, { maxNodes: MAX_GHOST_ITEMS })
    if (anchored.length > 0) return anchored
    return buildFallbackAnchors(selectedSetup, coachMessages)
  }, [coachMessages, selectedSetup])

  useEffect(() => {
    const nextSnapshots: Record<string, SpatialCoachAnchorMessage<CoachMessage>> = {
      ...anchorSnapshotRef.current,
    }
    for (const anchor of sourceAnchors) {
      nextSnapshots[anchor.message.id] = anchor
    }
    anchorSnapshotRef.current = nextSnapshots
  }, [sourceAnchors])

  useEffect(() => {
    const tickLifecycle = () => {
      const nowMs = Date.now()
      const visibleIds = sourceAnchors.map((anchor) => anchor.message.id)
      setLifecycleMap((previous) => {
        const next = evolveSpatialGhostLifecycle(previous, visibleIds, nowMs)
        return spatialGhostLifecycleEquals(previous, next) ? previous : next
      })
    }

    tickLifecycle()
    const intervalId = window.setInterval(tickLifecycle, GHOST_LIFECYCLE_TICK_MS)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [sourceAnchors])

  useEffect(() => {
    const previous = previousLifecycleRef.current
    const ids = new Set([...Object.keys(previous), ...Object.keys(lifecycleMap)])

    for (const id of ids) {
      const previousState = previous[id]?.state || null
      const nextState = lifecycleMap[id]?.state || null
      if (previousState === nextState || !nextState) continue
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_GHOST_STATE_CHANGED, {
        messageId: id,
        previousState,
        nextState,
      })
    }

    previousLifecycleRef.current = lifecycleMap
  }, [lifecycleMap])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || Object.keys(lifecycleMap).length === 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const width = coordinates.chartDimensions.width
    const height = coordinates.chartDimensions.height
    if (width <= 0 || height <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const orderedIds = Object.entries(lifecycleMap)
      .sort((left, right) => right[1].firstSeenMs - left[1].firstSeenMs)
      .map(([id]) => id)
      .slice(0, MAX_RENDER_ITEMS)

    const items: GhostRenderItem[] = []
    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index]
      if (!id) continue
      const lifecycleNode = lifecycleMap[id]
      const anchor = anchorSnapshotRef.current[id]
      if (!lifecycleNode || !anchor) continue

      const anchorY = coordinates.priceToPixel(anchor.anchorPrice)
      if (anchorY == null || anchorY < 36 || anchorY > height - 36) continue

      const anchorTimeSec = parseIsoToUnixSeconds(anchor.message.timestamp)
      const anchorXResolution = resolveSpatialAnchorX({
        width,
        fallbackIndex: index,
        anchorTimeSec,
        timeToPixel: coordinates.timeToPixel,
      })
      const anchorX = anchorXResolution.x
      const cardX = clamp(anchorX - 252, 20, width - 250)
      const cardY = clamp(anchorY - 46 - (index * 66), 16, height - 114)
      const cardAttachX = cardX + 220
      const cardAttachY = cardY + 32
      const controlX1 = clamp(anchorX - 42, 12, width - 12)
      const controlX2 = clamp(cardAttachX + 26, 12, width - 12)
      const path = `M${anchorX},${anchorY} C${controlX1},${anchorY} ${controlX2},${cardAttachY} ${cardAttachX},${cardAttachY}`

      const previousAnchorMode = anchorModeByIdRef.current[id]
      if (previousAnchorMode !== anchorXResolution.mode) {
        anchorModeByIdRef.current[id] = anchorXResolution.mode
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_GHOST_ANCHOR_MODE, {
          messageId: id,
          anchorMode: anchorXResolution.mode,
          anchorTimeSec,
        })
      }

      items.push({
        id: anchor.message.id,
        anchorPrice: anchor.anchorPrice,
        anchorX,
        anchorY,
        cardX,
        cardY,
        path,
        title: titleForMessage(anchor.message),
        excerpt: sliceExcerpt(anchor.message.content),
        lifecycleState: lifecycleNode.state,
        anchorMode: anchorXResolution.mode,
      })
    }

    const nextState: GhostRenderState = { width, height, items }
    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, lifecycleMap])

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
            strokeOpacity={item.lifecycleState === 'fading' ? 0.16 : 0.28}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
      </svg>

      {renderState.items.map((item) => {
        const fading = item.lifecycleState === 'fading'
        const entering = item.lifecycleState === 'entering'

        return (
          <button
            key={item.id}
            type="button"
            className="glass-card-heavy absolute w-[220px] rounded-xl px-3 py-2.5 pointer-events-auto text-left transition-all duration-300"
            style={{
              left: item.cardX,
              top: item.cardY,
              opacity: fading ? 0.45 : 1,
              transform: entering ? 'translateY(-4px)' : 'translateY(0)',
              borderColor: entering ? 'rgba(245,237,204,0.25)' : undefined,
            }}
            data-testid="spx-coach-ghost-card"
            data-anchor-mode={item.anchorMode}
            data-lifecycle-state={item.lifecycleState}
            aria-label={`Open ghost brief at ${item.anchorPrice.toFixed(0)}`}
            onClick={() => {
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_GHOST_INTERACTION, {
                messageId: item.id,
                anchorPrice: item.anchorPrice,
                anchorMode: item.anchorMode,
                lifecycleState: item.lifecycleState,
              })
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-champagne/90">{item.title}</span>
              <span className="text-[8px] font-mono text-white/45">@ {item.anchorPrice.toFixed(0)}</span>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/78">{item.excerpt}</p>
          </button>
        )
      })}
    </div>
  )
}
