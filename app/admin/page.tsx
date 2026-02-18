'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  GraduationCap,
  FileText,
  Clock,
  MessageSquare,
  UserPlus,
  BookOpenCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminAnalyticsResponse, AnalyticsPeriod } from '@/lib/admin-analytics'

interface SystemDiagnostic {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  latency?: number
}

interface RecentLead {
  id: string
  full_name?: string | null
  name?: string | null
  status: string
  created_at: string
}

const EMPTY_ANALYTICS: AdminAnalyticsResponse = {
  period: '30d',
  platform: {
    total_members: 0,
    new_members: 0,
    total_journal_entries: 0,
    ai_analysis_count: 0,
    ai_coach_sessions: 0,
    ai_coach_messages: 0,
    shared_trade_cards: 0,
    active_users: 0,
    active_learners: 0,
    pending_applications: 0,
  },
  marketing: {
    total_page_views: 0,
    unique_visitors: 0,
    total_clicks: 0,
    total_subscribers: 0,
    total_contacts: 0,
    conversion_rate: 0,
  },
  page_views_by_day: [],
  conversions_by_day: [],
  conversion_funnel: {
    modal_opened: 0,
    modal_closed: 0,
    form_submitted: 0,
    subscribed: 0,
  },
  device_breakdown: {},
  browser_breakdown: {},
  click_breakdown: {},
  top_pages: [],
  recent_subscribers: [],
  recent_contacts: [],
  recent_page_views: [],
  recent_sales: [],
  ai_coach_activity: [],
}

export default function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<AnalyticsPeriod>('30d')
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse>(EMPTY_ANALYTICS)
  const [todayAnalytics, setTodayAnalytics] = useState<AdminAnalyticsResponse>(EMPTY_ANALYTICS)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<SystemDiagnostic[]>([])
  const [systemLoading, setSystemLoading] = useState(true)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [systemHealth, setSystemHealth] = useState('—')

  const loadAnalytics = useCallback(async (period: AnalyticsPeriod) => {
    setAnalyticsLoading(true)
    setLeadsLoading(true)

    try {
      const [periodResponse, todayResponse, recentLeadsResponse] = await Promise.all([
        fetch(`/api/admin/analytics?period=${period}`),
        fetch('/api/admin/analytics?period=today'),
        fetch('/api/admin/leads?limit=5'),
      ])

      if (periodResponse.ok) {
        const periodData = await periodResponse.json()
        setAnalytics(periodData)
      }

      if (todayResponse.ok) {
        const todayData = await todayResponse.json()
        setTodayAnalytics(todayData)
      }

      if (recentLeadsResponse.ok) {
        const leadsPayload = await recentLeadsResponse.json()
        setRecentLeads(leadsPayload.data || [])
      }
    } catch (error) {
      console.error('Failed to load admin command center data:', error)
    } finally {
      setAnalyticsLoading(false)
      setLeadsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(selectedPeriod)
  }, [selectedPeriod, loadAnalytics])

  useEffect(() => {
    const loadSystemStatus = async () => {
      try {
        const response = await fetch('/api/admin/system')
        if (response.ok) {
          const data = await response.json()
          const results = data.results || []
          setSystemStatus(results)

          if (results.length > 0) {
            const passCount = results.filter((r: SystemDiagnostic) => r.status === 'pass').length
            const percentage = Math.round((passCount / results.length) * 100)
            setSystemHealth(`${percentage}%`)
          }
        }
      } catch (error) {
        console.error('Failed to load system status:', error)
      } finally {
        setSystemLoading(false)
      }
    }

    loadSystemStatus()
  }, [])

  const refreshSystemStatus = async () => {
    setSystemLoading(true)
    try {
      const response = await fetch('/api/admin/system')
      if (response.ok) {
        const data = await response.json()
        const results = data.results || []
        setSystemStatus(results)

        if (results.length > 0) {
          const passCount = results.filter((r: SystemDiagnostic) => r.status === 'pass').length
          const percentage = Math.round((passCount / results.length) * 100)
          setSystemHealth(`${percentage}%`)
        }
      }
    } catch (error) {
      console.error('Failed to refresh system status:', error)
    } finally {
      setSystemLoading(false)
    }
  }

  const refreshDashboard = async () => {
    await loadAnalytics(selectedPeriod)
    await refreshSystemStatus()
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const periodLabel = selectedPeriod === 'today'
    ? 'Today'
    : selectedPeriod === '7d'
      ? 'Last 7 Days'
      : 'Last 30 Days'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Command Center</h1>
          <p className="text-sm text-white/50">Live admin operations and platform health</p>
        </div>
        <div className="flex items-center gap-2">
          {(['today', '7d', '30d'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedPeriod === period
                  ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {period === 'today' ? 'Today' : period.toUpperCase()}
            </button>
          ))}
          <button
            onClick={refreshDashboard}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Refresh command center"
          >
            <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <DashboardMetric
          label="Registered Members"
          value={analytics.platform.total_members.toLocaleString()}
          icon={Users}
          color="emerald"
          secondary={`Email Subscribers: ${analytics.marketing.total_subscribers.toLocaleString()}`}
        />
        <DashboardMetric
          label={`New Signups (${periodLabel})`}
          value={analytics.platform.new_members.toLocaleString()}
          icon={UserPlus}
          color="blue"
        />
        <DashboardMetric
          label={`AI Coach Sessions (${periodLabel})`}
          value={analytics.platform.ai_coach_sessions.toLocaleString()}
          icon={MessageSquare}
          color="emerald"
        />
        <DashboardMetric
          label={`Active Learners (${periodLabel})`}
          value={analytics.platform.active_learners.toLocaleString()}
          icon={BookOpenCheck}
          color="blue"
        />
        <DashboardMetric
          label="System Health"
          value={systemHealth}
          icon={Activity}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {analytics.platform.pending_applications > 0 && (
            <Card className="glass-card-heavy p-6 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">
                    {analytics.platform.pending_applications} Pending Application{analytics.platform.pending_applications !== 1 ? 's' : ''}
                  </h3>
                  <p className="text-sm text-white/50">Cohort applications awaiting review</p>
                </div>
                <a
                  href="/admin/leads"
                  className="ml-auto px-4 py-2 text-sm font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
                >
                  Review
                </a>
              </div>
            </Card>
          )}

          <Card className="glass-card-heavy p-6 border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/80">Recent Applications</h3>
              <a href="/admin/leads" className="text-xs text-[#10B981] hover:underline">
                View all
              </a>
            </div>
            <div className="space-y-3">
              {leadsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentLeads.length > 0 ? (
                recentLeads.map((lead) => {
                  const leadName = lead.full_name || lead.name || 'Unknown'
                  return (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center text-[#10B981] text-xs font-medium">
                          {leadName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm text-white">{leadName}</div>
                          <div className="text-xs text-white/40">{formatTimeAgo(lead.created_at)}</div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        lead.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                        lead.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                  )
                })
              ) : (
                <p className="text-white/40 text-sm text-center py-4">No applications yet</p>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickLink href="/admin/courses" icon={GraduationCap} label="Courses" color="emerald" />
            <QuickLink href="/admin/leads" icon={FileText} label="Leads" color="emerald" />
            <QuickLink href="/admin/chat" icon={MessageSquare} label="Chat" color="blue" />
            <QuickLink href="/admin/settings" icon={Activity} label="Settings" color="purple" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card-heavy p-6 border-white/5">
              <h3 className="text-sm font-medium text-white/80 mb-4">Recent Sales</h3>
              <div className="space-y-4">
                {analyticsLoading ? (
                  Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
                  ))
                ) : analytics.recent_sales.length > 0 ? (
                  analytics.recent_sales.slice(0, 3).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">$</div>
                        <div>
                          <div className="text-sm text-white">{sale.subscriber_name}</div>
                          <div className="text-xs text-white/40">{sale.tier_name} • {formatTimeAgo(sale.created_at)}</div>
                        </div>
                      </div>
                      <div className="text-sm font-mono text-emerald-400">+{sale.amount}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">No recent sales</p>
                )}
              </div>
            </Card>

            <Card className="glass-card-heavy p-6 border-white/5">
              <h3 className="text-sm font-medium text-white/80 mb-4">AI Coach Activity</h3>
              <div className="space-y-4">
                {analyticsLoading ? (
                  Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
                  ))
                ) : analytics.ai_coach_activity.length > 0 ? (
                  analytics.ai_coach_activity.map((session) => (
                    <div key={session.session_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">AI</div>
                        <div>
                          <div className="text-sm text-white">{session.user_name}</div>
                          <div className="text-xs text-white/40">{formatTimeAgo(session.created_at)}</div>
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded bg-white/10 text-white/70">
                        {session.message_count} msgs
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-white/40 text-sm py-4 text-center">No recent AI coach sessions</p>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="glass-card-heavy p-6 border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/80">System Status</h3>
              <button
                onClick={refreshSystemStatus}
                disabled={systemLoading}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${systemLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-3">
              {systemLoading && systemStatus.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-5 bg-white/5 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                systemStatus.map((item, i) => (
                  <SystemStatusRow
                    key={i}
                    label={item.name}
                    status={item.status}
                    latency={item.latency}
                  />
                ))
              )}
            </div>
          </Card>

          <Card className="glass-card-heavy p-6 border-white/5">
            <h3 className="text-sm font-medium text-white/80 mb-4">Quick Stats (Today)</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Page Views</span>
                <span className="text-white font-medium">{todayAnalytics.marketing.total_page_views.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Clicks</span>
                <span className="text-white font-medium">{todayAnalytics.marketing.total_clicks.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">New Subscribers</span>
                <span className="text-white font-medium">{todayAnalytics.marketing.total_subscribers.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DashboardMetric({
  label,
  value,
  icon: Icon,
  color,
  secondary,
}: {
  label: string
  value: string
  icon: LucideIcon
  color: 'gold' | 'emerald' | 'blue' | 'purple'
  secondary?: string
}) {
  const colors = {
    gold: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  }

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-md ${colors[color]} transition-all duration-300 hover:scale-[1.02]`}>
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 rounded-lg bg-black/20">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
      {secondary && (
        <div className="text-[11px] text-white/40 mt-2">{secondary}</div>
      )}
    </div>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string
  icon: LucideIcon
  label: string
  color: 'gold' | 'emerald' | 'blue' | 'purple'
}) {
  const colors = {
    gold: 'hover:border-[#10B981]/30 hover:bg-[#10B981]/5',
    emerald: 'hover:border-emerald-500/30 hover:bg-emerald-500/5',
    blue: 'hover:border-blue-500/30 hover:bg-blue-500/5',
    purple: 'hover:border-purple-500/30 hover:bg-purple-500/5',
  }

  const iconColors = {
    gold: 'text-[#10B981]',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  }

  return (
    <a
      href={href}
      className={`flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-white/5 ${colors[color]} transition-all`}
    >
      <Icon className={`w-5 h-5 ${iconColors[color]} mb-2`} />
      <span className="text-xs text-white/70">{label}</span>
    </a>
  )
}

function SystemStatusRow({
  label,
  status,
  latency,
}: {
  label: string
  status: 'pass' | 'fail' | 'warning'
  latency?: number
}) {
  const statusConfig = {
    pass: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-400',
    },
    fail: {
      icon: XCircle,
      color: 'text-red-400',
    },
  }

  const config = statusConfig[status]
  const StatusIcon = config.icon

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        {latency !== undefined && (
          <span className="text-xs text-white/30">{latency}ms</span>
        )}
        <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
      </div>
    </div>
  )
}
