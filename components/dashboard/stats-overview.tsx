'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Calendar } from 'lucide-react'
import { getJournalStats } from '@/app/actions/journal'

interface JournalStats {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number
  total_pnl: number
  avg_pnl: number
  best_trade: number
  worst_trade: number
  unique_symbols: number
  last_trade_date: string
}

export function StatsOverview() {
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      const result = await getJournalStats()
      if (result.success && result.data) {
        setStats(result.data)
      }
      setIsLoading(false)
    }

    loadStats()
  }, [])

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '$0.00'
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
    return formatted
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No trades yet'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-card-heavy border-white/10 animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-white/10 rounded w-20 mb-2" />
              <div className="h-8 bg-white/10 rounded w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <Card className="glass-card-heavy border-white/10 p-8 text-center">
        <div className="text-white/60">
          No trading data available. Start logging trades to see your stats!
        </div>
      </Card>
    )
  }

  const statCards = [
    {
      title: 'Total P&L',
      value: formatCurrency(stats.total_pnl),
      icon: DollarSign,
      color: stats.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: stats.total_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      title: 'Win Rate',
      value: `${stats.win_rate?.toFixed(1) || 0}%`,
      icon: Target,
      color: stats.win_rate >= 50 ? 'text-emerald-500' : 'text-yellow-500',
      bgColor: stats.win_rate >= 50 ? 'bg-emerald-500/10' : 'bg-yellow-500/10',
    },
    {
      title: 'Total Trades',
      value: stats.total_trades.toString(),
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      subtitle: `${stats.winning_trades}W / ${stats.losing_trades}L`,
    },
    {
      title: 'Avg P&L',
      value: formatCurrency(stats.avg_pnl),
      icon: TrendingUp,
      color: stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: stats.avg_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="glass-card-heavy border-white/10">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  {stat.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`} suppressHydrationWarning>
                  {stat.value}
                </div>
                {stat.subtitle && (
                  <p className="text-xs text-white/60 mt-1">{stat.subtitle}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Best Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-500" suppressHydrationWarning>
              {formatCurrency(stats.best_trade)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Worst Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-500" suppressHydrationWarning>
              {formatCurrency(stats.worst_trade)}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Last Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-white" suppressHydrationWarning>
              {formatDate(stats.last_trade_date)}
            </div>
            <p className="text-xs text-white/60 mt-1">
              {stats.unique_symbols} unique symbols
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
