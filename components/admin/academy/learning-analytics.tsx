'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Users,
  UserCheck,
  GraduationCap,
  Target,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface LearningAnalyticsProps {
  period?: '7d' | '30d' | '90d'
  courseId?: string
}

type Period = '7d' | '30d' | '90d'

interface OverviewStats {
  total_learners: number
  total_learners_change: number
  active_learners: number
  active_learners_change: number
  completion_rate: number
  completion_rate_change: number
  avg_quiz_score: number
  avg_quiz_score_change: number
}

interface DailyActiveLearner {
  date: string
  count: number
}

interface QuizScoreDistribution {
  range: string
  count: number
}

interface StrugglingLesson {
  lesson_id: string
  lesson_title: string
  course_title: string
  avg_score: number
  completion_rate: number
  user_count: number
}

interface CourseCompletion {
  course_id: string
  course_title: string
  completion_rate: number
}

interface AnalyticsData {
  overview: OverviewStats
  daily_active_learners: DailyActiveLearner[]
  quiz_score_distribution: QuizScoreDistribution[]
  struggling_lessons: StrugglingLesson[]
  course_completions: CourseCompletion[]
}

type SortKey = 'lesson_title' | 'course_title' | 'avg_score' | 'completion_rate' | 'user_count'
type SortDir = 'asc' | 'desc'

const periodLabels: Record<Period, string> = {
  '7d': 'Last 7 Days',
  '30d': 'Last 30 Days',
  '90d': 'Last 90 Days',
}

export function LearningAnalytics({ period: initialPeriod = '30d', courseId }: LearningAnalyticsProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('avg_score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ period })
      if (courseId) params.set('courseId', courseId)

      const response = await fetch(`/api/admin/academy/analytics?${params.toString()}`)

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to fetch analytics')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [period, courseId])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedLessons = data?.struggling_lessons
    ? [...data.struggling_lessons].sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }
        const numA = aVal as number
        const numB = bVal as number
        return sortDir === 'asc' ? numA - numB : numB - numA
      })
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center animate-pulse">
              <GraduationCap className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <p className="text-white/40 text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-8 flex flex-col items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mb-3" />
        <p className="text-white/60 text-sm mb-4">{error}</p>
        <button
          onClick={fetchAnalytics}
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 p-1 w-fit">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              period === p
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'text-white/40 hover:text-white/60 border border-transparent'
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Learners"
          value={data.overview.total_learners.toLocaleString()}
          change={data.overview.total_learners_change}
          icon={Users}
        />
        <StatCard
          title="Active Learners"
          value={data.overview.active_learners.toLocaleString()}
          change={data.overview.active_learners_change}
          icon={UserCheck}
        />
        <StatCard
          title="Completion Rate"
          value={`${data.overview.completion_rate.toFixed(1)}%`}
          change={data.overview.completion_rate_change}
          icon={GraduationCap}
        />
        <StatCard
          title="Avg Quiz Score"
          value={`${data.overview.avg_quiz_score.toFixed(1)}%`}
          change={data.overview.avg_quiz_score_change}
          icon={Target}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Active Learners - Area Chart */}
        <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">
            Daily Active Learners
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_active_learners}>
                <defs>
                  <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#emeraldGradient)"
                  name="Active Learners"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quiz Score Distribution - Bar Chart */}
        <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">
            Quiz Score Distribution
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.quiz_score_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="range"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {data.quiz_score_distribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index >= data.quiz_score_distribution.length - 2
                          ? '#10B981'
                          : index >= data.quiz_score_distribution.length - 4
                            ? '#6EE7B7'
                            : '#6EE7B760'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Struggling Lessons Table */}
      <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-4 w-4 text-[#F3E5AB]" />
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Struggling Lessons
          </h3>
          <span className="ml-auto text-xs text-white/30">
            Lessons with low scores or completion
          </span>
        </div>

        {sortedLessons.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            No struggling lessons found for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <SortableHeader
                    label="Lesson"
                    sortKey="lesson_title"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Course"
                    sortKey="course_title"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Avg Score"
                    sortKey="avg_score"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Completion Rate"
                    sortKey="completion_rate"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Users"
                    sortKey="user_count"
                    currentSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedLessons.map((lesson) => (
                  <tr
                    key={lesson.lesson_id}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4 text-white font-medium">{lesson.lesson_title}</td>
                    <td className="py-3 pr-4 text-white/50">{lesson.course_title}</td>
                    <td className="py-3 pr-4 text-right">
                      <span
                        className={cn(
                          'font-mono text-sm',
                          lesson.avg_score < 50
                            ? 'text-red-400'
                            : lesson.avg_score < 70
                              ? 'text-[#F3E5AB]'
                              : 'text-emerald-400'
                        )}
                      >
                        {lesson.avg_score.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              lesson.completion_rate < 50
                                ? 'bg-red-400'
                                : lesson.completion_rate < 70
                                  ? 'bg-[#F3E5AB]'
                                  : 'bg-emerald-400'
                            )}
                            style={{ width: `${lesson.completion_rate}%` }}
                          />
                        </div>
                        <span className="text-white/50 font-mono text-xs w-10 text-right">
                          {lesson.completion_rate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-white/50 font-mono">
                      {lesson.user_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Course Completion Rates - Horizontal Bar Chart */}
      <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-6">
          Course Completion Rates
        </h3>
        {data.course_completions.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            No course completion data available.
          </div>
        ) : (
          <div style={{ height: Math.max(200, data.course_completions.length * 48) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.course_completions}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="course_title"
                  stroke="rgba(255,255,255,0.4)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={160}
                />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <Bar
                  dataKey="completion_rate"
                  name="Completion Rate"
                  radius={[0, 4, 4, 0]}
                  fill="#10B981"
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

/* Stat Card Sub-component */
function StatCard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string
  value: string
  change: number
  icon: React.ComponentType<{ className?: string }>
}) {
  const isPositive = change >= 0

  return (
    <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <Icon className="h-4 w-4 text-emerald-400" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-white">{value}</span>
        <div
          className={cn(
            'flex items-center gap-0.5 text-xs font-medium',
            isPositive ? 'text-emerald-400' : 'text-red-400'
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>
    </div>
  )
}

/* Custom Recharts Tooltip */
function CustomTooltip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  suffix?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg bg-[#0A0A0B] border border-white/10 px-3 py-2 shadow-xl">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm font-medium text-white">
          {entry.name}: {entry.value.toLocaleString()}
          {suffix}
        </p>
      ))}
    </div>
  )
}

/* Sortable Table Header */
function SortableHeader({
  label,
  sortKey: key,
  currentSortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  currentSortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = currentSortKey === key

  return (
    <th
      className={cn(
        'py-3 pr-4 text-xs font-medium text-white/40 uppercase tracking-wider cursor-pointer select-none hover:text-white/60 transition-colors',
        align === 'right' && 'text-right'
      )}
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          sortDir === 'asc' ? (
            <ChevronUp className="h-3 w-3 text-emerald-400" />
          ) : (
            <ChevronDown className="h-3 w-3 text-emerald-400" />
          )
        )}
      </span>
    </th>
  )
}
