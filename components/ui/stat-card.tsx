'use client'

import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  trend?: {
    value: string
    direction: 'up' | 'down' | 'neutral'
  }
  icon?: LucideIcon
  accent?: 'emerald' | 'champagne' | 'red' | 'neutral'
  className?: string
}

/**
 * V3 Redesign: Glass-morphism stat card for dashboard.
 * Follows the "Quiet Luxury" design spec — Geist Mono for values,
 * uppercase tracking-widest labels, emerald/champagne accents.
 */
export function StatCard({
  label,
  value,
  trend,
  icon: Icon,
  accent = 'neutral',
  className,
}: StatCardProps) {
  const accentColors = {
    emerald: 'text-emerald-400',
    champagne: 'text-champagne',
    red: 'text-red-400',
    neutral: 'text-ivory',
  }

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-muted-foreground',
  }

  return (
    <div
      className={cn(
        // Glass Card base
        'relative rounded-xl p-4',
        'bg-white/[0.03] backdrop-blur-[40px]',
        'border border-white/10',
        'transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]',
        'hover:border-white/[0.16] hover:-translate-y-0.5',
        // Inner highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground mb-1.5">
            {label}
          </p>

          {/* Value */}
          <p className={cn(
            'font-mono text-2xl font-semibold tabular-nums',
            accentColors[accent]
          )}>
            {value}
          </p>

          {/* Trend */}
          {trend && (
            <p className={cn(
              'text-xs mt-1 font-mono tabular-nums',
              trendColors[trend.direction]
            )}>
              {trend.direction === 'up' && '▲ '}
              {trend.direction === 'down' && '▼ '}
              {trend.value}
            </p>
          )}
        </div>

        {/* Icon */}
        {Icon && (
          <div className={cn(
            'p-2 rounded-lg bg-white/[0.03]',
            accent === 'emerald' && 'text-emerald-400/60',
            accent === 'champagne' && 'text-champagne/60',
            accent === 'red' && 'text-red-400/60',
            accent === 'neutral' && 'text-muted-foreground/60',
          )}>
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  )
}
