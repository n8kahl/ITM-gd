'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type {
  SocialFeedItem,
  TradeCardDisplayData,
  AchievementDisplayData,
  MilestoneDisplayData,
  HighlightDisplayData,
} from '@/lib/types/social'
import { FeedTradeCard } from '@/components/social/feed-trade-card'
import { FeedAchievementCard } from '@/components/social/feed-achievement-card'
import { FeedMilestoneCard } from '@/components/social/feed-milestone-card'
import { FeedHighlightCard } from '@/components/social/feed-highlight-card'
import { LikeButton } from '@/components/social/like-button'
import { Loader2, Pin, Star, Trash2 } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

interface FeedItemCardProps {
  item: SocialFeedItem
  onDeleteItem?: (itemId: string) => Promise<{ success: boolean; error?: string }>
  className?: string
}

function formatRelativeTime(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getTierColor(tier: string | null | undefined): string {
  if (!tier) return 'text-white/50 border-white/10'
  const t = tier.toLowerCase()
  if (t === 'executive') return 'text-[#F5EDCC] border-[#F5EDCC]/30'
  if (t === 'pro') return 'text-blue-300 border-blue-500/30'
  if (t === 'core') return 'text-emerald-300 border-emerald-500/30'
  return 'text-white/50 border-white/10'
}

function resolveDiscordAvatarUrl(
  avatar: string | null | undefined,
  discordUserId: string | null | undefined,
): string | null {
  if (!avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }
  if (discordUserId) {
    return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.png?size=96`
  }
  return null
}

export function FeedItemCard({ item, onDeleteItem, className }: FeedItemCardProps) {
  const { author, item_type, display_data, created_at, is_pinned, is_featured } = item
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const displayName =
    author?.display_name || author?.discord_username || 'Anonymous Trader'
  const avatarUrl = resolveDiscordAvatarUrl(author?.discord_avatar, author?.discord_user_id)
  const memberTier = author?.membership_tier || null
  const canDelete = item.is_owner === true && item_type === 'trade_card' && typeof onDeleteItem === 'function'

  const handleDelete = async () => {
    if (!onDeleteItem || !canDelete || isDeleting) return

    const confirmed = window.confirm('Remove this trade card from your feed?')
    if (!confirmed) return

    setDeleteError(null)
    setIsDeleting(true)
    const result = await onDeleteItem(item.id)
    if (!result.success) {
      setDeleteError(result.error ?? 'Failed to remove trade card')
      setIsDeleting(false)
    }
  }

  return (
    <Card
      data-testid="feed-item"
      data-item-type={item_type}
      className={cn(
        'glass-card-heavy border-white/[0.06] bg-transparent',
        is_featured && 'border-emerald-500/20',
        is_pinned && 'border-[var(--champagne-hex)]/20',
        className
      )}
    >
      <CardContent className="space-y-4 p-4">
        {/* Author Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/50">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-white">
                  {displayName}
                </span>
                {memberTier && (
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] capitalize', getTierColor(memberTier))}
                  >
                    {memberTier}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-white/40">
                {formatRelativeTime(created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {is_pinned && (
              <Pin className="h-3.5 w-3.5 text-[var(--champagne-hex)]" />
            )}
            {is_featured && (
              <Star className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-white/45 hover:bg-red-500/10 hover:text-red-300"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3 w-3" />
                )}
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Content */}
        <div>
          {item_type === 'trade_card' && (
            <FeedTradeCard displayData={display_data as TradeCardDisplayData} />
          )}
          {item_type === 'achievement' && (
            <FeedAchievementCard displayData={display_data as AchievementDisplayData} />
          )}
          {item_type === 'milestone' && (
            <FeedMilestoneCard displayData={display_data as MilestoneDisplayData} />
          )}
          {item_type === 'highlight' && (
            <FeedHighlightCard displayData={display_data as HighlightDisplayData} />
          )}
        </div>

        {/* Footer: Like Button */}
        <div className="flex items-center border-t border-white/[0.06] pt-3">
          <LikeButton
            feedItemId={item.id}
            initialLiked={item.user_has_liked ?? false}
            initialCount={item.likes_count}
          />
        </div>

        {deleteError && (
          <p className="text-xs text-red-400">{deleteError}</p>
        )}
      </CardContent>
    </Card>
  )
}
