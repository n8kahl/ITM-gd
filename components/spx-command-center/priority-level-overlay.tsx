'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { buildSPXScenarioLanes } from '@/lib/spx/scenario-lanes'
import { resolveVisibleChartLevels } from '@/lib/spx/spatial-hud'

interface PriorityLevelOverlayProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
  showAllRelevantLevels: boolean
  focusMode: 'decision' | 'execution' | 'risk_only'
  onDisplayedLevelsChange?: (displayed: number, total: number) => void
}

interface OverlayLevel {
  id: string
  price: number
  label: string
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  lineWidth: number
  axisLabelVisible?: boolean
  type?: string
  strength?: 'strong' | 'moderate' | 'weak' | 'dynamic' | 'critical'
}

interface RenderLine {
  id: string
  y: number
  label: string
  color: string
  lineStyle: 'solid' | 'dashed' | 'dotted'
  lineWidth: number
  showLabel: boolean
}

interface RenderState {
  width: number
  lines: RenderLine[]
}

const REFRESH_INTERVAL_MS = 120
const MAX_LABELS = 10
const PIXEL_COLLISION_GAP = 16

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function isSpyDerivedLevel(level: { category: string; symbol: string; source: string }): boolean {
  return level.category === 'spy_derived'
    || level.symbol === 'SPY'
    || level.source.startsWith('spy_')
}

function isVWAPLevel(source: string): boolean {
  return /(^|_)vwap($|_)/i.test(source) || source.toUpperCase() === 'VWAP'
}

function labelFromSource(source: string): string {
  const normalized = source.toLowerCase()
  if (normalized === 'vwap' || normalized.endsWith('_vwap') || normalized.includes('vwap')) return 'VWAP'
  if (normalized.includes('call_wall')) return 'Call Wall'
  if (normalized.includes('put_wall')) return 'Put Wall'
  if (normalized.includes('flip_point')) return 'Flip'
  if (normalized.includes('zero_gamma')) return 'Zero Gamma'
  if (normalized.startsWith('fib_')) return source.replace(/^fib_/, '').replace(/_/g, ' ').toUpperCase()
  return source.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function chartLevelLabel(level: { category: string; source: string; symbol: string }): string {
  const base = labelFromSource(level.source)
  if (isSpyDerivedLevel(level)) return `SPY→SPX ${base}`
  if (level.category === 'options') return `Options ${base}`
  return base
}

function levelKey(level: Pick<OverlayLevel, 'label' | 'price' | 'type'>): string {
  return `${level.label}:${level.price}:${level.type || 'unknown'}`
}

function renderStateEquals(left: RenderState | null, right: RenderState | null): boolean {
  if (!left || !right) return left === right
  if (left.width !== right.width || left.lines.length !== right.lines.length) return false
  for (let index = 0; index < left.lines.length; index += 1) {
    const l = left.lines[index]
    const r = right.lines[index]
    if (!l || !r) return false
    if (
      l.id !== r.id
      || l.y !== r.y
      || l.label !== r.label
      || l.color !== r.color
      || l.lineStyle !== r.lineStyle
      || l.lineWidth !== r.lineWidth
      || l.showLabel !== r.showLabel
    ) {
      return false
    }
  }
  return true
}

export function PriorityLevelOverlay({
  coordinatesRef,
  showAllRelevantLevels,
  focusMode,
  onDisplayedLevelsChange,
}: PriorityLevelOverlayProps) {
  const { levels } = useSPXAnalyticsContext()
  const { selectedSetup, chartAnnotations, tradeMode } = useSPXSetupContext()
  const { spxPrice } = useSPXPriceContext()
  const [renderState, setRenderState] = useState<RenderState | null>(null)
  const actionableSetupVisible = useMemo(() => {
    if (!selectedSetup) return false
    return tradeMode === 'in_trade' || selectedSetup.status === 'ready' || selectedSetup.status === 'triggered'
  }, [selectedSetup, tradeMode])

  const marketLevelAnnotations = useMemo<OverlayLevel[]>(() => {
    return levels.map((level) => ({
      id: level.id,
      price: level.price,
      label: chartLevelLabel(level),
      color: isVWAPLevel(level.source)
        ? 'rgba(234,179,8,0.92)'
        : (isSpyDerivedLevel(level) ? 'rgba(245,237,204,0.9)' : level.chartStyle.color),
      lineStyle: isVWAPLevel(level.source)
        ? 'dashed'
        : (level.chartStyle.lineStyle === 'dot-dash' ? 'dashed' : level.chartStyle.lineStyle),
      lineWidth: isVWAPLevel(level.source) ? Math.max(2, level.chartStyle.lineWidth) : level.chartStyle.lineWidth,
      axisLabelVisible: true,
      type: level.category,
      strength: level.strength,
    }))
  }, [levels])

  const focusedMarketLevels = useMemo<OverlayLevel[]>(() => {
    if (marketLevelAnnotations.length === 0) return []
    const livePrice = Number.isFinite(spxPrice) && spxPrice > 0 ? spxPrice : null
    const targetCount = selectedSetup ? 8 : 6

    const strengthWeight = (strength?: OverlayLevel['strength']) => {
      if (strength === 'critical') return 1.5
      if (strength === 'strong') return 1.35
      if (strength === 'moderate') return 1.15
      return 1
    }
    const typeWeight = (type?: string) => {
      if (!type) return 1
      if (type === 'options') return 1.2
      if (type === 'structural') return 1.15
      if (type === 'fibonacci') return 0.95
      return 1
    }

    const ranked = [...marketLevelAnnotations]
      .map((annotation) => {
        const distance = livePrice == null ? 0 : Math.abs(annotation.price - livePrice)
        return {
          annotation,
          score: distance / (strengthWeight(annotation.strength) * typeWeight(annotation.type)),
        }
      })
      .sort((a, b) => a.score - b.score)

    const base = ranked.slice(0, targetCount).map((entry) => entry.annotation)
    const nearestSpyDerived = ranked
      .filter((entry) => entry.annotation.type === 'spy_derived')
      .slice(0, 2)
      .map((entry) => entry.annotation)
    const vwapLevel = ranked.find((entry) => entry.annotation.label === 'VWAP')?.annotation

    const merged = new Map<string, OverlayLevel>()
    for (const annotation of [...base, ...nearestSpyDerived, ...(vwapLevel ? [vwapLevel] : [])]) {
      const key = levelKey(annotation)
      if (!merged.has(key)) merged.set(key, annotation)
    }
    return Array.from(merged.values())
  }, [marketLevelAnnotations, selectedSetup, spxPrice])

  const setupAnnotations = useMemo<OverlayLevel[]>(() => {
    if (!actionableSetupVisible) return []
    const overlays: OverlayLevel[] = []
    for (const annotation of chartAnnotations) {
      if (annotation.type === 'entry_zone' && annotation.priceLow != null && annotation.priceHigh != null) {
        overlays.push(
          {
            id: `${annotation.id}:low`,
            price: annotation.priceLow,
            label: `${annotation.label} Low`,
            color: 'rgba(16,185,129,0.9)',
            lineStyle: 'dashed',
            lineWidth: 1.4,
            axisLabelVisible: true,
            type: annotation.type,
          },
          {
            id: `${annotation.id}:high`,
            price: annotation.priceHigh,
            label: `${annotation.label} High`,
            color: 'rgba(16,185,129,0.9)',
            lineStyle: 'dashed',
            lineWidth: 1.4,
            axisLabelVisible: true,
            type: annotation.type,
          },
        )
        continue
      }
      if (annotation.price == null) continue
      overlays.push({
        id: annotation.id,
        price: annotation.price,
        label: annotation.label,
        color: annotation.type === 'stop' ? 'rgba(251,113,133,0.92)' : 'rgba(245,208,120,0.92)',
        lineStyle: 'solid',
        lineWidth: 1.6,
        axisLabelVisible: true,
        type: annotation.type,
      })
    }
    return overlays
  }, [actionableSetupVisible, chartAnnotations])

  const scenarioAnnotations = useMemo<OverlayLevel[]>(() => {
    if (!actionableSetupVisible) return []
    const referencePrice = Number.isFinite(spxPrice) && spxPrice > 0 ? spxPrice : null
    const lanes = buildSPXScenarioLanes(selectedSetup, referencePrice)
    return lanes.map((lane) => ({
      id: lane.id,
      price: lane.price,
      label: lane.label,
      color: lane.type === 'adverse'
        ? 'rgba(251,113,133,0.84)'
        : lane.type === 'acceleration'
          ? 'rgba(34,211,238,0.84)'
          : 'rgba(16,185,129,0.84)',
      lineStyle: lane.type === 'base' ? 'solid' : 'dotted',
      lineWidth: lane.type === 'base' ? 2 : 1.2,
      axisLabelVisible: true,
      type: `scenario_${lane.type}`,
    }))
  }, [actionableSetupVisible, selectedSetup, spxPrice])

  const candidateLevels = useMemo<OverlayLevel[]>(() => {
    const marketDisplayed = focusMode === 'execution'
      ? focusedMarketLevels
      : (showAllRelevantLevels ? marketLevelAnnotations : focusedMarketLevels)
    return [...marketDisplayed, ...setupAnnotations, ...scenarioAnnotations]
  }, [focusMode, focusedMarketLevels, marketLevelAnnotations, scenarioAnnotations, setupAnnotations, showAllRelevantLevels])

  const visibleLevels = useMemo(() => {
    const livePrice = Number.isFinite(spxPrice) && spxPrice > 0 ? spxPrice : null
    const includeAllRelevant = showAllRelevantLevels && focusMode !== 'execution'
    return resolveVisibleChartLevels(candidateLevels, {
      livePrice,
      nearWindowPoints: includeAllRelevant ? Number.MAX_SAFE_INTEGER : 18,
      nearLabelBudget: includeAllRelevant ? Math.max(candidateLevels.length, 32) : 8,
      maxTotalLabels: includeAllRelevant ? Math.max(candidateLevels.length, 64) : 18,
      minGapPoints: includeAllRelevant ? 0.01 : 1.1,
    }).levels
  }, [candidateLevels, focusMode, showAllRelevantLevels, spxPrice])

  const refreshRenderState = useCallback(() => {
    const coordinates = coordinatesRef.current
    if (!coordinates?.ready || visibleLevels.length === 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const width = coordinates.chartDimensions.width
    const height = coordinates.chartDimensions.height
    if (width <= 0 || height <= 0) {
      setRenderState((previous) => (previous == null ? previous : null))
      return
    }

    const yProjected = visibleLevels
      .map((level) => ({
        level,
        y: coordinates.priceToPixel(level.price),
      }))
      .filter((entry): entry is { level: OverlayLevel; y: number } => entry.y != null && Number.isFinite(entry.y))
      .sort((left, right) => left.y - right.y)

    const allowDenseLines = showAllRelevantLevels && focusMode !== 'execution'
    const lines: RenderLine[] = []
    for (const entry of yProjected) {
      const collided = lines.some((accepted) => Math.abs(accepted.y - entry.y) < PIXEL_COLLISION_GAP)
      if (collided && !allowDenseLines) continue
      lines.push({
        id: entry.level.id,
        y: clamp(entry.y, 0, height),
        label: entry.level.label,
        color: entry.level.color,
        lineStyle: entry.level.lineStyle,
        lineWidth: clamp(entry.level.lineWidth + 0.4, 1, 3),
        showLabel: !collided && lines.length < MAX_LABELS,
      })
    }

    const nextState: RenderState = { width, lines }
    setRenderState((previous) => (renderStateEquals(previous, nextState) ? previous : nextState))
  }, [coordinatesRef, focusMode, showAllRelevantLevels, visibleLevels])

  useEffect(() => {
    let rafId = 0
    const tick = () => {
      rafId = window.requestAnimationFrame(refreshRenderState)
    }
    tick()
    const intervalId = window.setInterval(tick, REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [refreshRenderState])

  useEffect(() => {
    onDisplayedLevelsChange?.(renderState?.lines.length || 0, candidateLevels.length)
  }, [candidateLevels.length, onDisplayedLevelsChange, renderState?.lines.length])

  if (!renderState || renderState.lines.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[25]" data-testid="spx-priority-level-overlay" aria-hidden>
      {renderState.lines.map((line) => (
        <div
          key={line.id}
          className="absolute left-0"
          style={{
            top: line.y,
            width: renderState.width,
            borderTop: `${line.lineWidth}px ${line.lineStyle} ${line.color}`,
            opacity: 0.95,
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.32))',
          }}
        />
      ))}

      {renderState.lines.filter((line) => line.showLabel).map((line) => (
        <div
          key={`${line.id}:label`}
          className="absolute right-2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px]"
          style={{
            top: line.y,
            borderColor: `${line.color}BB`,
            color: line.color,
            background: 'rgba(8,10,12,0.82)',
            textShadow: '0 0 8px rgba(0,0,0,0.5)',
          }}
        >
          {line.label}
        </div>
      ))}
    </div>
  )
}
