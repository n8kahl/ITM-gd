/**
 * File: components/academy/annotated-chart-renderer.tsx
 * Created: 2026-02-10
 * Purpose: Render interactive price charts with support/resistance lines,
 *          entry/exit markers, and labeled annotation zones.
 */
'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────────────────────────── */

export interface ChartDataPoint {
  timestamp: string
  price: number
  label?: string
}

export interface AnnotationPoint {
  label: string
  value: number
  type: 'support' | 'resistance' | 'entry' | 'exit' | 'stop' | 'target' | 'vwap'
}

export interface AnnotatedChartProps {
  title: string
  description?: string
  data_points: ChartDataPoint[]
  annotations: AnnotationPoint[]
}

/* ── Color mapping ─────────────────────────────────────────────── */

const ANNOTATION_COLORS: Record<AnnotationPoint['type'], string> = {
  support: '#10B981',
  resistance: '#EA5967',
  entry: '#F3E5AB',
  exit: '#10B981',
  stop: '#EA5967',
  target: '#10B981',
  vwap: '#8B5CF6',
}

const ANNOTATION_DASH: Record<AnnotationPoint['type'], string> = {
  support: '8 4',
  resistance: '8 4',
  entry: '0',
  exit: '4 2',
  stop: '4 2',
  target: '4 2',
  vwap: '12 4',
}

/* ── Custom tooltip ────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null
  return (
    <div className="rounded-lg border border-white/15 bg-[#0A0B0D]/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      <p className="text-white/55">{label}</p>
      <p className="mt-0.5 font-semibold text-emerald-300">
        ${payload[0].value?.toFixed(2)}
      </p>
    </div>
  )
}

/* ── Component ─────────────────────────────────────────────────── */

export function AnnotatedChartRenderer({
  title,
  description,
  data_points,
  annotations,
}: AnnotatedChartProps) {
  const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null)

  const priceValues = data_points.map((d) => d.price)
  const minPrice = Math.min(...priceValues)
  const maxPrice = Math.max(...priceValues)
  const padding = (maxPrice - minPrice) * 0.1
  const yMin = Math.floor(minPrice - padding)
  const yMax = Math.ceil(maxPrice + padding)

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-300">
        <TrendingUp className="h-4 w-4" />
        Annotated Chart
      </div>

      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-white/65">{description}</p>
      )}

      <div className="mt-4 h-72 w-full md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data_points}
            margin={{ top: 10, right: 12, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
              width={55}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}
            />

            <Line
              type="monotone"
              dataKey="price"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#10B981', stroke: '#070809', strokeWidth: 2 }}
              name="Price"
            />

            {annotations.map((annotation) => (
              <ReferenceLine
                key={`${annotation.type}-${annotation.value}-${annotation.label}`}
                y={annotation.value}
                stroke={ANNOTATION_COLORS[annotation.type]}
                strokeDasharray={ANNOTATION_DASH[annotation.type]}
                strokeWidth={activeAnnotation === annotation.label ? 2.5 : 1.5}
                label={{
                  value: `${annotation.label} ($${annotation.value})`,
                  position: 'right',
                  fill: ANNOTATION_COLORS[annotation.type],
                  fontSize: 10,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {annotations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {annotations.map((annotation) => (
            <button
              key={`legend-${annotation.type}-${annotation.value}`}
              type="button"
              onClick={() =>
                setActiveAnnotation(
                  activeAnnotation === annotation.label ? null : annotation.label
                )
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                activeAnnotation === annotation.label
                  ? 'border-white/25 bg-white/10 text-white'
                  : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white/75'
              )}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: ANNOTATION_COLORS[annotation.type] }}
              />
              {annotation.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
