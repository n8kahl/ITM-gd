'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'

interface XpDisplayProps {
  currentXp: number
  className?: string
}

interface RankInfo {
  name: string
  minXp: number
  maxXp: number
  color: string
}

const RANKS: RankInfo[] = [
  { name: 'Paper Trader', minXp: 0, maxXp: 100, color: 'text-white/60' },
  { name: 'Market Observer', minXp: 100, maxXp: 300, color: 'text-blue-400' },
  { name: 'Chart Reader', minXp: 300, maxXp: 600, color: 'text-cyan-400' },
  { name: 'Strategy Builder', minXp: 600, maxXp: 1000, color: 'text-emerald-400' },
  { name: 'Risk Manager', minXp: 1000, maxXp: 1500, color: 'text-amber-400' },
  { name: 'Options Specialist', minXp: 1500, maxXp: 2500, color: 'text-orange-400' },
  { name: 'Market Strategist', minXp: 2500, maxXp: 4000, color: 'text-purple-400' },
  { name: 'Elite Trader', minXp: 4000, maxXp: 6000, color: 'text-[var(--champagne-hex)]' },
  { name: 'Master Trader', minXp: 6000, maxXp: 10000, color: 'text-rose-400' },
  { name: 'Legend', minXp: 10000, maxXp: Infinity, color: 'text-emerald-300' },
]

function getRank(xp: number): RankInfo {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) return RANKS[i]
  }
  return RANKS[0]
}

export function XpDisplay({ currentXp, className }: XpDisplayProps) {
  const safeXp = useMemo(() => {
    if (!Number.isFinite(currentXp)) return 0
    return Math.max(0, currentXp)
  }, [currentXp])

  const rank = useMemo(() => getRank(safeXp), [safeXp])

  const progressInRank = useMemo(() => {
    if (rank.maxXp === Infinity) return 100
    const range = rank.maxXp - rank.minXp
    const current = safeXp - rank.minXp
    return Math.min(100, Math.round((current / range) * 100))
  }, [safeXp, rank])

  const xpToNext = useMemo(() => {
    if (rank.maxXp === Infinity) return 0
    return rank.maxXp - safeXp
  }, [safeXp, rank])

  return (
    <div className={cn('space-y-2', className)}>
      {/* Rank name + XP count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-500" />
          <span className={cn('text-sm font-semibold', rank.color)}>
            {rank.name}
          </span>
        </div>
        <span className="text-xs text-white/40 font-mono tabular-nums">
          {safeXp.toLocaleString()} XP
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressInRank}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* XP to next rank */}
      {xpToNext > 0 && (
        <p className="text-[11px] text-white/40">
          {xpToNext.toLocaleString()} XP to next rank
        </p>
      )}
    </div>
  )
}
