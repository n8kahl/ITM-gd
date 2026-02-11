'use client'

import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChartLevel {
  label?: string
  type?: string
  name?: string
  price: number
  displayLabel?: string
  displayContext?: string
  side?: 'resistance' | 'support'
  strength?: 'strong' | 'moderate' | 'weak' | 'critical' | 'dynamic'
  description?: string
  testsToday?: number
  lastTest?: string | null
  holdRate?: number | null
}

interface ChartLevelLabelsProps {
  levels: ChartLevel[]
  currentPrice: number
  onLevelClick?: (level: ChartLevel) => void
}

const STRENGTH_CLASSES: Record<NonNullable<ChartLevel['strength']>, string> = {
  critical: 'border-red-500/45 bg-red-500/12 text-red-200',
  strong: 'border-orange-500/45 bg-orange-500/12 text-orange-200',
  moderate: 'border-yellow-500/45 bg-yellow-500/12 text-yellow-200',
  weak: 'border-white/15 bg-white/5 text-white/75',
  dynamic: 'border-blue-500/45 bg-blue-500/12 text-blue-200',
}

function resolveLabel(level: ChartLevel): string {
  return level.displayLabel || level.label || `${level.name || level.type || 'Level'} $${level.price.toFixed(2)}`
}

function resolveContext(level: ChartLevel, currentPrice: number): string {
  if (level.displayContext) return level.displayContext

  const side = level.side || (level.price >= currentPrice ? 'resistance' : 'support')
  const delta = level.price - currentPrice
  const deltaPct = currentPrice > 0 ? (delta / currentPrice) * 100 : 0
  const dir = side === 'resistance' ? '↑' : '↓'
  return `${dir} ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)}%`
}

function resolveTooltip(level: ChartLevel): string {
  const lines = [
    level.description || 'Technical level',
  ]

  if ((level.testsToday || 0) > 0) {
    lines.push(`Tests today: ${level.testsToday}`)
  }
  if (level.lastTest) {
    lines.push(`Last test: ${new Date(level.lastTest).toLocaleTimeString()}`)
  }
  if (typeof level.holdRate === 'number') {
    lines.push(`Hold rate: ${(level.holdRate * 100).toFixed(0)}%`)
  }

  return lines.join('\n')
}

export function ChartLevelLabels({ levels, currentPrice, onLevelClick }: ChartLevelLabelsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const sorted = [...levels]
    .filter((level) => Number.isFinite(level.price))
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))
    .slice(0, 12)

  if (sorted.length === 0) return null

  return (
    <aside className="pointer-events-auto absolute right-3 top-12 z-20 hidden w-72 rounded-lg border border-white/10 bg-black/55 p-2 backdrop-blur md:block">
      <header
        className="flex cursor-pointer items-center justify-between gap-2 px-1"
        onClick={() => setIsCollapsed(!isCollapsed)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCollapsed(!isCollapsed) } }}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand key levels' : 'Collapse key levels'}
      >
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-medium text-white/70">Key Levels</div>
          <span className="text-white/50 transition-transform">
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/45" title="Closest levels sorted by distance from current price.">
          <Info className="h-3 w-3" />
          {isCollapsed ? `${sorted.length} levels` : 'Context'}
        </div>
      </header>

      {!isCollapsed && (
        <div className="mt-2 max-h-[320px] space-y-1 overflow-y-auto pr-1">
        {sorted.map((level) => {
          const strength = level.strength || 'weak'
          const side = level.side || (level.price >= currentPrice ? 'resistance' : 'support')
          const isNear = Math.abs(level.price - currentPrice) / Math.max(currentPrice, 0.01) < 0.01

          return (
            <button
              key={`${level.type || level.name || 'level'}-${level.price}`}
              type="button"
              onClick={() => onLevelClick?.(level)}
              className={cn(
                'w-full rounded border p-2 text-left transition-colors hover:border-emerald-400/50',
                STRENGTH_CLASSES[strength],
                isNear && 'ring-1 ring-emerald-300/50',
              )}
              title={resolveTooltip(level)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px]">{resolveLabel(level)}</span>
                <span className={cn(
                  'text-[10px]',
                  side === 'resistance' ? 'text-red-300' : 'text-emerald-300',
                )}>
                  {resolveContext(level, currentPrice)}
                </span>
              </div>
              {(level.testsToday || 0) > 0 && (
                <p className="mt-1 text-[10px] text-white/60">
                  Tested {level.testsToday}x
                  {typeof level.holdRate === 'number' ? ` • ${(level.holdRate * 100).toFixed(0)}% hold` : ''}
                </p>
              )}
            </button>
          )
        })}
        </div>
      )}
    </aside>
  )
}
