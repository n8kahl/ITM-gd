'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Users, BarChart3, Award } from 'lucide-react'

interface CommunityStatsBarProps {
  className?: string
}

interface CommunityStats {
  total_members: number
  trades_shared: number
  achievements_earned: number
}

function formatStatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export function CommunityStatsBar({ className }: CommunityStatsBarProps) {
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/social/community-stats')
        if (!response.ok) throw new Error('Failed to load stats')

        const json = await response.json()
        if (!json?.success) {
          throw new Error(json?.error || 'Failed to load stats')
        }

        setStats(json.data as CommunityStats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
        <CardContent className="py-6 text-center">
          <p className="text-xs text-white/30">Unable to load community stats</p>
        </CardContent>
      </Card>
    )
  }

  const statItems = [
    {
      label: 'Members',
      value: stats.total_members,
      icon: Users,
    },
    {
      label: 'Trades Shared',
      value: stats.trades_shared,
      icon: BarChart3,
    },
    {
      label: 'Achievements',
      value: stats.achievements_earned,
      icon: Award,
    },
  ]

  return (
    <Card className={cn('glass-card-heavy border-white/[0.06] bg-transparent', className)}>
      <CardContent className="py-4">
        <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
          {statItems.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex flex-col items-center gap-1 px-3">
                <Icon className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-lg font-bold text-white">
                  {formatStatValue(stat.value)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {stat.label}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
