'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, TrendingUp, TrendingDown, BookOpen } from 'lucide-react'
import { getEntries } from '@/app/actions/journal'

interface Entry {
  id: string
  trade_date: string
  symbol: string
  direction: 'long' | 'short' | 'neutral' | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
}

export function RecentEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadEntries = async () => {
      const result = await getEntries({ limit: 5, orderBy: 'trade_date', orderDirection: 'desc' })
      if (result.success && result.data) {
        setEntries(result.data)
      }
      setIsLoading(false)
    }

    loadEntries()
  }, [])

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
    return formatted
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return '-'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <div className="h-6 bg-white/10 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-white/10 rounded w-48 animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card-heavy border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-500" />
              Recent Trades
            </CardTitle>
            <CardDescription>Your latest journal entries</CardDescription>
          </div>
          <Link href="/members/journal">
            <Button variant="ghost" size="sm" className="gap-2">
              View All
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 mb-4">No trades logged yet</p>
            <Link href="/members/journal">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                Log Your First Trade
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Date */}
                  <div className="text-sm text-white/60 min-w-[60px]" suppressHydrationWarning>
                    {formatDate(entry.trade_date)}
                  </div>

                  {/* Symbol */}
                  <div className="font-bold text-emerald-500 min-w-[80px]">
                    {entry.symbol}
                  </div>

                  {/* Direction Badge */}
                  {entry.direction && (
                    <Badge
                      variant={entry.direction === 'long' ? 'default' : 'secondary'}
                      className={
                        entry.direction === 'long'
                          ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                          : entry.direction === 'short'
                          ? 'bg-red-500/20 text-red-500 border-red-500/30'
                          : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                      }
                    >
                      {entry.direction === 'long' && <TrendingUp className="w-3 h-3 mr-1" />}
                      {entry.direction === 'short' && <TrendingDown className="w-3 h-3 mr-1" />}
                      {entry.direction.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {/* P&L */}
                <div className="text-right">
                  <div
                    className={`font-mono font-bold ${
                      entry.pnl && entry.pnl > 0
                        ? 'text-emerald-500'
                        : entry.pnl && entry.pnl < 0
                        ? 'text-red-500'
                        : 'text-white/60'
                    }`}
                    suppressHydrationWarning
                  >
                    {formatCurrency(entry.pnl)}
                  </div>
                  <div className="text-xs text-white/60" suppressHydrationWarning>
                    {formatPercentage(entry.pnl_percentage)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
