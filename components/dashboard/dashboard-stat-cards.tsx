'use client'

import { useEffect, useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Flame,
  GraduationCap,
  BarChart3,
} from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

interface DashboardStats {
  win_rate: number
  pnl_mtd: number
  pnl_change_pct: number
  current_streak: number
  streak_type: 'win' | 'loss'
  best_streak: number
  avg_ai_grade: string | null
  trades_mtd: number
  trades_last_month: number
}

type StatCardAccent = 'emerald' | 'champagne' | 'red' | 'neutral'
type StatCardTrendDirection = 'up' | 'down' | 'neutral'

export function DashboardStatCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { session, isLoading: isAuthLoading } = useMemberAuth()

  useEffect(() => {
    const accessToken = session?.access_token
    if (isAuthLoading) return
    if (!accessToken) {
      setLoading(false)
      return
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/members/dashboard/stats?period=month', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const data = await res.json()
        if (data.success && data.data) {
          setStats(data.data)
        }
      } catch {
        // Silently fail — show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [isAuthLoading, session?.access_token])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl h-[100px] bg-white/[0.02] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }

  const winRate = stats?.win_rate ?? 0
  const pnlMtd = stats?.pnl_mtd ?? 0
  const pnlPositive = pnlMtd >= 0
  const streak = stats?.current_streak ?? 0
  const streakType = stats?.streak_type ?? 'win'
  const bestStreak = stats?.best_streak ?? 0
  const aiGrade = stats?.avg_ai_grade ?? '—'
  const tradesMtd = stats?.trades_mtd ?? 0
  const tradesLastMonth = stats?.trades_last_month ?? 0

  // Determine AI grade accent
  const gradeAccent: StatCardAccent = aiGrade.startsWith('A')
    ? 'emerald'
    : aiGrade.startsWith('B')
    ? 'champagne'
    : aiGrade.startsWith('C') || aiGrade === '—'
    ? 'neutral'
    : 'red'

  const cards = [
    {
      key: 'win-rate',
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      icon: Target,
      accent: (winRate >= 50 ? 'emerald' : 'red') as StatCardAccent,
      trend: stats?.pnl_change_pct != null ? {
        value: `${stats.pnl_change_pct > 0 ? '+' : ''}${stats.pnl_change_pct.toFixed(1)}% vs last month`,
        direction: (stats.pnl_change_pct >= 0 ? 'up' : 'down') as StatCardTrendDirection,
      } : undefined,
    },
    {
      key: 'pnl',
      label: 'P&L This Month',
      value: `${pnlPositive ? '+' : ''}$${Math.abs(pnlMtd).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
      icon: pnlPositive ? TrendingUp : TrendingDown,
      accent: (pnlPositive ? 'emerald' : 'red') as StatCardAccent,
    },
    {
      key: 'streak',
      label: 'Current Streak',
      value: `${streak} ${streakType === 'win' ? 'W' : 'L'}${streak >= 3 && streakType === 'win' ? ' \uD83D\uDD25' : ''}`,
      icon: Flame,
      accent: (
        streakType === 'win' && streak >= 5
          ? 'champagne'
          : streakType === 'win'
            ? 'emerald'
            : 'red'
      ) as StatCardAccent,
      trend: { value: `Best: ${bestStreak}`, direction: 'neutral' as StatCardTrendDirection },
    },
    {
      key: 'ai-grade',
      label: 'Avg AI Grade',
      value: aiGrade,
      icon: GraduationCap,
      accent: gradeAccent,
    },
    {
      key: 'trades',
      label: 'Trades This Month',
      value: String(tradesMtd),
      icon: BarChart3,
      accent: 'neutral' as StatCardAccent,
      trend: tradesLastMonth > 0 ? {
        value: `vs ${tradesLastMonth} last month`,
        direction: 'neutral' as StatCardTrendDirection,
      } : undefined,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
      {cards.map((card) => (
        <SpotlightCard key={card.key}>
          <StatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            trend={card.trend}
            className="bg-transparent border-0 hover:border-0 hover:-translate-y-0"
          />
        </SpotlightCard>
      ))}
    </div>
  )
}
