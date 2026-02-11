'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type {
  FeedResponse,
  SocialFeedItem,
  TradeCardDisplayData,
  HighlightDisplayData,
} from '@/lib/types/social'
import {
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  User,
  MessageSquare,
  Star,
} from 'lucide-react'
import Image from 'next/image'

interface CommunityHighlightsProps {
  className?: string
}

const SPOTLIGHT_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  trade_of_week: {
    label: 'Trade of the Week',
    icon: Star,
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

export function CommunityHighlights({ className }: CommunityHighlightsProps) {
  const [items, setItems] = useState<SocialFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHighlights() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          featured_only: 'true',
          sort: 'latest',
          limit: '6',
        })

        const response = await fetch(`/api/social/feed?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to load highlights')

        const data: FeedResponse = await response.json()
        setItems(data.items)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchHighlights()
  }, [])

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
            <Sparkles className="h-5 w-5 text-emerald-400" />
            Community Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-white/40">No highlights yet</p>
          <p className="text-xs text-white/25">Featured trades and spotlights will appear here.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Sparkles className="h-5 w-5 text-emerald-400" />
          Community Highlights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <HighlightCard key={item.id} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HighlightCard({ item }: { item: SocialFeedItem }) {
  const { item_type, display_data, author } = item
  const displayName =
    author?.display_name || author?.discord_username || 'Anonymous'

  if (item_type === 'highlight') {
    const data = display_data as HighlightDisplayData
    const config =
      SPOTLIGHT_CONFIG[data.spotlight_type] || SPOTLIGHT_CONFIG.community_note
    const SpotlightIcon = config.icon

    return (
      <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
        <Badge variant="outline" className={cn('text-[10px]', config.color)}>
          <SpotlightIcon className="mr-1 h-3 w-3" />
          {config.label}
        </Badge>
        <h4 className="text-sm font-semibold text-white">{data.title}</h4>
        <p className="text-xs leading-relaxed text-white/60">{data.description}</p>
        {data.author_note && (
          <p className="text-[10px] italic text-white/35">{data.author_note}</p>
        )}
      </div>
    )
  }

  if (item_type === 'trade_card') {
    const data = display_data as TradeCardDisplayData
    const isPositive = data.is_winner === true || (data.pnl !== null && data.pnl > 0)

    return (
      <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{data.symbol}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] uppercase',
                data.direction === 'long'
                  ? 'border-emerald-500/30 text-emerald-400'
                  : 'border-red-500/30 text-red-400'
              )}
            >
              {data.direction === 'long' ? (
                <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="mr-0.5 h-2.5 w-2.5" />
              )}
              {data.direction.toUpperCase()}
            </Badge>
          </div>
          {item.is_featured && (
            <Star className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
          )}
        </div>
        {data.pnl !== null && (
          <span
            className={cn(
              'font-mono text-lg font-bold',
              isPositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {isPositive ? '+' : ''}${Math.abs(data.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <div className="relative h-4 w-4 overflow-hidden rounded-full border border-white/10 bg-white/5">
            {author?.discord_avatar ? (
              <Image
                src={author.discord_avatar}
                alt={displayName}
                fill
                className="object-cover"
                sizes="16px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[8px] text-white/30">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <span className="text-[10px] text-white/40">{displayName}</span>
        </div>
      </div>
    )
  }

  // Generic fallback for other featured items
  return (
    <div className="space-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
        Featured
      </Badge>
      <div className="flex items-center gap-1.5">
        <div className="relative h-4 w-4 overflow-hidden rounded-full border border-white/10 bg-white/5">
          {author?.discord_avatar ? (
            <Image
              src={author.discord_avatar}
              alt={displayName}
              fill
              className="object-cover"
              sizes="16px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[8px] text-white/30">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <span className="text-[10px] text-white/40">{displayName}</span>
      </div>
    </div>
  )
}
