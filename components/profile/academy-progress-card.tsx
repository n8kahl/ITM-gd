'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2, GraduationCap, Trophy } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface AcademyProgressCardProps {
  academyData: {
    rank: string
    xp: number
    nextRankXp: number
    achievementCount?: number
  } | null
  loading: boolean
  className?: string
}

// ============================================
// COMPONENT
// ============================================

export function AcademyProgressCard({
  academyData,
  loading,
  className,
}: AcademyProgressCardProps) {
  // Loading state
  if (loading) {
    return (
      <Card
        data-testid="academy-progress"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm text-[#9A9A9A]">Loading progress...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No data
  if (!academyData) {
    return (
      <Card
        data-testid="academy-progress"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <GraduationCap className="w-8 h-8 text-[#9A9A9A]" />
            <p className="text-sm text-[#9A9A9A]">No academy data yet</p>
            <p className="text-xs text-[#9A9A9A]/60">
              Start learning to earn XP and rank up
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const xpProgress =
    academyData.nextRankXp > 0
      ? Math.min((academyData.xp / academyData.nextRankXp) * 100, 100)
      : 0
  const xpRemaining = Math.max(academyData.nextRankXp - academyData.xp, 0)

  return (
    <Card
      data-testid="academy-progress"
      className={cn('glass-card-heavy border-white/[0.08]', className)}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-[#F5F5F0] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-emerald-400" />
            Academy Progress
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        {/* XP + Rank */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
            >
              {academyData.rank}
            </Badge>
          </div>
          <span className="text-sm font-mono-numbers text-[#F5F5F0]">
            {academyData.xp.toLocaleString()} XP
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-[#9A9A9A]">
              {xpProgress.toFixed(0)}% to next rank
            </span>
            <span className="text-[10px] text-[#9A9A9A] font-mono-numbers">
              {xpRemaining.toLocaleString()} XP remaining
            </span>
          </div>
        </div>

        {/* Achievement Count */}
        {academyData.achievementCount != null && academyData.achievementCount > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F5EDCC]" />
            <span className="text-sm text-[#F5F5F0]">
              {academyData.achievementCount}{' '}
              {academyData.achievementCount === 1 ? 'Achievement' : 'Achievements'}{' '}
              Earned
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
