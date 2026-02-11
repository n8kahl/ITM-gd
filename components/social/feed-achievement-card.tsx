'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { AchievementDisplayData } from '@/lib/types/social'
import { Trophy, Star, Shield, Zap } from 'lucide-react'

interface FeedAchievementCardProps {
  displayData: AchievementDisplayData
  className?: string
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'border-amber-700/30 bg-amber-700/10 text-amber-600',
  silver: 'border-gray-400/30 bg-gray-400/10 text-gray-300',
  gold: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  platinum: 'border-champagne-dark/30 bg-champagne-dark/10 text-champagne-light',
  diamond: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  shield: Shield,
  zap: Zap,
}

export function FeedAchievementCard({ displayData, className }: FeedAchievementCardProps) {
  const { title, icon, xp_earned, tier, verification_code } = displayData

  const IconComponent = ICON_MAP[icon] || Trophy
  const tierColor = TIER_COLORS[tier.toLowerCase()] || TIER_COLORS.bronze

  return (
    <div className={cn('space-y-3', className)}>
      {/* Achievement Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
          <IconComponent className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/10 text-xs text-emerald-400 border-emerald-500/20">
              +{xp_earned} XP
            </Badge>
            <Badge variant="outline" className={cn('text-xs capitalize', tierColor)}>
              {tier}
            </Badge>
          </div>
        </div>
      </div>

      {/* Verification Code */}
      {verification_code && (
        <div className="text-[10px] font-mono text-white/30">
          Verified: {verification_code}
        </div>
      )}
    </div>
  )
}
