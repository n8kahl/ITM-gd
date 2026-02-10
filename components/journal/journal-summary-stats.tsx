'use client'

import type { JournalEntry } from '@/lib/types/journal'
import type { JournalStats } from '@/lib/types/journal'

interface JournalSummaryStatsProps {
  entries: JournalEntry[]
}

function calculateStats(entries: JournalEntry[]): JournalStats {
  const closed = entries.filter((entry) => entry.pnl != null)
  const totalTrades = closed.length

  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: null,
      totalPnl: null,
      profitFactor: null,
    }
  }

  const winners = closed.filter((entry) => (entry.pnl ?? 0) > 0)
  const losers = closed.filter((entry) => (entry.pnl ?? 0) < 0)

  const totalPnl = closed.reduce((sum, entry) => sum + (entry.pnl ?? 0), 0)
  const grossProfit = winners.reduce((sum, entry) => sum + (entry.pnl ?? 0), 0)
  const grossLossAbs = Math.abs(losers.reduce((sum, entry) => sum + (entry.pnl ?? 0), 0))

  return {
    totalTrades,
    winRate: (winners.length / totalTrades) * 100,
    totalPnl,
    profitFactor: grossLossAbs === 0 ? null : grossProfit / grossLossAbs,
  }
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `${value >= 0 ? '+' : '-'}$${abs}`
}

export function JournalSummaryStats({ entries }: JournalSummaryStatsProps) {
  const stats = calculateStats(entries)

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Total Trades" value={String(stats.totalTrades)} />
      <Stat label="Win Rate" value={stats.winRate == null ? '—' : `${stats.winRate.toFixed(1)}%`} />
      <Stat label="Total P&L" value={formatCurrency(stats.totalPnl)} />
      <Stat label="Profit Factor" value={stats.profitFactor == null ? '—' : stats.profitFactor.toFixed(2)} />
    </div>
  )
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ivory">{value}</p>
    </div>
  )
}
