'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { HighlightDisplayData } from '@/lib/types/social'
import { Award, User, MessageSquare } from 'lucide-react'

interface FeedHighlightCardProps {
  displayData: HighlightDisplayData
  className?: string
}

const SPOTLIGHT_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  trade_of_week: {
    label: 'Trade of the Week',
    icon: Award,
    color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  member_spotlight: {
    label: 'Member Spotlight',
    icon: User,
    color: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  },
  community_note: {
    label: 'Community Note',
    icon: MessageSquare,
    color: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  },
}

export function FeedHighlightCard({ displayData, className }: FeedHighlightCardProps) {
  const { title, description, author_note, spotlight_type } = displayData

  const config = SPOTLIGHT_CONFIG[spotlight_type] || SPOTLIGHT_CONFIG.community_note
  const SpotlightIcon = config.icon

  return (
    <div className={cn('space-y-3', className)}>
      {/* Spotlight Badge */}
      <Badge variant="outline" className={cn('text-xs', config.color)}>
        <SpotlightIcon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>

      {/* Title and Description */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="text-sm leading-relaxed text-white/70">{description}</p>
      </div>

      {/* Author Note */}
      {author_note && (
        <p className="text-xs italic text-white/40 border-l-2 border-white/10 pl-3">
          {author_note}
        </p>
      )}
    </div>
  )
}
