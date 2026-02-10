/**
 * File: components/academy/mastery-arc.tsx
 * Created: 2026-02-10
 * Purpose: Render a six-axis competency radar chart for Academy mastery progress.
 */
'use client'

import { cn } from '@/lib/utils'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'

interface MasteryArcProps {
  scores: {
    market_context: number
    entry_validation: number
    position_sizing: number
    trade_management: number
    exit_discipline: number
    review_reflection: number
  }
  size?: number
  className?: string
}

const LABELS: Array<{
  key: keyof MasteryArcProps['scores']
  label: string
}> = [
  { key: 'market_context', label: 'Context' },
  { key: 'entry_validation', label: 'Entry' },
  { key: 'position_sizing', label: 'Sizing' },
  { key: 'trade_management', label: 'Management' },
  { key: 'exit_discipline', label: 'Exit' },
  { key: 'review_reflection', label: 'Review' },
]

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function MasteryArc({
  scores,
  size = 270,
  className,
}: MasteryArcProps) {
  const chartData = LABELS.map((item) => ({
    competency: item.label,
    score: clampScore(scores[item.key]),
    fullMark: 100,
  }))

  return (
    <div className={cn('glass-card-heavy rounded-xl border border-white/10 p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-300">Mastery Arc</p>
          <h3 className="text-sm font-semibold text-white">Competency Radar</h3>
        </div>
        <div className="text-[11px] text-champagne">
          Awareness 33 • Applied 66 • Independent 100
        </div>
      </div>

      <div style={{ width: '100%', height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 12, right: 18, bottom: 12, left: 18 }}>
            <defs>
              <linearGradient id="masteryArcFill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0.18} />
              </linearGradient>
            </defs>

            <PolarGrid stroke="rgba(255,255,255,0.16)" radialLines />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tickCount={4}
              tick={{ fill: 'rgba(243,229,171,0.75)', fontSize: 10 }}
              axisLine={false}
            />
            <PolarAngleAxis
              dataKey="competency"
              tick={{ fill: 'rgba(255,255,255,0.76)', fontSize: 11 }}
            />

            <Radar
              name="Mastery"
              dataKey="score"
              stroke="#10B981"
              fill="url(#masteryArcFill)"
              fillOpacity={1}
              strokeWidth={2}
              isAnimationActive
              animationDuration={700}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
