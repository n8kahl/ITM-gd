'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildRiskRewardShadowGeometry } from '@/lib/spx/spatial-hud'

interface RiskRewardShadowOverlayProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface RenderBand {
  id: string
  top: number
  height: number
  color: string
}

interface ShadowRenderState {
  left: number
  width: number
  entryLineY: number
  bands: RenderBand[]
  rrToT1: number | null
  rrToT2: number | null
  badgeLeft: number
  badgeTop: number
}

const RR_REFRESH_INTERVAL_MS = 140
const RR_BADGE_WIDTH_PX = 164
const RR_BADGE_HEIGHT_PX = 26
const RR_RIGHT_GUTTER_PX = 14

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function renderStateEquals(left: ShadowRenderState | null, right: ShadowRenderState | null): boolean {
  if (!left || !right) return left === right
  if (
    left.left !== right.left
    || left.width !== right.width
    || left.entryLineY !== right.entryLineY
    || left.rrToT1 !== right.rrToT1
    || left.rrToT2 !== right.rrToT2
    || left.badgeLeft !== right.badgeLeft
    || left.badgeTop !== right.badgeTop
  ) {
    return false
  }
  if (left.bands.length !== right.bands.length) return false
  for (let index = 0; index < left.bands.length; index += 1) {
    const l = left.bands[index]
    const r = right.bands[index]
    if (!l || !r) return false
    if (l.id !== r.id || l.top !== r.top || l.height !== r.height || l.color !== r.color) return false
  }
  return true
}

function formatRatio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(2)
}

export function RiskRewardShadowOverlay({ coordinatesRef }: RiskRewardShadowOverlayProps) {
  const {
    selectedSetup,
    selectedSetupContract,
    inTradeSetup,
    inTradeContract,
    tradeMode,
  } = useSPXSetupContext()
  const [renderState, setRenderState] = useState<ShadowRenderState | null>(null)
  const telemetryKeyRef = useRef<string | null>(null)

  const focusSetup = tradeMode === 'in_trade' ? inTradeSetup : selectedSetup
  const focusContract = tradeMode === 'in_trade' ? inTradeContract : selectedSetupContract
  const geometry = useMemo(() => buildRiskRewardShadowGeometry(focusSetup, focusContract), [focusContract, focusSetup])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || !geometry) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const chartHeight = coordinates.chartDimensions.height
    const chartWidth = coordinates.chartDimensions.width
    if (chartHeight <= 0 || chartWidth <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const entryY = coordinates.priceToPixel(geometry.entryAnchor)
    const stopY = coordinates.priceToPixel(geometry.stop)
    const t1Y = coordinates.priceToPixel(geometry.target1)
    const t2Y = coordinates.priceToPixel(geometry.target2)
    if (entryY == null || stopY == null || t1Y == null || t2Y == null) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const left = clamp(chartWidth * 0.24, 72, chartWidth * 0.58)
    const maxBandWidth = Math.max(160, chartWidth - left - (RR_BADGE_WIDTH_PX + RR_RIGHT_GUTTER_PX + 8))
    const width = clamp(chartWidth * 0.48, 180, maxBandWidth)
    const riskTop = clamp(Math.min(entryY, stopY), 0, chartHeight)
    const riskHeight = clamp(Math.abs(entryY - stopY), 2, chartHeight)
    const reward1Top = clamp(Math.min(entryY, t1Y), 0, chartHeight)
    const reward1Height = clamp(Math.abs(entryY - t1Y), 2, chartHeight)
    const reward2Top = clamp(Math.min(entryY, t2Y), 0, chartHeight)
    const reward2Height = clamp(Math.abs(entryY - t2Y), 2, chartHeight)

    const bands: RenderBand[] = [
      { id: 'risk', top: riskTop, height: riskHeight, color: 'rgba(251,113,133,0.16)' },
      { id: 'reward-1', top: reward1Top, height: reward1Height, color: 'rgba(16,185,129,0.14)' },
      { id: 'reward-2', top: reward2Top, height: reward2Height, color: 'rgba(16,185,129,0.09)' },
    ]

    const nextState: ShadowRenderState = {
      left,
      width,
      entryLineY: clamp(entryY, 0, chartHeight),
      bands,
      rrToT1: geometry.rrToT1,
      rrToT2: geometry.rrToT2,
      badgeLeft: clamp(left + width + 8, 8, chartWidth - RR_BADGE_WIDTH_PX - RR_RIGHT_GUTTER_PX),
      badgeTop: clamp(entryY - 26, 8, chartHeight - RR_BADGE_HEIGHT_PX - 8),
    }

    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, geometry])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }
    tick()
    const intervalId = window.setInterval(tick, RR_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [refreshRenderState])

  useEffect(() => {
    if (!focusSetup || !geometry) {
      telemetryKeyRef.current = null
      return
    }
    const nextKey = [focusSetup.id, tradeMode, geometry.rrToT1?.toFixed(3), geometry.rrToT2?.toFixed(3)].join(':')
    if (telemetryKeyRef.current === nextKey) return
    telemetryKeyRef.current = nextKey
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.RR_SHADOW_RENDERED, {
      setupId: focusSetup.id,
      tradeMode,
      rrToT1: geometry.rrToT1,
      rrToT2: geometry.rrToT2,
      contractMid: geometry.contractMid,
    })
  }, [focusSetup, geometry, tradeMode])

  if (!renderState) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[17]" data-testid="spx-rr-shadow-overlay" aria-hidden>
      {renderState.bands.map((band) => (
        <div
          key={band.id}
          className="absolute rounded-md border border-white/8"
          style={{
            left: renderState.left,
            width: renderState.width,
            top: band.top,
            height: band.height,
            background: `linear-gradient(90deg, transparent 0%, ${band.color} 38%, transparent 100%)`,
          }}
        />
      ))}

      <div
        className="absolute h-[1px] border-t border-dashed border-champagne/65"
        style={{ left: renderState.left, width: renderState.width, top: renderState.entryLineY }}
      />

      <div
        className="absolute rounded-md border border-white/10 bg-black/45 px-2 py-1 font-mono text-[9px] text-white/70"
        style={{
          left: renderState.badgeLeft,
          top: renderState.badgeTop,
          width: RR_BADGE_WIDTH_PX,
          minHeight: RR_BADGE_HEIGHT_PX,
        }}
      >
        RR T1 {formatRatio(renderState.rrToT1)} · T2 {formatRatio(renderState.rrToT2)}
      </div>
    </div>
  )
}
