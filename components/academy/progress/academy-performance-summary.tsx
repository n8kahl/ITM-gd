'use client'

import { BookCheck, Star, FlameKindling, Zap, ShieldCheck, Clock } from 'lucide-react'

interface PerformanceSummaryProps {
  stats: {
    totalLessonsCompleted: number
    totalLessonsAvailable: number
    averageScore: number
    currentStreak: number
    totalXp: number
    currentLevel: number
    timeSpentMinutes: number
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatXp(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`
  return String(xp)
}

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  iconClass: string
  iconBg: string
  label: string
  value: string
  sub?: string
}

function StatCard({ icon: Icon, iconClass, iconBg, label, value, sub }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/8 bg-white/5 p-3 backdrop-blur-sm">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon size={17} strokeWidth={1.5} className={iconClass} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className={`mt-0.5 font-mono text-xl font-semibold text-white`}>{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-zinc-400">{sub}</p> : null}
      </div>
    </div>
  )
}

export function AcademyPerformanceSummary({ stats }: PerformanceSummaryProps) {
  const completionPercent =
    stats.totalLessonsAvailable > 0
      ? Math.round((stats.totalLessonsCompleted / stats.totalLessonsAvailable) * 100)
      : 0

  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">Performance Summary</h2>
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard
          icon={BookCheck}
          iconClass="text-emerald-400"
          iconBg="bg-emerald-500/20"
          label="Lessons Completed"
          value={String(stats.totalLessonsCompleted)}
          sub={`${completionPercent}% of ${stats.totalLessonsAvailable}`}
        />
        <StatCard
          icon={Star}
          iconClass="text-amber-400"
          iconBg="bg-amber-500/20"
          label="Average Score"
          value={`${stats.averageScore.toFixed(0)}%`}
          sub={stats.averageScore >= 80 ? 'Excellent' : stats.averageScore >= 60 ? 'Good' : 'Keep practicing'}
        />
        <StatCard
          icon={FlameKindling}
          iconClass="text-orange-400"
          iconBg="bg-orange-500/20"
          label="Current Streak"
          value={`${stats.currentStreak}d`}
          sub={stats.currentStreak === 1 ? '1 day' : `${stats.currentStreak} days`}
        />
        <StatCard
          icon={Zap}
          iconClass="text-amber-400"
          iconBg="bg-amber-500/20"
          label="Total XP"
          value={formatXp(stats.totalXp)}
          sub="experience points"
        />
        <StatCard
          icon={ShieldCheck}
          iconClass="text-emerald-400"
          iconBg="bg-emerald-500/20"
          label="Current Level"
          value={`Lv ${stats.currentLevel}`}
          sub={`${stats.totalXp} XP earned`}
        />
        <StatCard
          icon={Clock}
          iconClass="text-zinc-400"
          iconBg="bg-white/10"
          label="Time Spent"
          value={formatMinutes(stats.timeSpentMinutes)}
          sub="total learning time"
        />
      </div>
    </div>
  )
}
