'use client'

import { cn } from '@/lib/utils'
import type { MilestoneDisplayData } from '@/lib/types/social'
import { Flame, ArrowUpCircle, BarChart3, Star } from 'lucide-react'

interface FeedMilestoneCardProps {
  displayData: MilestoneDisplayData
  className?: string
}

const MILESTONE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  streak: Flame,
  rank_up: ArrowUpCircle,
  trade_count: BarChart3,
  custom: Star,
}

export function FeedMilestoneCard({ displayData, className }: FeedMilestoneCardProps) {
  const { type, description, value } = displayData

  const IconComponent = MILESTONE_ICONS[type] || Star

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-champagne-dark/20 bg-champagne-dark/5">
        <IconComponent className="h-5 w-5 text-[var(--champagne-hex)]" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-white/80">{description}</p>
        <span className="inline-block font-mono text-lg font-bold text-emerald-400">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      </div>
    </div>
  )
}
