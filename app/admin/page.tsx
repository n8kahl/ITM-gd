/* app/admin/page.tsx */
'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  Users, Activity, MessageSquare,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  GraduationCap, FileText, Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SystemDiagnostic {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  latency?: number
}

interface RecentLead {
  id: string
  full_name: string
  status: string
  created_at: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    chats: 0,
    courses: 0,
    pendingApplications: 0,
    systemHealth: '—'
  })
  const [systemStatus, setSystemStatus] = useState<SystemDiagnostic[]>([])
  const [systemLoading, setSystemLoading] = useState(true)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)

  // Load data from Supabase
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const [
          membersResult,
          chatsResult,
          coursesResult,
          applicationsResult,
        ] = await Promise.all([
          supabase.from('subscribers').select('id', { count: 'exact', head: true }),
          supabase.from('chat_conversations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('cohort_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ])

        setStats(prev => ({
          ...prev,
          users: membersResult.count || 0,
          chats: chatsResult.count || 0,
          courses: coursesResult.count || 0,
          pendingApplications: applicationsResult.count || 0,
        }))
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error)
      }
    }

    loadMetrics()
  }, [])

  // Load recent leads
  useEffect(() => {
    const loadRecentLeads = async () => {
      try {
        const { data, error } = await supabase
          .from('cohort_applications')
          .select('id, full_name, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5)

        if (!error && data) {
          setRecentLeads(data)
        }
      } catch (error) {
        console.error('Failed to load recent leads:', error)
      } finally {
        setLeadsLoading(false)
      }
    }

    loadRecentLeads()
  }, [])

  // Load system status from API
  useEffect(() => {
    const loadSystemStatus = async () => {
      try {
        const response = await fetch('/api/admin/system')
        if (response.ok) {
          const data = await response.json()
          const results = data.results || []
          setSystemStatus(results)

          // Calculate system health percentage
          if (results.length > 0) {
            const passCount = results.filter((r: SystemDiagnostic) => r.status === 'pass').length
            const percentage = Math.round((passCount / results.length) * 100)
            setStats(prev => ({
              ...prev,
              systemHealth: `${percentage}%`
            }))
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
          setStats(prev => ({
            ...prev,
            systemHealth: `${percentage}%`
          }))
        }
      }
    } catch (error) {
      console.error('Failed to refresh system status:', error)
    } finally {
      setSystemLoading(false)
    }
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

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardMetric
          label="Total Members"
          value={stats.users.toLocaleString()}
          icon={Users}
          color="emerald"
        />
        <DashboardMetric
          label="Active Chats"
          value={stats.chats.toString()}
          icon={MessageSquare}
          color="blue"
        />
        <DashboardMetric
          label="Courses"
          value={stats.courses.toString()}
          icon={GraduationCap}
          color="emerald"
        />
        <DashboardMetric
          label="System Health"
          value={stats.systemHealth}
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pending Applications */}
          {stats.pendingApplications > 0 && (
            <Card className="glass-card-heavy p-6 border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">
                    {stats.pendingApplications} Pending Application{stats.pendingApplications !== 1 ? 's' : ''}
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

          {/* Recent Leads */}
          <Card className="glass-card-heavy p-6 border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white/80">Recent Applications</h3>
              <a href="/admin/leads" className="text-xs text-[#D4AF37] hover:underline">
                View all
              </a>
            </div>
            <div className="space-y-3">
              {leadsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-xs font-medium">
                        {lead.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="text-sm text-white">{lead.full_name}</div>
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
                ))
              ) : (
                <p className="text-white/40 text-sm text-center py-4">No applications yet</p>
              )}
            </div>
          </Card>

          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickLink href="/admin/courses" icon={GraduationCap} label="Courses" color="emerald" />
            <QuickLink href="/admin/leads" icon={FileText} label="Leads" color="emerald" />
            <QuickLink href="/admin/chat" icon={MessageSquare} label="Chat" color="blue" />
            <QuickLink href="/admin/settings" icon={Activity} label="Settings" color="purple" />
          </div>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* System Status Card */}
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
                <div className="relative pl-4 space-y-6">
                    {/* Activity Timeline Line */}
                    <div className="absolute left-0 top-2 bottom-2 w-[1px] bg-white/10" />

                    {[
                        { text: "New user joined Discord", time: "1m ago", color: "emerald" },
                        { text: "Server CPU spike detected", time: "15m ago", color: "red" },
                        { text: "Backup completed", time: "1h ago", color: "blue" },
                        { text: "Daily signals posted", time: "4h ago", color: "gold" },
                        { text: "Admin logged in", time: "5h ago", color: "gray" },
                    ].map((item, i) => (
                        <div key={i} className="relative">
                            <div className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#0A0A0B] ${
                                item.color === 'emerald' ? 'bg-emerald-500' :
                                item.color === 'red' ? 'bg-red-500' :
                                item.color === 'blue' ? 'bg-blue-500' :
                                item.color === 'gold' ? 'bg-emerald-500' : 'bg-white/40'
                            }`} />
                            <p className="text-sm text-white/90">{item.text}</p>
                            <p className="text-xs text-white/40 font-mono mt-1">{item.time}</p>
                        </div>
                    ))}
                </div>
            </Card>
>>>>>>> 6c5a005 (Complete platform-wide "De-Golding": Replace 129 gold instances with Emerald)
        </div>
      </div>
    </div>
  )
}

function DashboardMetric({ label, value, icon: Icon, color }: {
  label: string
  value: string
  icon: any
  color: 'gold' | 'emerald' | 'blue' | 'purple'
}) {
  const colors = {
    gold: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
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
    </div>
  )
}

function QuickLink({ href, icon: Icon, label, color }: {
  href: string
  icon: any
  label: string
  color: 'gold' | 'emerald' | 'blue' | 'purple'
}) {
  const colors = {
    gold: "hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/5",
    emerald: "hover:border-emerald-500/30 hover:bg-emerald-500/5",
    blue: "hover:border-blue-500/30 hover:bg-blue-500/5",
    purple: "hover:border-purple-500/30 hover:bg-purple-500/5",
  }

  const iconColors = {
    gold: "text-[#D4AF37]",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
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

// System Status Row Component
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
