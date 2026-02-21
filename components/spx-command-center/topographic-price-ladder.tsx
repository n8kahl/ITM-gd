'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildTopographicLadderEntries } from '@/lib/spx/spatial-hud'

interface TopographicPriceLadderProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

const MAX_LADDER_ENTRIES = 14
const LADDER_BLOCK_MIN_WIDTH = 20
const LADDER_BLOCK_MAX_WIDTH = 58
const LADDER_BLOCK_HEIGHT = 11
const LADDER_REFRESH_INTERVAL_MS = 120

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface LadderRenderEntry {
  id: string
  top: number
  width: number
  color: string
  priceLabel: string
  showLabel: boolean
}

interface LadderRenderState {
  laneHeight: number
  livePriceY: number | null
  entries: LadderRenderEntry[]
}

function renderStateEquals(left: LadderRenderState | null, right: LadderRenderState | null): boolean {
  if (!left || !right) return left === right
  if (left.laneHeight !== right.laneHeight || left.livePriceY !== right.livePriceY) return false
  if (left.entries.length !== right.entries.length) return false

  for (let index = 0; index < left.entries.length; index += 1) {
    const l = left.entries[index]
    const r = right.entries[index]
    if (!l || !r) return false
    if (
      l.id !== r.id
      || l.top !== r.top
      || l.width !== r.width
      || l.color !== r.color
      || l.priceLabel !== r.priceLabel
      || l.showLabel !== r.showLabel
    ) {
      return false
    }
  }

  return true
}

export function TopographicPriceLadder({ coordinatesRef }: TopographicPriceLadderProps) {
  const { levels } = useSPXAnalyticsContext()
  const { spxPrice } = useSPXPriceContext()
  const [renderState, setRenderState] = useState<LadderRenderState | null>(null)

  const ladderEntries = useMemo(() => buildTopographicLadderEntries(
    levels.map((level) => ({
      id: level.id,
      price: level.price,
      strength: level.strength,
      type: level.category,
      color: level.chartStyle.color,
    })),
    spxPrice,
    MAX_LADDER_ENTRIES,
  ), [levels, spxPrice])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || ladderEntries.length === 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const laneHeight = coordinates.chartDimensions.height
    if (laneHeight <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const entries: LadderRenderEntry[] = []
    for (const [index, entry] of ladderEntries.entries()) {
      const y = coordinates.priceToPixel(entry.price)
      if (y == null || y < 0 || y > laneHeight) continue
      const width = clamp(entry.weight * 22, LADDER_BLOCK_MIN_WIDTH, LADDER_BLOCK_MAX_WIDTH)
      const top = clamp(y - (LADDER_BLOCK_HEIGHT / 2), 0, laneHeight - LADDER_BLOCK_HEIGHT)
      entries.push({
        id: entry.id,
        top,
        width,
        color: entry.color,
        priceLabel: entry.price.toFixed(0),
        showLabel: index < 3,
      })
    }

    const livePriceY = coordinates.priceToPixel(spxPrice)
    const normalizedLivePriceY = livePriceY != null && livePriceY >= 0 && livePriceY <= laneHeight
      ? livePriceY
      : null

    const nextState: LadderRenderState = {
      laneHeight,
      livePriceY: normalizedLivePriceY,
      entries,
    }

    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, ladderEntries, spxPrice])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }

    tick()
    const intervalId = window.setInterval(tick, LADDER_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [refreshRenderState])

  if (!renderState || renderState.entries.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-[72px] z-[9] w-[64px]"
      data-testid="spx-topographic-ladder"
      aria-hidden
    >
      <div className="absolute inset-y-0 right-0 w-[56px] rounded-l-xl border-l border-white/10 bg-gradient-to-l from-white/[0.04] via-white/[0.012] to-transparent" />

      {renderState.entries.map((entry) => (
        <div
          key={entry.id}
          className="absolute right-1"
          style={{ top: entry.top, width: entry.width, height: LADDER_BLOCK_HEIGHT }}
        >
          <div
            className="h-full rounded-l-md border border-white/10 shadow-[0_0_8px_rgba(0,0,0,0.25)]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${entry.color}70 100%)`,
            }}
          />
          {entry.showLabel && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 font-mono text-[8px] text-white/62">
              {entry.priceLabel}
            </span>
          )}
        </div>
      ))}

      {renderState.livePriceY != null && (
        <div
          className="absolute right-0 h-[1px] w-[56px] bg-emerald-300/60 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          style={{ top: renderState.livePriceY }}
          data-testid="spx-topographic-needle"
        />
      )}
    </div>
  )
}
