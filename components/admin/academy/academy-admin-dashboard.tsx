'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  BookOpen,
  Layers,
  FileText,
  Blocks,
  ClipboardCheck,
  Users,
  AlertTriangle,
  ImageOff,
  FileWarning,
  Clock,
  Plus,
  ArrowRight,
  Activity,
} from 'lucide-react'

interface OverviewStats {
  tracks: { total: number; active: number }
  modules: { total: number; published: number; draft: number }
  lessons: { total: number; published: number; draft: number }
  blocks: { total: number }
  assessments: { total: number }
  enrollments: { total: number; active: number; completed: number }
  totalCurriculumMinutes: number
}

interface HealthData {
  lessonsWithoutAssessments: { id: string; title: string }[]
  lessonsWithoutAssessmentsCount: number
  modulesWithoutCovers: { id: string; title: string; slug: string }[]
  modulesWithoutCoversCount: number
  lessonsWithoutHeroImages: { id: string; title: string }[]
  lessonsWithoutHeroImagesCount: number
  emptyLessons: { id: string; title: string }[]
  emptyLessonsCount: number
  orphanedBlockCount: number
}

interface RecentEvent {
  id: string
  userId: string
  eventType: string
  payload: Record<string, unknown>
  occurredAt: string
}

interface DashboardData {
  overview: OverviewStats
  health: HealthData
  recentActivity: RecentEvent[]
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AcademyAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/academy-v3/dashboard')
      if (response.ok) {
        const result = await response.json()
        setData(result.data ?? null)
      }
    } catch (error) {
      console.error('Failed to load academy dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-white/40">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Failed to load dashboard data</p>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDashboard}
          className="mt-4 border-white/10 text-white/60 hover:text-white"
        >
          Retry
        </Button>
      </div>
    )
  }

  const { overview, health, recentActivity } = data
  const totalHealthIssues =
    health.lessonsWithoutAssessmentsCount +
    health.modulesWithoutCoversCount +
    health.lessonsWithoutHeroImagesCount +
    health.emptyLessonsCount +
    health.orphanedBlockCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Academy Dashboard</h1>
          <p className="text-white/60 mt-1">Content management and curriculum health overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={loading}
            className="border-white/10 text-white/60 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/admin/academy/modules">
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-black">
              <Plus className="w-4 h-4 mr-2" />
              New Module
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard
          icon={Layers}
          label="Tracks"
          value={overview.tracks.total}
          sub={`${overview.tracks.active} active`}
        />
        <StatCard
          icon={BookOpen}
          label="Modules"
          value={overview.modules.total}
          sub={`${overview.modules.published} published`}
        />
        <StatCard
          icon={FileText}
          label="Lessons"
          value={overview.lessons.total}
          sub={`${overview.lessons.published} published`}
        />
        <StatCard
          icon={Blocks}
          label="Blocks"
          value={overview.blocks.total}
          sub="content blocks"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Assessments"
          value={overview.assessments.total}
          sub="total"
        />
        <StatCard
          icon={Users}
          label="Enrollments"
          value={overview.enrollments.total}
          sub={`${overview.enrollments.active} active`}
        />
        <StatCard
          icon={Clock}
          label="Curriculum"
          value={`${Math.round(overview.totalCurriculumMinutes / 60)}h`}
          sub={`${overview.totalCurriculumMinutes}m total`}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <QuickAction
          href="/admin/academy/modules"
          label="Manage Modules"
          description="Create, edit, and reorder tracks and modules"
          icon={BookOpen}
        />
        <QuickAction
          href="/admin/academy/analytics"
          label="View Analytics"
          description="Enrollment stats, completion rates, and drop-off analysis"
          icon={Activity}
        />
        <QuickAction
          href="/admin/courses"
          label="Legacy Course Editor"
          description="Original course management (will be replaced)"
          icon={FileText}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Indicators */}
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${totalHealthIssues > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
              Content Health
              {totalHealthIssues > 0 && (
                <span className="ml-auto text-sm font-normal text-amber-400">
                  {totalHealthIssues} issue{totalHealthIssues !== 1 ? 's' : ''}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <HealthRow
              icon={ClipboardCheck}
              label="Lessons without assessments"
              count={health.lessonsWithoutAssessmentsCount}
              items={health.lessonsWithoutAssessments}
            />
            <HealthRow
              icon={ImageOff}
              label="Modules without cover images"
              count={health.modulesWithoutCoversCount}
              items={health.modulesWithoutCovers}
            />
            <HealthRow
              icon={ImageOff}
              label="Lessons without hero images"
              count={health.lessonsWithoutHeroImagesCount}
              items={health.lessonsWithoutHeroImages}
            />
            <HealthRow
              icon={FileWarning}
              label="Empty lessons (no blocks)"
              count={health.emptyLessonsCount}
              items={health.emptyLessons}
            />
            {health.orphanedBlockCount > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-red-300">
                  {health.orphanedBlockCount} orphaned block{health.orphanedBlockCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {totalHealthIssues === 0 && (
              <div className="text-center py-6 text-emerald-400/60">
                All content is healthy
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-6 text-white/40">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentActivity.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">
                        {formatEventType(event.eventType)}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        User {event.userId.slice(0, 8)}...
                      </p>
                    </div>
                    <span className="text-xs text-white/30 flex-shrink-0">
                      {timeAgo(event.occurredAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof BookOpen
  label: string
  value: number | string
  sub: string
}) {
  return (
    <Card className="bg-[#0a0a0b] border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-white/50 uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-bold text-white font-mono">{value}</p>
        <p className="text-xs text-white/40 mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function QuickAction({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string
  label: string
  description: string
  icon: typeof BookOpen
}) {
  return (
    <Link href={href}>
      <Card className="bg-[#0a0a0b] border-white/10 hover:border-emerald-500/30 transition-colors cursor-pointer group">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
            <Icon className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">{label}</p>
            <p className="text-xs text-white/40 truncate">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors" />
        </CardContent>
      </Card>
    </Link>
  )
}

function HealthRow({
  icon: Icon,
  label,
  count,
  items,
}: {
  icon: typeof BookOpen
  label: string
  count: number
  items: { id: string; title: string }[]
}) {
  if (count === 0) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <Icon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span className="text-sm text-emerald-300">{label}: 0</span>
      </div>
    )
  }

  return (
    <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <span className="text-sm text-amber-300">
          {label}: {count}
        </span>
      </div>
      {items.length > 0 && (
        <div className="mt-2 ml-7 space-y-1">
          {items.slice(0, 5).map((item) => (
            <p key={item.id} className="text-xs text-white/40 truncate">
              {item.title}
            </p>
          ))}
          {count > 5 && (
            <p className="text-xs text-white/30">+{count - 5} more</p>
          )}
        </div>
      )}
    </div>
  )
}
