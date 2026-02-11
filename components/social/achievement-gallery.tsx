'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  FeedResponse,
  SocialFeedItem,
  AchievementDisplayData,
} from '@/lib/types/social'
import { Loader2, Award, Trophy, Star, Shield, Zap } from 'lucide-react'
import Image from 'next/image'

interface AchievementGalleryProps {
  compact?: boolean
  limit?: number
  className?: string
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy,
  star: Star,
  shield: Shield,
  zap: Zap,
}

const TIER_COLORS: Record<string, string> = {
  bronze: 'border-amber-700/30 bg-amber-700/10 text-amber-600',
  silver: 'border-gray-400/30 bg-gray-400/10 text-gray-300',
  gold: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
  platinum: 'border-champagne-dark/30 bg-champagne-dark/10 text-champagne-light',
  diamond: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

export function AchievementGallery({
  compact = false,
  limit = 12,
  className,
}: AchievementGalleryProps) {
  const [items, setItems] = useState<SocialFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAchievements() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          type: 'achievement',
          sort: 'latest',
          limit: String(compact ? Math.min(limit, 6) : limit),
        })

        const response = await fetch(`/api/social/feed?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to load achievements')

        const data: FeedResponse = await response.json()
        setItems(data.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchAchievements()
  }, [compact, limit])

  if (loading) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
        <CardContent className="py-12 text-center">
          <p className="text-xs text-red-400">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <Award className="h-5 w-5 text-emerald-400" />
            Community Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-white/40">No achievements earned yet</p>
          <p className="text-xs text-white/25">Complete challenges to earn achievements.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Award className="h-5 w-5 text-emerald-400" />
          Community Achievements
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'grid gap-3',
            compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          )}
        >
          {items.map((item) => {
            const data = item.display_data as AchievementDisplayData
            const IconComponent = ICON_MAP[data.icon] || Trophy
            const tierColor =
              TIER_COLORS[data.tier.toLowerCase()] || TIER_COLORS.bronze

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                  <IconComponent className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{data.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-[10px] text-emerald-400 border-emerald-500/20">
                      +{data.xp_earned} XP
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] capitalize', tierColor)}>
                      {data.tier}
                    </Badge>
                  </div>
                  {/* Author */}
                  {item.author && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="relative h-4 w-4 overflow-hidden rounded-full border border-white/10 bg-white/5">
                        {item.author.discord_avatar ? (
                          <Image
                            src={item.author.discord_avatar}
                            alt={item.author.display_name || 'User'}
                            fill
                            className="object-cover"
                            sizes="16px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[8px] text-white/30">
                            {(item.author.display_name || item.author.discord_username || '?')
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="truncate text-[10px] text-white/40">
                        {item.author.display_name || item.author.discord_username}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
