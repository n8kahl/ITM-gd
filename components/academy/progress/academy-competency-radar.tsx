'use client'

import { useState } from 'react'

interface CompetencyRadarProps {
  competencies: Array<{
    key: string
    title: string
    score: number // 0-100
    domain: string
  }>
}

const CHART_SIZE = 300
const CENTER = CHART_SIZE / 2
const MAX_RADIUS = 110
const RINGS = 4

function polarToCartesian(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  }
}

function buildPolygonPoints(scores: number[], maxRadius: number): string {
  const count = scores.length
  return scores
    .map((score, i) => {
      const angle = (360 / count) * i
      const r = (Math.max(0, Math.min(100, score)) / 100) * maxRadius
      const pt = polarToCartesian(angle, r)
      return `${pt.x},${pt.y}`
    })
    .join(' ')
}

export function AcademyCompetencyRadar({ competencies }: CompetencyRadarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!competencies || competencies.length === 0) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">Competency Radar</h2>
        <p className="mt-3 text-sm text-zinc-400">No competency data available yet.</p>
      </div>
    )
  }

  const count = competencies.length
  const scores = competencies.map((c) => c.score)
  const dataPolygon = buildPolygonPoints(scores, MAX_RADIUS)

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">Competency Radar</h2>
      <div className="mt-3 flex flex-col items-center gap-4">
        <div className="relative">
          <svg
            width={CHART_SIZE}
            height={CHART_SIZE}
            viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
            aria-label="Competency radar chart"
            role="img"
          >
            {/* Grid rings */}
            {Array.from({ length: RINGS }, (_, ringIdx) => {
              const r = (MAX_RADIUS / RINGS) * (ringIdx + 1)
              const ringPoints = Array.from({ length: count }, (__, i) => {
                const angle = (360 / count) * i
                const pt = polarToCartesian(angle, r)
                return `${pt.x},${pt.y}`
              }).join(' ')
              return (
                <polygon
                  key={ringIdx}
                  points={ringPoints}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
              )
            })}

            {/* Spoke lines */}
            {competencies.map((_, i) => {
              const angle = (360 / count) * i
              const outer = polarToCartesian(angle, MAX_RADIUS)
              return (
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
              )
            })}

            {/* Data polygon fill */}
            <polygon
              points={dataPolygon}
              fill="rgba(16, 185, 129, 0.20)"
              stroke="rgb(52, 211, 153)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {competencies.map((comp, i) => {
              const angle = (360 / count) * i
              const r = (Math.max(0, Math.min(100, comp.score)) / 100) * MAX_RADIUS
              const pt = polarToCartesian(angle, r)
              return (
                <circle
                  key={comp.key}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === i ? 5 : 3.5}
                  fill="rgb(52, 211, 153)"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="1"
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(i)}
                  onBlur={() => setHoveredIndex(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${comp.title}: ${comp.score.toFixed(0)}%`}
                />
              )
            })}

            {/* Axis labels */}
            {competencies.map((comp, i) => {
              const angle = (360 / count) * i
              const labelRadius = MAX_RADIUS + 22
              const pt = polarToCartesian(angle, labelRadius)
              const isLeft = pt.x < CENTER - 10
              const isRight = pt.x > CENTER + 10
              const anchor = isLeft ? 'end' : isRight ? 'start' : 'middle'
              return (
                <text
                  key={comp.key}
                  x={pt.x}
                  y={pt.y}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontSize="9"
                  fill={hoveredIndex === i ? 'rgb(52, 211, 153)' : 'rgb(161, 161, 170)'}
                  style={{ transition: 'fill 0.15s ease', userSelect: 'none' }}
                >
                  {comp.title.length > 14 ? comp.title.slice(0, 13) + '\u2026' : comp.title}
                </text>
              )
            })}
          </svg>

          {/* Hover tooltip */}
          {hoveredIndex !== null && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-emerald-500/40 bg-zinc-900/90 px-3 py-2 text-center shadow-lg backdrop-blur-sm"
              aria-live="polite"
            >
              <p className="text-xs font-medium text-white">{competencies[hoveredIndex].title}</p>
              <p className="font-mono text-lg font-semibold text-emerald-400">
                {competencies[hoveredIndex].score.toFixed(0)}
                <span className="text-xs text-zinc-400">%</span>
              </p>
              <p className="text-xs text-zinc-400">{competencies[hoveredIndex].domain}</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {competencies.map((comp, i) => (
            <button
              key={comp.key}
              className="flex items-center gap-1.5 text-left"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex(null)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  background: hoveredIndex === i ? 'rgb(52, 211, 153)' : 'rgba(52, 211, 153, 0.5)',
                  transition: 'background 0.15s ease',
                }}
              />
              <span className={`text-xs ${hoveredIndex === i ? 'text-white' : 'text-zinc-400'}`}>{comp.title}</span>
              <span className="font-mono text-xs text-emerald-400">{comp.score.toFixed(0)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
