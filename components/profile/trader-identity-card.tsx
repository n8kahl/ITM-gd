'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, Pencil, Calendar, User } from 'lucide-react'
import type { MemberProfile, TradingStyle } from '@/lib/types/social'

// ============================================
// TYPES
// ============================================

interface TraderIdentityCardProps {
  profile: MemberProfile | null
  discordUsername?: string | null
  discordAvatar?: string | null
  membershipTier?: string | null
  academyData: {
    rank: string
    xp: number
    nextRankXp: number
  } | null
  isOwnProfile?: boolean
  onEditProfile?: () => void
  className?: string
}

// ============================================
// HELPERS
// ============================================

function getTierConfig(tier: string | null | undefined) {
  switch (tier?.toLowerCase()) {
    case 'pro':
      return {
        label: 'Pro',
        ringClass: 'from-blue-500 via-blue-400 to-blue-600',
        badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      }
    case 'executive':
      return {
        label: 'Executive',
        ringClass: 'from-[#F5EDCC] via-[#E8E4D9] to-[#F5EDCC]',
        badgeClass: 'bg-[#F5EDCC]/10 text-[#F5EDCC] border-[#F5EDCC]/30',
      }
    default:
      return {
        label: 'Core',
        ringClass: 'from-emerald-500 via-emerald-400 to-emerald-600',
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      }
  }
}

function formatTradingStyle(style: TradingStyle | null): string {
  if (!style) return ''
  const labels: Record<TradingStyle, string> = {
    scalper: 'Scalper',
    day_trader: 'Day Trader',
    swing_trader: 'Swing Trader',
    position_trader: 'Position Trader',
  }
  return labels[style] ?? style
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

// ============================================
// COMPONENT
// ============================================

export function TraderIdentityCard({
  profile,
  discordUsername,
  discordAvatar,
  membershipTier,
  academyData,
  isOwnProfile = true,
  onEditProfile,
  className,
}: TraderIdentityCardProps) {
  const [imgError, setImgError] = useState(false)
  const tierConfig = getTierConfig(membershipTier)

  if (!profile) {
    return (
      <Card
        data-testid="trader-identity-card"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm text-[#9A9A9A]">Loading profile...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const displayName = profile.display_name || discordUsername || 'Trader'
  const avatarUrl = profile.custom_avatar_url || discordAvatar
  const xpProgress =
    academyData && academyData.nextRankXp > 0
      ? Math.min((academyData.xp / academyData.nextRankXp) * 100, 100)
      : 0

  // Collect "Trader DNA" tags
  const dnaTags: string[] = [
    ...(profile.top_symbols ?? []),
    ...(profile.preferred_strategy ? [profile.preferred_strategy] : []),
    ...(profile.trading_style ? [formatTradingStyle(profile.trading_style)] : []),
  ]

  return (
    <Card
      data-testid="trader-identity-card"
      className={cn('glass-card-heavy border-white/[0.08] overflow-hidden', className)}
    >
      <CardContent className="p-6">
        {/* Avatar + Identity Row */}
        <div className="flex items-start gap-5">
          {/* Avatar with tier-colored gradient ring */}
          <div className="relative shrink-0">
            <div
              className={cn(
                'rounded-full p-[2px] bg-gradient-to-br',
                tierConfig.ringClass
              )}
            >
              <div className="rounded-full overflow-hidden w-20 h-20 bg-[#141416]">
                {avatarUrl && !imgError ? (
                  <Image
                    data-testid="trader-avatar"
                    src={avatarUrl}
                    alt={`${displayName}'s avatar`}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                  />
                ) : (
                  <div
                    data-testid="trader-avatar"
                    className="w-full h-full flex items-center justify-center bg-[#141416]"
                  >
                    <User className="w-8 h-8 text-[#9A9A9A]" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name, Tier Badge, Rank */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-[#F5F5F0] truncate">
                {displayName}
              </h2>
              <Badge
                data-testid="tier-badge"
                variant="outline"
                className={cn('text-[10px] uppercase tracking-wider', tierConfig.badgeClass)}
              >
                {tierConfig.label}
              </Badge>
            </div>

            {/* Academy Rank + XP Progress */}
            {academyData && (
              <div className="mt-2">
                <div className="flex items-center gap-2 text-xs text-[#9A9A9A]">
                  <span className="text-emerald-400 font-medium">
                    {academyData.rank}
                  </span>
                  <span>&middot;</span>
                  <span className="font-mono-numbers">
                    {academyData.xp.toLocaleString()} XP
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full max-w-[200px] rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Member since */}
            {profile.created_at && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[#9A9A9A]">
                <Calendar className="w-3 h-3" />
                <span>Member since {formatDate(profile.created_at)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-sm text-[#F5F5F0]/80 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Trader DNA Tags */}
        {dnaTags.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] mb-2">
              Trader DNA
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dnaTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] bg-white/[0.03] border-white/10 text-[#F5F5F0]/70"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Edit Profile Button — only for own profile */}
        {isOwnProfile && (
          <div className="mt-5 pt-4 border-t border-white/5">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={onEditProfile}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
