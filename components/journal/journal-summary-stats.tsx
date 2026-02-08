'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { JournalEntry, JournalStats } from '@/lib/types/journal'

interface JournalSummaryStatsProps {
  entries: JournalEntry[]
}

function computeStats(entries: JournalEntry[]): JournalStats {
  const total = entries.length
  if (total === 0) {
    return {
      total_trades: 0, winning_trades: 0, losing_trades: 0,
      win_rate: 0, total_pnl: 0, avg_pnl: 0,
      best_trade: 0, worst_trade: 0,
      profit_factor: 0, avg_win: 0, avg_loss: 0,
    }
  }

  const winners = entries.filter(e => (e.pnl ?? 0) > 0)
  const losers = entries.filter(e => (e.pnl ?? 0) < 0)
  const totalPnl = entries.reduce((sum, e) => sum + (e.pnl ?? 0), 0)
  const pnlValues = entries.map(e => e.pnl ?? 0)

  const totalWins = winners.reduce((sum, e) => sum + (e.pnl ?? 0), 0)
  const totalLosses = Math.abs(losers.reduce((sum, e) => sum + (e.pnl ?? 0), 0))

  return {
    total_trades: total,
    winning_trades: winners.length,
    losing_trades: losers.length,
    win_rate: total > 0 ? (winners.length / total) * 100 : 0,
    total_pnl: totalPnl,
    avg_pnl: total > 0 ? totalPnl / total : 0,
    best_trade: pnlValues.length > 0 ? Math.max(...pnlValues) : 0,
    worst_trade: pnlValues.length > 0 ? Math.min(...pnlValues) : 0,
    profit_factor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    avg_win: winners.length > 0 ? totalWins / winners.length : 0,
    avg_loss: losers.length > 0 ? totalLosses / losers.length : 0,
  }
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val)
  const prefix = val >= 0 ? '+$' : '-$'
  return `${prefix}${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

interface StatItemProps {
  label: string
  value: string
  color?: string
}

function StatItem({ label, value, color }: StatItemProps) {
  return (
    <div className="min-w-[130px] p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] flex-shrink-0">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-lg font-mono font-semibold tabular-nums', color || 'text-ivory')}>
        {value}
      </p>
    </div>
  )
}

export function JournalSummaryStats({ entries }: JournalSummaryStatsProps) {
  const stats = computeStats(entries)

  if (entries.length === 0) return null

  const pnlColor = stats.total_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
  const avgColor = stats.avg_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
  const wrColor = stats.win_rate >= 50 ? 'text-emerald-400' : stats.win_rate >= 40 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
      <StatItem label="Total Trades" value={String(stats.total_trades)} />
      <StatItem label="Win Rate" value={`${stats.win_rate.toFixed(1)}%`} color={wrColor} />
      <StatItem label="Total P&L" value={formatCurrency(stats.total_pnl)} color={pnlColor} />
      <StatItem label="Avg P&L" value={formatCurrency(stats.avg_pnl)} color={avgColor} />
      <StatItem label="Best Trade" value={formatCurrency(stats.best_trade)} color="text-emerald-400" />
      <StatItem label="Worst Trade" value={formatCurrency(stats.worst_trade)} color="text-red-400" />
      <StatItem
        label="Profit Factor"
        value={stats.profit_factor === Infinity ? '∞' : stats.profit_factor.toFixed(2)}
        color={stats.profit_factor >= 1.5 ? 'text-emerald-400' : stats.profit_factor >= 1 ? 'text-amber-400' : 'text-red-400'}
      />
      <StatItem label="Avg Win" value={formatCurrency(stats.avg_win)} color="text-emerald-400" />
    </div>
  )
}
