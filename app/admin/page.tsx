/* app/admin/page.tsx */
'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  Users, DollarSign, Activity, MessageSquare,
  ArrowUpRight, ArrowDownRight, MoreHorizontal,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SystemDiagnostic {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  latency?: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    revenue: 0,
    chats: 0,
    systemHealth: '—'
  })
  const [systemStatus, setSystemStatus] = useState<SystemDiagnostic[]>([])
  const [systemLoading, setSystemLoading] = useState(true)

  // Load data from Supabase
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const [
          membersResult,
          chatsResult,
        ] = await Promise.all([
          supabase.from('subscribers').select('id', { count: 'exact', head: true }),
          supabase.from('chat_conversations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
        ])

        setStats(prev => ({
          ...prev,
          users: membersResult.count || 0,
          chats: chatsResult.count || 0,
        }))
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error)
      }
    }

    loadMetrics()
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

  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardMetric
          label="Total Revenue"
          value="$15,400"
          change="+12.5%"
          trend="up"
          icon={DollarSign}
          color="gold"
        />
        <DashboardMetric
          label="Active Users"
          value={stats.users.toLocaleString()}
          change="+3.2%"
          trend="up"
          icon={Users}
          color="emerald"
        />
        <DashboardMetric
          label="Live Chats"
          value={stats.chats.toString()}
          change={stats.chats > 0 ? `${stats.chats} active` : 'None'}
          trend="neutral"
          icon={MessageSquare}
          color="blue"
        />
        <DashboardMetric
          label="System Health"
          value={stats.systemHealth}
          change="Live"
          trend="neutral"
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

        {/* Main Chart / Activity Area (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card-heavy p-6 min-h-[400px] border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-serif font-medium text-white">Revenue Overview</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1 text-xs font-medium bg-white/10 rounded-lg text-white">Weekly</button>
                <button className="px-3 py-1 text-xs font-medium hover:bg-white/5 rounded-lg text-white/40">Monthly</button>
              </div>
            </div>

            {/* Placeholder for Chart */}
            <div className="w-full h-[300px] flex items-end gap-2 px-2">
              {[40, 65, 50, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-emerald-500/10 to-emerald-500/40 rounded-t-sm relative group" style={{ height: `${h}%` }}>
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/50" />
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap border border-white/10">
                        ${h * 150}
                    </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="glass-card-heavy p-6 border-white/5">
                <h3 className="text-sm font-medium text-white/80 mb-4">Recent Sales</h3>
                <div className="space-y-4">
                  {[1,2,3].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs">$</div>
                         <div>
                            <div className="text-sm text-white">Pro Sniper</div>
                            <div className="text-xs text-white/40">2 mins ago</div>
                         </div>
                       </div>
                       <div className="text-sm font-mono text-emerald-400">+$299</div>
                    </div>
                  ))}
                </div>
             </Card>
             <Card className="glass-card-heavy p-6 border-white/5">
                <h3 className="text-sm font-medium text-white/80 mb-4">New Leads</h3>
                <div className="space-y-4">
                  {[1,2,3].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] text-xs">U</div>
                         <div>
                            <div className="text-sm text-white">John Doe</div>
                            <div className="text-xs text-white/40">Applied for Cohort</div>
                         </div>
                       </div>
                       <div className="text-xs px-2 py-1 rounded bg-white/5 text-white/60">Review</div>
                    </div>
                  ))}
                </div>
             </Card>
          </div>
        </div>

        {/* Side Panel (1/3 width) */}
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
              ) : systemStatus.length > 0 ? (
                systemStatus.map((diagnostic) => (
                  <SystemStatusRow
                    key={diagnostic.name}
                    label={diagnostic.name}
                    status={diagnostic.status}
                    latency={diagnostic.latency}
                  />
                ))
              ) : (
                <p className="text-white/40 text-xs text-center py-2">
                  Unable to load status
                </p>
              )}
            </div>
          </Card>

          {/* Activity Timeline */}
          <Card className="glass-card-heavy p-6 border-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-white/80">Live Activity</h3>
              <MoreHorizontal className="w-4 h-4 text-white/40" />
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
                    item.color === 'gold' ? 'bg-[#D4AF37]' : 'bg-white/40'
                  }`} />
                  <p className="text-sm text-white/90">{item.text}</p>
                  <p className="text-xs text-white/40 font-mono mt-1">{item.time}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DashboardMetric({ label, value, change, trend, icon: Icon, color }: any) {
  const colors = {
    gold: "text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  }

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-md ${colors[color as keyof typeof colors]} transition-all duration-300 hover:scale-[1.02]`}>
       <div className="flex justify-between items-start mb-2">
         <div className="p-2 rounded-lg bg-black/20">
            <Icon className="w-5 h-5" />
         </div>
         <span className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-white/40'}`}>
            {change}
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 ml-0.5" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 ml-0.5" />}
         </span>
       </div>
       <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
       <div className="text-xs text-white/50 mt-1">{label}</div>
    </div>
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
      label: 'OK',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-400',
      label: 'Warn',
    },
    fail: {
      icon: XCircle,
      color: 'text-red-400',
      label: 'Down',
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
