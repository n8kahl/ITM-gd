'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, TrendingUp, TrendingDown, BookOpen } from 'lucide-react'
import type { JournalDirection, JournalEntry } from '@/lib/types/journal'

interface Entry {
  id: string
  trade_date: string
  symbol: string
  direction: JournalDirection | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
}

function toRecentEntry(entry: JournalEntry): Entry {
  return {
    id: entry.id,
    trade_date: entry.trade_date,
    symbol: entry.symbol,
    direction: entry.direction,
    pnl: entry.pnl,
    pnl_percentage: entry.pnl_percentage,
    is_winner: entry.is_winner,
  }
}

async function loadRecentEntries(): Promise<Entry[]> {
  const response = await fetch('/api/members/journal?limit=5&offset=0&sortBy=trade_date&sortDir=desc', {
    cache: 'no-store',
  })

  if (!response.ok) {
    return []
  }

  const payload = await response.json().catch(() => null)
  if (!payload?.success || !Array.isArray(payload.data)) {
    return []
  }

  return (payload.data as JournalEntry[]).map(toRecentEntry)
}

export function RecentEntries() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const run = async () => {
      const loaded = await loadRecentEntries()
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

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return '-'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <div className="mb-2 h-6 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-white/5" />
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
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Recent Trades
            </CardTitle>
            <CardDescription>Your latest journal entries</CardDescription>
          </div>
          <Link href="/members/journal">
            <Button variant="ghost" size="sm" className="gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-12 w-12 text-white/20" />
            <p className="mb-4 text-white/60">No trades logged yet</p>
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
                className="flex flex-1 items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10"
              >
                <div className="flex flex-1 items-center gap-4">
                  <div className="min-w-[60px] text-sm text-white/60" suppressHydrationWarning>
                    {formatDate(entry.trade_date)}
                  </div>

                  <div className="min-w-[80px] font-bold text-emerald-500">
                    {entry.symbol}
                  </div>

                  {entry.direction ? (
                    <Badge
                      variant={entry.direction === 'long' ? 'default' : 'secondary'}
                      className={
                        entry.direction === 'long'
                          ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-500'
                          : 'border-red-500/30 bg-red-500/20 text-red-500'
                      }
                    >
                      {entry.direction === 'long' ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                      {entry.direction.toUpperCase()}
                    </Badge>
                  ) : null}
                </div>

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
