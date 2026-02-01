'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users,
  GraduationCap,
  Notebook,
  MessageSquare,
  TrendingUp,
  Clock,
  Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DashboardMetrics {
  totalMembers: number
  activeLearners: number
  journalEntriesToday: number
  openChats: number
  pendingApplications: number
  totalCourses: number
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMembers: 0,
    activeLearners: 0,
    journalEntriesToday: 0,
    openChats: 0,
    pendingApplications: 0,
    totalCourses: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Fetch metrics in parallel
        const [
          membersResult,
          chatsResult,
          applicationsResult,
          coursesResult,
        ] = await Promise.all([
          // Total subscribers (members)
          supabase.from('subscribers').select('id', { count: 'exact', head: true }),
          // Open chat conversations
          supabase.from('chat_conversations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'active'),
          // Pending applications
          supabase.from('cohort_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          // Total courses
          supabase.from('courses')
            .select('id', { count: 'exact', head: true }),
        ])

        setMetrics({
          totalMembers: membersResult.count || 0,
          activeLearners: 0, // Will be populated when lesson progress tracking is added
          journalEntriesToday: 0, // Will be populated when journal feature is added
          openChats: chatsResult.count || 0,
          pendingApplications: applicationsResult.count || 0,
          totalCourses: coursesResult.count || 0,
        })
      } catch (error) {
        console.error('Failed to load dashboard metrics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [])

  const statCards = [
    {
      title: 'Total Members',
      value: metrics.totalMembers,
      icon: Users,
      color: 'text-[#D4AF37]',
      bgColor: 'bg-[#D4AF37]/10',
      borderColor: 'border-[#D4AF37]/30',
    },
    {
      title: 'Active Learners',
      value: metrics.activeLearners,
      icon: GraduationCap,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      subtitle: 'Coming soon',
    },
    {
      title: 'Journal Entries Today',
      value: metrics.journalEntriesToday,
      icon: Notebook,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      subtitle: 'Coming soon',
    },
    {
      title: 'Open Chats',
      value: metrics.openChats,
      icon: MessageSquare,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    },
    {
      title: 'Pending Applications',
      value: metrics.pendingApplications,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    },
    {
      title: 'Total Courses',
      value: metrics.totalCourses,
      icon: Activity,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          Welcome to <span className="text-[#D4AF37]">Nexus</span>
        </h1>
        <p className="text-white/60 mt-1">
          Your TradeITM admin command center
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon

          return (
            <Card
              key={stat.title}
              className={`bg-[#0a0a0b] border ${stat.borderColor} hover:bg-white/[0.02] transition-colors`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-white/60">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-8 w-16 bg-white/5 animate-pulse rounded" />
                ) : (
                  <>
                    <div className={`text-3xl font-bold ${stat.color}`}>
                      {stat.value}
                    </div>
                    {stat.subtitle && (
                      <p className="text-xs text-white/40 mt-1">{stat.subtitle}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            href="/admin/leads"
            icon={Users}
            title="Review Leads"
            description="Check pending applications"
            color="amber"
          />
          <QuickActionCard
            href="/admin/chat"
            icon={MessageSquare}
            title="View Chats"
            description="Respond to customer inquiries"
            color="purple"
          />
          <QuickActionCard
            href="/admin/courses"
            icon={GraduationCap}
            title="Manage Courses"
            description="Create and edit course content"
            color="emerald"
          />
          <QuickActionCard
            href="/admin/analytics"
            icon={TrendingUp}
            title="Analytics"
            description="View site performance"
            color="blue"
          />
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-white/40 text-sm text-center py-8">
              Activity feed coming soon
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="API" status="operational" />
            <StatusRow label="Database" status="operational" />
            <StatusRow label="Chat System" status="operational" />
            <StatusRow label="Discord Bot" status="operational" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Quick Action Card Component
function QuickActionCard({
  href,
  icon: Icon,
  title,
  description,
  color,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  color: 'amber' | 'purple' | 'emerald' | 'blue'
}) {
  const colorClasses = {
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
  }

  return (
    <a
      href={href}
      className={`block p-4 rounded-xl border ${colorClasses[color]} transition-colors group`}
    >
      <Icon className={`w-6 h-6 mb-3 ${colorClasses[color].split(' ')[0]}`} />
      <h3 className="font-medium text-white group-hover:text-white/90">{title}</h3>
      <p className="text-xs text-white/50 mt-1">{description}</p>
    </a>
  )
}

// Status Row Component
function StatusRow({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
  const statusColors = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-xs text-white/40 capitalize">{status}</span>
      </div>
    </div>
  )
}
