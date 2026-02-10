'use client'

import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type WheelEventHandler } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OptionsMatrixCell, OptionsMatrixResponse } from '@/lib/api/ai-coach'

export type HeatmapMode = 'volume' | 'openInterest' | 'iv' | 'gex'

interface OptionsHeatmapProps {
  matrix: OptionsMatrixResponse | null
  mode: HeatmapMode
  onModeChange: (mode: HeatmapMode) => void
  isLoading?: boolean
  error?: string | null
  onRefresh?: () => void
}

interface HoverState {
  cell: OptionsMatrixCell | null
  x: number
  y: number
}

interface RenderState {
  leftPad: number
  topPad: number
  plotWidth: number
  plotHeight: number
  cellWidth: number
  cellHeight: number
  expirations: string[]
  visibleStrikes: number[]
  startRow: number
  sortedStrikesDesc: number[]
}

const MODE_OPTIONS: { value: HeatmapMode; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'openInterest', label: 'Open Interest' },
  { value: 'iv', label: 'IV' },
  { value: 'gex', label: 'GEX' },
]

function formatMetric(value: number | null, mode: HeatmapMode): string {
  if (value == null || !Number.isFinite(value)) return '-'
  if (mode === 'iv') return `${(value * 100).toFixed(1)}%`
  if (mode === 'gex') return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return value.toLocaleString()
}

function formatExpiryLabel(expiry: string): string {
  const [year, month, day] = expiry.split('-')
  if (!year || !month || !day) return expiry
  return `${month}/${day}`
}

function getMetric(cell: OptionsMatrixCell, mode: HeatmapMode): number {
  switch (mode) {
    case 'volume':
      return cell.metrics.volume
    case 'openInterest':
      return cell.metrics.openInterest
    case 'iv':
      return cell.metrics.impliedVolatility ?? 0
    case 'gex':
      return cell.metrics.gex
    default:
      return 0
  }
}

function getCellColor(value: number, mode: HeatmapMode, maxAbs: number): string {
  if (!Number.isFinite(value) || maxAbs <= 0) return 'rgba(255,255,255,0.05)'

  if (mode === 'gex') {
    const ratio = Math.min(Math.abs(value) / maxAbs, 1)
    const hue = value >= 0 ? 145 : 4
    const lightness = 95 - ratio * 55
    return `hsl(${hue} 72% ${lightness}%)`
  }

  const ratio = Math.min(Math.max(value / maxAbs, 0), 1)

  if (mode === 'iv') {
    const hue = 120 - ratio * 120
    return `hsl(${hue} 78% 48%)`
  }

  if (mode === 'openInterest') {
    const lightness = 96 - ratio * 62
    return `hsl(210 70% ${lightness}%)`
  }

  const lightness = 96 - ratio * 62
  return `hsl(145 70% ${lightness}%)`
}

function contractLabel(cell: OptionsMatrixCell): string {
  const call = cell.call
  const put = cell.put
  if (call && put) return 'Call + Put'
  if (call) return 'Call'
  if (put) return 'Put'
  return 'No contract'
}

export function OptionsHeatmap({
  matrix,
  mode,
  onModeChange,
  isLoading,
  error,
  onRefresh,
}: OptionsHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderStateRef = useRef<RenderState | null>(null)

  const [hovered, setHovered] = useState<HoverState | null>(null)
  const [selectedCell, setSelectedCell] = useState<OptionsMatrixCell | null>(null)
  const [zoom, setZoom] = useState(1)
  const [centerRow, setCenterRow] = useState<number | null>(null)

  const cellMap = useMemo(() => {
    const map = new Map<string, OptionsMatrixCell>()
    for (const cell of matrix?.cells || []) {
      map.set(`${cell.expiry}:${cell.strike}`, cell)
    }
    return map
  }, [matrix])

  const sortedStrikesDesc = useMemo(
    () => [...(matrix?.strikes || [])].sort((a, b) => b - a),
    [matrix?.strikes],
  )

  const maxMetricAbs = useMemo(() => {
    if (!matrix || matrix.cells.length === 0) return 0
    if (mode === 'gex') {
      return matrix.cells.reduce((max, cell) => Math.max(max, Math.abs(getMetric(cell, mode))), 0)
    }
    return matrix.cells.reduce((max, cell) => Math.max(max, getMetric(cell, mode)), 0)
  }, [matrix, mode])

  const defaultCenterRow = useMemo(() => {
    if (!matrix || sortedStrikesDesc.length === 0) {
      return null
    }

    return sortedStrikesDesc.reduce((bestIdx, strike, idx) => {
      const prevDiff = Math.abs(sortedStrikesDesc[bestIdx] - matrix.currentPrice)
      const currDiff = Math.abs(strike - matrix.currentPrice)
      return currDiff < prevDiff ? idx : bestIdx
    }, 0)
  }, [matrix, sortedStrikesDesc])

  useEffect(() => {
    if (!matrix || !containerRef.current || !canvasRef.current) return

    const container = containerRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      const height = container.clientHeight

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      ctx.clearRect(0, 0, width, height)

      const leftPad = 66
      const topPad = 26
      const rightPad = 6
      const bottomPad = 18
      const plotWidth = Math.max(width - leftPad - rightPad, 1)
      const plotHeight = Math.max(height - topPad - bottomPad, 1)

      const expirations = matrix.expirations
      const cols = expirations.length
      if (cols === 0 || sortedStrikesDesc.length === 0) {
        renderStateRef.current = null
        return
      }

      const rowsTotal = sortedStrikesDesc.length
      const visibleRows = Math.max(12, Math.min(rowsTotal, Math.floor(rowsTotal / zoom)))
      const effectiveCenter = centerRow ?? defaultCenterRow ?? Math.floor(rowsTotal / 2)
      const half = Math.floor(visibleRows / 2)
      const startRow = Math.max(0, Math.min(rowsTotal - visibleRows, effectiveCenter - half))
      const visibleStrikes = sortedStrikesDesc.slice(startRow, startRow + visibleRows)

      const cellWidth = plotWidth / cols
      const cellHeight = plotHeight / visibleRows

      ctx.fillStyle = '#0b0f0d'
      ctx.fillRect(leftPad, topPad, plotWidth, plotHeight)

      for (let row = 0; row < visibleStrikes.length; row += 1) {
        const strike = visibleStrikes[row]
        const y = topPad + row * cellHeight

        for (let col = 0; col < cols; col += 1) {
          const expiry = expirations[col]
          const x = leftPad + col * cellWidth
          const cell = cellMap.get(`${expiry}:${strike}`) || null
          const metricValue = cell ? getMetric(cell, mode) : 0
          const color = cell
            ? getCellColor(metricValue, mode, maxMetricAbs)
            : 'rgba(255,255,255,0.03)'

          ctx.fillStyle = color
          ctx.fillRect(x + 0.5, y + 0.5, Math.max(cellWidth - 1, 0), Math.max(cellHeight - 1, 0))
        }
      }

      const currentStrikeIdx = visibleStrikes.reduce((bestIdx, strike, idx) => {
        const prevDiff = Math.abs(visibleStrikes[bestIdx] - matrix.currentPrice)
        const currDiff = Math.abs(strike - matrix.currentPrice)
        return currDiff < prevDiff ? idx : bestIdx
      }, 0)
      const currentY = topPad + currentStrikeIdx * cellHeight + cellHeight / 2
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(leftPad, currentY)
      ctx.lineTo(leftPad + plotWidth, currentY)
      ctx.stroke()

      ctx.fillStyle = 'rgba(16, 185, 129, 0.95)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`Spot ${matrix.currentPrice.toFixed(2)}`, leftPad + 4, currentY - 4)

      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      const strikeLabelStep = Math.max(1, Math.floor(visibleStrikes.length / 8))
      for (let row = 0; row < visibleStrikes.length; row += strikeLabelStep) {
        const y = topPad + row * cellHeight + cellHeight * 0.65
        ctx.fillText(visibleStrikes[row].toFixed(0), leftPad - 6, y)
      }

      ctx.textAlign = 'center'
      for (let col = 0; col < cols; col += 1) {
        const x = leftPad + col * cellWidth + cellWidth / 2
        ctx.fillText(formatExpiryLabel(expirations[col]), x, topPad - 7)
      }

      renderStateRef.current = {
        leftPad,
        topPad,
        plotWidth,
        plotHeight,
        cellWidth,
        cellHeight,
        expirations,
        visibleStrikes,
        startRow,
        sortedStrikesDesc,
      }
    }

    draw()
    const resizeObserver = new ResizeObserver(draw)
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [matrix, cellMap, mode, maxMetricAbs, zoom, centerRow, defaultCenterRow, sortedStrikesDesc])

  const resolveCellFromPoint = (x: number, y: number): { cell: OptionsMatrixCell | null; rowGlobal: number | null } => {
    const renderState = renderStateRef.current
    if (!renderState) return { cell: null, rowGlobal: null }
    const { leftPad, topPad, plotWidth, plotHeight, cellWidth, cellHeight, expirations, visibleStrikes, startRow } = renderState

    if (x < leftPad || x > leftPad + plotWidth || y < topPad || y > topPad + plotHeight) {
      return { cell: null, rowGlobal: null }
    }

    const col = Math.floor((x - leftPad) / cellWidth)
    const row = Math.floor((y - topPad) / cellHeight)
    if (col < 0 || col >= expirations.length || row < 0 || row >= visibleStrikes.length) {
      return { cell: null, rowGlobal: null }
    }

    const expiry = expirations[col]
    const strike = visibleStrikes[row]
    return {
      cell: cellMap.get(`${expiry}:${strike}`) || null,
      rowGlobal: startRow + row,
    }
  }

  const handleMouseMove: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const { cell } = resolveCellFromPoint(x, y)
    setHovered(cell ? { cell, x, y } : null)
  }

  const handleMouseLeave = () => setHovered(null)

  const handleClick: MouseEventHandler<HTMLCanvasElement> = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const { cell } = resolveCellFromPoint(x, y)
    setSelectedCell(cell)
  }

  const handleWheel: WheelEventHandler<HTMLCanvasElement> = (event) => {
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const { rowGlobal } = resolveCellFromPoint(x, y)
    if (rowGlobal != null) {
      setCenterRow(rowGlobal)
    }

    setZoom((prev) => {
      const next = event.deltaY < 0 ? prev * 1.14 : prev / 1.14
      return Math.min(8, Math.max(1, next))
    })
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          onChange={(event) => onModeChange(event.target.value as HeatmapMode)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40"
        >
          {MODE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label} Heatmap</option>
          ))}
        </select>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/45 hover:text-emerald-300"
            title="Refresh heatmap"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        )}

        <div className="ml-auto text-[11px] text-white/45">
          {matrix ? `${matrix.expirations.length} expirations • ${matrix.strikes.length} strikes` : 'No matrix loaded'}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <div
        ref={containerRef}
        className="relative h-[360px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0f0d]"
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs text-white/70">
            Loading options matrix...
          </div>
        )}

        {!isLoading && !matrix && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/45">
            Heatmap unavailable
          </div>
        )}

        {hovered?.cell && (
          <div
            className="pointer-events-none absolute z-20 max-w-[260px] rounded border border-white/15 bg-black/85 px-2 py-1.5 text-[11px] text-white/80 shadow-xl"
            style={{
              left: Math.min(hovered.x + 10, 320),
              top: Math.max(hovered.y - 10, 8),
            }}
          >
            <div className="font-medium text-white/90">
              {hovered.cell.expiry} @ {hovered.cell.strike.toFixed(0)}
            </div>
            <div>{contractLabel(hovered.cell)}</div>
            <div>{MODE_OPTIONS.find((item) => item.value === mode)?.label}: {formatMetric(getMetric(hovered.cell, mode), mode)}</div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-2">
        <p className="mb-2 text-xs font-medium text-white/70">Heatmap Legend</p>
        <div className="grid grid-cols-2 gap-2 text-[10px] text-white/65">
          <div>
            <span className="font-medium text-emerald-300">Green intensity</span>
            <p>Higher call-side pressure / bullish participation.</p>
          </div>
          <div>
            <span className="font-medium text-red-300">Red intensity</span>
            <p>Higher put-side pressure / hedging demand.</p>
          </div>
          <div>
            <span className="font-medium text-yellow-300">Spot line</span>
            <p>Current underlying price reference across strikes.</p>
          </div>
          <div>
            <span className="font-medium text-violet-300">GEX mode</span>
            <p>Color polarity marks positive vs negative gamma zones.</p>
          </div>
        </div>
      </div>

      {selectedCell && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium text-white/90">
              {selectedCell.expiry} • Strike {selectedCell.strike.toFixed(0)}
            </div>
            <div className="text-white/45">{contractLabel(selectedCell)}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
              <p className="mb-1 text-[11px] font-medium text-emerald-300">Call</p>
              {selectedCell.call ? (
                <div className="space-y-1 text-white/75">
                  <p>Bid/Ask: {selectedCell.call.bid.toFixed(2)} / {selectedCell.call.ask.toFixed(2)}</p>
                  <p>Delta/Gamma: {(selectedCell.call.delta ?? 0).toFixed(2)} / {(selectedCell.call.gamma ?? 0).toFixed(4)}</p>
                  <p>Volume/OI: {selectedCell.call.volume.toLocaleString()} / {selectedCell.call.openInterest.toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-white/45">No call contract</p>
              )}
            </div>

            <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
              <p className="mb-1 text-[11px] font-medium text-red-300">Put</p>
              {selectedCell.put ? (
                <div className="space-y-1 text-white/75">
                  <p>Bid/Ask: {selectedCell.put.bid.toFixed(2)} / {selectedCell.put.ask.toFixed(2)}</p>
                  <p>Delta/Gamma: {(selectedCell.put.delta ?? 0).toFixed(2)} / {(selectedCell.put.gamma ?? 0).toFixed(4)}</p>
                  <p>Volume/OI: {selectedCell.put.volume.toLocaleString()} / {selectedCell.put.openInterest.toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-white/45">No put contract</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
