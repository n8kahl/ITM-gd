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

export function DashboardStatCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/members/dashboard/stats?period=month')
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
  }, [])

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
  const gradeAccent = aiGrade.startsWith('A')
    ? 'emerald' as const
    : aiGrade.startsWith('B')
    ? 'champagne' as const
    : aiGrade.startsWith('C') || aiGrade === '—'
    ? 'neutral' as const
    : 'red' as const

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
      {/* Win Rate */}
      <StatCard
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        icon={Target}
        accent={winRate >= 50 ? 'emerald' : 'red'}
        trend={stats?.pnl_change_pct != null ? {
          value: `${stats.pnl_change_pct > 0 ? '+' : ''}${stats.pnl_change_pct.toFixed(1)}% vs last month`,
          direction: stats.pnl_change_pct >= 0 ? 'up' : 'down',
        } : undefined}
      />

      {/* P&L MTD */}
      <StatCard
        label="P&L This Month"
        value={`${pnlPositive ? '+' : ''}$${Math.abs(pnlMtd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        icon={pnlPositive ? TrendingUp : TrendingDown}
        accent={pnlPositive ? 'emerald' : 'red'}
      />

      {/* Current Streak */}
      <StatCard
        label="Current Streak"
        value={`${streak} ${streakType === 'win' ? 'W' : 'L'}${streak >= 3 && streakType === 'win' ? ' \uD83D\uDD25' : ''}`}
        icon={Flame}
        accent={streakType === 'win' && streak >= 5 ? 'champagne' : streakType === 'win' ? 'emerald' : 'red'}
        trend={{ value: `Best: ${bestStreak}`, direction: 'neutral' }}
      />

      {/* AI Grade */}
      <StatCard
        label="Avg AI Grade"
        value={aiGrade}
        icon={GraduationCap}
        accent={gradeAccent}
      />

      {/* Trades MTD */}
      <StatCard
        label="Trades This Month"
        value={String(tradesMtd)}
        icon={BarChart3}
        accent="neutral"
        trend={tradesLastMonth > 0 ? {
          value: `vs ${tradesLastMonth} last month`,
          direction: 'neutral',
        } : undefined}
      />
    </div>
  )
}
