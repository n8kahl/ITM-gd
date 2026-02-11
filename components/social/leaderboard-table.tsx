'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  LeaderboardPeriod,
  LeaderboardCategory,
  LeaderboardResponse,
  LeaderboardEntry,
} from '@/lib/types/social'
import { Loader2, Trophy, Crown, Medal } from 'lucide-react'
import Image from 'next/image'

interface LeaderboardTableProps {
  period?: LeaderboardPeriod
  category?: LeaderboardCategory
  compact?: boolean
  className?: string
}

const PERIOD_TABS: Array<{ label: string; value: LeaderboardPeriod }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'All Time', value: 'all_time' },
]

const CATEGORY_TABS: Array<{ label: string; value: LeaderboardCategory }> = [
  { label: 'Win Rate', value: 'win_rate' },
  { label: 'P&L', value: 'total_pnl' },
  { label: 'Streak', value: 'longest_streak' },
  { label: 'XP', value: 'academy_xp' },
  { label: 'Discipline', value: 'discipline_score' },
  { label: 'Trades', value: 'trade_count' },
]

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-400" />
  if (rank === 2) return <Medal className="h-4 w-4 text-gray-300" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600" />
  return null
}

function getTierBadgeColor(tier: string | null): string {
  if (!tier) return 'border-white/10 text-white/40'
  const t = tier.toLowerCase()
  if (t.includes('elite') || t.includes('diamond')) return 'border-cyan-500/30 text-cyan-300'
  if (t.includes('gold') || t.includes('premium')) return 'border-yellow-500/30 text-yellow-400'
  if (t.includes('silver') || t.includes('pro')) return 'border-gray-400/30 text-gray-300'
  return 'border-white/10 text-white/40'
}

function formatCategoryValue(value: number, category: LeaderboardCategory): string {
  switch (category) {
    case 'win_rate':
    case 'discipline_score':
      return `${value.toFixed(1)}%`
    case 'total_pnl':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    case 'longest_streak':
    case 'trade_count':
      return value.toLocaleString()
    case 'academy_xp':
      return `${value.toLocaleString()} XP`
    default:
      return value.toString()
  }
}

export function LeaderboardTable({
  period: initialPeriod = 'weekly',
  category: initialCategory = 'win_rate',
  compact = false,
  className,
}: LeaderboardTableProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod)
  const [category, setCategory] = useState<LeaderboardCategory>(initialCategory)
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        period,
        category,
        ...(compact ? { limit: '5' } : {}),
      })

      const response = await fetch(`/api/social/leaderboard?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to load leaderboard')

      const json = await response.json()
      if (!json?.success) {
        throw new Error(json?.error || 'Failed to load leaderboard')
      }

      setData(json.data as LeaderboardResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [period, category, compact])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const renderEntry = (entry: LeaderboardEntry, isCurrentUser = false) => (
    <div
      key={entry.id}
      data-testid="leaderboard-entry"
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
        isCurrentUser
          ? 'border border-emerald-500/20 bg-emerald-500/5'
          : 'hover:bg-white/[0.02]'
      )}
    >
      {/* Rank */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center">
        {getRankIcon(entry.rank) || (
          <span className="font-mono text-xs text-white/40">{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
        {entry.discord_avatar ? (
          <Image
            src={entry.discord_avatar}
            alt={entry.display_name || entry.discord_username || 'Trader'}
            fill
            className="object-cover"
            sizes="32px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-white/40">
            {(entry.display_name || entry.discord_username || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name & Tier */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm', isCurrentUser ? 'font-semibold text-emerald-400' : 'text-white')}>
            {entry.display_name || entry.discord_username || 'Anonymous'}
          </span>
          {entry.membership_tier && !compact && (
            <Badge
              variant="outline"
              className={cn('text-[10px] capitalize', getTierBadgeColor(entry.membership_tier))}
            >
              {entry.membership_tier}
            </Badge>
          )}
        </div>
      </div>

      {/* Value */}
      <span className="shrink-0 font-mono text-sm font-semibold text-white">
        {formatCategoryValue(entry.value, category)}
      </span>
    </div>
  )

  return (
    <Card
      data-testid="leaderboard"
      className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}
    >
      <CardHeader className={cn(compact && 'pb-2')}>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Trophy className="h-5 w-5 text-emerald-400" />
          Leaderboard
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Period Tabs */}
        <div className="flex items-center gap-1">
          {PERIOD_TABS.map((tab) => (
            <Button
              key={tab.value}
              variant={period === tab.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriod(tab.value)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs',
                period === tab.value
                  ? 'bg-emerald-600 text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Category Tabs */}
        {!compact && (
          <div className="flex flex-wrap items-center gap-1">
            {CATEGORY_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={category === tab.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategory(tab.value)}
                className={cn(
                  'h-7 rounded-md px-2.5 text-xs',
                  category === tab.value
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-2 py-10">
            <p className="text-xs text-red-400">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchLeaderboard} className="text-xs">
              Retry
            </Button>
          </div>
        )}

        {/* Entries */}
        {!loading && !error && data && (
          <div className="space-y-1">
            {data.entries.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-white/40">No rankings yet</p>
                <p className="text-xs text-white/25">Start trading to claim your spot.</p>
              </div>
            ) : (
              <>
                {data.entries.map((entry) =>
                  renderEntry(entry, data.user_entry?.user_id === entry.user_id)
                )}

                {/* Current User Entry (if not in visible list) */}
                {data.user_entry &&
                  !data.entries.some((e) => e.user_id === data.user_entry!.user_id) && (
                    <>
                      <div className="my-2 border-t border-dashed border-white/[0.06]" />
                      {renderEntry(data.user_entry, true)}
                    </>
                  )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
