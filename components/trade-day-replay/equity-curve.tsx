'use client'

import { useEffect, useRef } from 'react'
import type { EnrichedTrade } from '@/lib/trade-day-replay/types'

interface EquityCurveProps {
  trades: EnrichedTrade[]
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Small cumulative P&L line chart using canvas.
 * Avoids heavyweight charting lib dependency for a simple sparkline.
 */
export function EquityCurve({ trades }: EquityCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const dataPoints = trades
    .filter((t) => isFiniteNumber(t.pnlPercent))
    .reduce<{ x: number; y: number }[]>((acc, trade, index) => {
      const prev = acc.length > 0 ? acc[acc.length - 1]!.y : 0
      acc.push({ x: index + 1, y: prev + (trade.pnlPercent ?? 0) })
      return acc
    }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dataPoints.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 16, right: 12, bottom: 24, left: 44 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Calculate bounds
    const yValues = dataPoints.map((p) => p.y)
    const yMin = Math.min(0, ...yValues)
    const yMax = Math.max(0, ...yValues)
    const yRange = Math.max(yMax - yMin, 1)
    const xMin = dataPoints[0]!.x
    const xMax = dataPoints[dataPoints.length - 1]!.x
    const xRange = Math.max(xMax - xMin, 1)

    const toCanvasX = (x: number) => padding.left + ((x - xMin) / xRange) * chartW
    const toCanvasY = (y: number) => padding.top + ((yMax - y) / yRange) * chartH

    // Zero line
    const zeroY = toCanvasY(0)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(padding.left, zeroY)
    ctx.lineTo(w - padding.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${yMax.toFixed(1)}%`, padding.left - 4, padding.top + 4)
    ctx.fillText(`${yMin.toFixed(1)}%`, padding.left - 4, h - padding.bottom + 4)
    ctx.fillText('0%', padding.left - 4, zeroY + 3)

    // X-axis labels
    ctx.textAlign = 'center'
    for (const point of dataPoints) {
      const cx = toCanvasX(point.x)
      ctx.fillText(`${point.x}`, cx, h - padding.bottom + 14)
    }

    // Area fill
    const finalValue = dataPoints[dataPoints.length - 1]!.y
    const isPositive = finalValue >= 0
    const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom)
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)')
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)')
    } else {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.02)')
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)')
    }

    ctx.beginPath()
    ctx.moveTo(toCanvasX(dataPoints[0]!.x), zeroY)
    for (const point of dataPoints) {
      ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y))
    }
    ctx.lineTo(toCanvasX(dataPoints[dataPoints.length - 1]!.x), zeroY)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Line
    ctx.strokeStyle = isPositive ? '#10B981' : '#ef4444'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < dataPoints.length; i++) {
      const cx = toCanvasX(dataPoints[i]!.x)
      const cy = toCanvasY(dataPoints[i]!.y)
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    }
    ctx.stroke()

    // Data points
    for (const point of dataPoints) {
      const cx = toCanvasX(point.x)
      const cy = toCanvasY(point.y)
      ctx.fillStyle = point.y >= 0 ? '#10B981' : '#ef4444'
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [dataPoints])

  if (dataPoints.length < 2) return null

  const finalPnl = dataPoints[dataPoints.length - 1]!.y

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          Equity Curve
        </span>
        <span className={`text-sm font-bold font-mono ${finalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {finalPnl >= 0 ? '+' : ''}{finalPnl.toFixed(1)}%
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="h-[140px] w-full"
        style={{ display: 'block' }}
      />
    </div>
  )
}
