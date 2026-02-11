'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Target, DollarSign, BarChart3, Calendar } from 'lucide-react'
import type { JournalEntry } from '@/lib/types/journal'
import { Counter } from '@/components/ui/counter'

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

function computeStats(entries: JournalEntry[]): JournalStats | null {
  const closed = entries.filter((entry) => entry.pnl != null)
  if (closed.length === 0) return null

  const winningTrades = closed.filter((entry) => (entry.pnl ?? 0) > 0).length
  const losingTrades = closed.filter((entry) => (entry.pnl ?? 0) < 0).length

  const pnlValues = closed.map((entry) => entry.pnl ?? 0)
  const totalPnl = pnlValues.reduce((sum, value) => sum + value, 0)
  const avgPnl = totalPnl / closed.length

  const uniqueSymbols = new Set(closed.map((entry) => entry.symbol.toUpperCase())).size
  const sortedTradeDates = closed
    .map((entry) => entry.trade_date)
    .sort((a, b) => (a < b ? 1 : -1))

  return {
    total_trades: closed.length,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    win_rate: (winningTrades / closed.length) * 100,
    total_pnl: Number(totalPnl.toFixed(2)),
    avg_pnl: Number(avgPnl.toFixed(2)),
    best_trade: Number(Math.max(...pnlValues).toFixed(2)),
    worst_trade: Number(Math.min(...pnlValues).toFixed(2)),
    unique_symbols: uniqueSymbols,
    last_trade_date: sortedTradeDates[0] ?? '',
  }
}

async function loadEntries(): Promise<JournalEntry[]> {
  const response = await fetch('/api/members/journal?limit=500&offset=0&sortBy=trade_date&sortDir=desc', {
    cache: 'no-store',
  })

  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => null)
  if (!payload?.success || !Array.isArray(payload.data)) {
    return []
  }

  return payload.data as JournalEntry[]
}

export function StatsOverview() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      const loaded = await loadEntries()
      if (active) {
        setEntries(loaded)
        setIsLoading(false)
      }
    }

    void run()

    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => computeStats(entries), [entries])

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No trades yet'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-card-heavy animate-pulse border-white/10">
            <CardHeader className="pb-2">
              <div className="mb-2 h-4 w-20 rounded bg-white/10" />
              <div className="h-8 w-16 rounded bg-white/10" />
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
      value: stats.total_pnl,
      format: (value: number) => formatCurrency(value),
      icon: DollarSign,
      color: stats.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: stats.total_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
    {
      title: 'Win Rate',
      value: stats.win_rate ?? 0,
      format: (value: number) => `${value.toFixed(1)}%`,
      icon: Target,
      color: stats.win_rate >= 50 ? 'text-emerald-500' : 'text-yellow-500',
      bgColor: stats.win_rate >= 50 ? 'bg-emerald-500/10' : 'bg-yellow-500/10',
    },
    {
      title: 'Total Trades',
      value: stats.total_trades,
      format: (value: number) => value.toFixed(0),
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      subtitle: `${stats.winning_trades}W / ${stats.losing_trades}L`,
    },
    {
      title: 'Avg P&L',
      value: stats.avg_pnl,
      format: (value: number) => formatCurrency(value),
      icon: TrendingUp,
      color: stats.avg_pnl >= 0 ? 'text-emerald-500' : 'text-red-500',
      bgColor: stats.avg_pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index} className="glass-card-heavy border-white/10">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                  {stat.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Counter
                  value={stat.value}
                  className={`text-2xl font-bold ${stat.color}`}
                  format={stat.format}
                  flashDirection={
                    stat.title === 'Total Trades'
                      ? 'up'
                      : stat.value >= 0
                        ? 'up'
                        : 'down'
                  }
                />
                {stat.subtitle ? (
                  <p className="mt-1 text-xs text-white/60">{stat.subtitle}</p>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Best Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Counter
              value={stats.best_trade}
              className="text-xl font-bold text-emerald-500"
              format={(value) => formatCurrency(value)}
              flashDirection="up"
            />
          </CardContent>
        </Card>

        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Worst Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Counter
              value={stats.worst_trade}
              className="text-xl font-bold text-red-500"
              format={(value) => formatCurrency(value)}
              flashDirection="down"
            />
          </CardContent>
        </Card>

        <Card className="glass-card-heavy border-white/10">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Last Trade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-white" suppressHydrationWarning>
              {formatDate(stats.last_trade_date)}
            </div>
            <p className="mt-1 text-xs text-white/60">
              {stats.unique_symbols} unique symbols
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
