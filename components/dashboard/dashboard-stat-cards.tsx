'use client'

import { useEffect, useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Flame,
  GraduationCap,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton-loader'

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
          <SpotlightCard key={i} className="rounded-xl">
            <div className="glass-card-heavy rounded-xl p-4 h-[112px] border-white/10">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-28" />
            </div>
          </SpotlightCard>
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
  const hasMonthTrades = tradesMtd > 0

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
      value: hasMonthTrades ? `${winRate.toFixed(1)}%` : '—',
      icon: Target,
      accent: (winRate >= 50 ? 'emerald' : 'red') as StatCardAccent,
      trend: {
        value: hasMonthTrades ? `${tradesMtd} trade${tradesMtd === 1 ? '' : 's'} this month` : 'No closed trades this month',
        direction: 'neutral' as StatCardTrendDirection,
      },
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
      trend: stats?.pnl_change_pct != null ? {
        value: `${stats.pnl_change_pct > 0 ? '+' : ''}${stats.pnl_change_pct.toFixed(1)}% vs last month`,
        direction: (stats.pnl_change_pct >= 0 ? 'up' : 'down') as StatCardTrendDirection,
      } : undefined,
    },
    {
      key: 'streak',
      label: 'Current Streak',
      value: `${streak} ${streakType === 'win' ? 'W' : 'L'}`,
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
        <SpotlightCard key={card.key} className="rounded-xl border-white/10">
          <DashboardStatCard
            label={card.label}
            value={card.value}
            icon={card.icon}
            accent={card.accent}
            trend={card.trend}
          />
        </SpotlightCard>
      ))}
    </div>
  )
}

function DashboardStatCard({
  label,
  value,
  trend,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  trend?: {
    value: string
    direction: StatCardTrendDirection
  }
  icon: LucideIcon
  accent: StatCardAccent
}) {
  const iconColorClass = accent === 'emerald' || accent === 'red' ? 'text-emerald-500' : 'text-champagne'

  return (
    <div className="glass-card-heavy rounded-xl p-4 h-full border-white/[0.08]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-sans">
            {label}
          </p>
          <p className="mt-2 text-3xl font-serif text-ivory leading-none">
            {value}
          </p>
          {trend && (
            <p className={cn(
              'mt-2 text-[11px] font-sans tracking-[0.04em]',
              trend.direction === 'up'
                ? 'text-emerald-400'
                : trend.direction === 'down'
                  ? 'text-red-400'
                  : 'text-muted-foreground'
            )}>
              {trend.value}
            </p>
          )}
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
          <Icon strokeWidth={1.5} className={cn('w-4 h-4', iconColorClass)} />
        </div>
      </div>
    </div>
  )
}
