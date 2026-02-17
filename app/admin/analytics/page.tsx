'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Eye,
  MousePointerClick,
  Mail,
  MessageSquare,
  Smartphone,
  Globe,
  TrendingUp,
  Calendar,
  RefreshCw,
  Filter,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import type { AdminAnalyticsResponse, AnalyticsPeriod } from '@/lib/admin-analytics'

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

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#6b7280']

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [data, setData] = useState<AdminAnalyticsResponse>(EMPTY_ANALYTICS)

  const loadData = async (targetPeriod: AnalyticsPeriod) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics?period=${targetPeriod}`)
      if (!response.ok) {
        throw new Error(`Failed to load analytics (${response.status})`)
      }
      const payload = await response.json()
      setData(payload)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(period)
  }, [period])

  const deviceData = Object.entries(data.device_breakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }))

  const browserData = Object.entries(data.browser_breakdown).map(([name, value]) => ({
    name: name.split(' ')[0] || 'Unknown',
    value,
  }))

  const clickData = Object.entries(data.click_breakdown).map(([name, value]) => ({
    name: name.replaceAll('_', ' ').toUpperCase(),
    value,
  }))

  const funnelData = [
    { name: 'Modal Opened', value: data.conversion_funnel.modal_opened },
    { name: 'Modal Closed', value: data.conversion_funnel.modal_closed },
    { name: 'Form Submitted', value: data.conversion_funnel.form_submitted },
    { name: 'Subscribed', value: data.conversion_funnel.subscribed },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-champagne mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-gradient-champagne">TradeITM</span>
                <span className="text-muted-foreground">Analytics</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Unified admin analytics (server-side aggregation)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(period)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/admin')}>
                Command Center
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {(['today', '7d', '30d', '90d', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={period === range ? 'luxury-champagne' : 'outline'}
                size="sm"
                onClick={() => setPeriod(range)}
              >
                {range === 'today'
                  ? 'Today'
                  : range === '7d'
                    ? 'Last 7 Days'
                    : range === '30d'
                      ? 'Last 30 Days'
                      : range === '90d'
                        ? 'Last 90 Days'
                        : 'All Time'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <MetricCard title="Total Page Views" value={data.marketing.total_page_views.toLocaleString()} icon={Eye} accent="text-champagne" />
          <MetricCard title="Unique Visitors" value={data.marketing.unique_visitors.toLocaleString()} icon={Users} accent="text-wealth-emerald" />
          <MetricCard title="Total Clicks" value={data.marketing.total_clicks.toLocaleString()} icon={MousePointerClick} accent="text-champagne" />
          <MetricCard title="Subscribers" value={data.marketing.total_subscribers.toLocaleString()} icon={Mail} accent="text-wealth-emerald" />
          <MetricCard title="Contact Forms" value={data.marketing.total_contacts.toLocaleString()} icon={MessageSquare} accent="text-champagne" />
          <MetricCard title="Conversion Rate" value={`${data.marketing.conversion_rate.toFixed(2)}%`} icon={TrendingUp} accent="text-wealth-emerald" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Page Views Over Time
              </CardTitle>
              <CardDescription>Daily page views in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {data.page_views_by_day.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.page_views_by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fill: '#999', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#999' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Line type="monotone" dataKey="views" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No page view data available for this range" />
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Conversion Funnel
              </CardTitle>
              <CardDescription>modal_opened → modal_closed → form_submitted → subscribed</CardDescription>
            </CardHeader>
            <CardContent>
              {funnelData.some((item) => item.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={funnelData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#999' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No conversion events available for this range" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Browser Breakdown
              </CardTitle>
              <CardDescription>Traffic by browser family</CardDescription>
            </CardHeader>
            <CardContent>
              {browserData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={browserData}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      dataKey="value"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {browserData.map((_, index) => (
                        <Cell key={`browser-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No browser data available for this range" />
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Device Breakdown
              </CardTitle>
              <CardDescription>Traffic by device type</CardDescription>
            </CardHeader>
            <CardContent>
              {deviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={105}
                      dataKey="value"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {deviceData.map((_, index) => (
                        <Cell key={`device-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No device data available for this range" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most viewed paths in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {data.top_pages.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.top_pages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" tick={{ fill: '#999' }} />
                    <YAxis dataKey="path" type="category" width={120} tick={{ fill: '#999', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="views" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No page-path distribution available for this range" />
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Click Breakdown</CardTitle>
              <CardDescription>Element types receiving clicks</CardDescription>
            </CardHeader>
            <CardContent>
              {clickData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={clickData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 11 }} angle={-40} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: '#999' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="value" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState message="No click-event breakdown available for this range" />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Subscribers ({data.recent_subscribers.length})</CardTitle>
            <CardDescription>Entries returned from server-side analytics API</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              emptyMessage="No subscribers in this period"
              headers={['Name', 'Email', 'Phone', 'Instagram', 'Twitter', 'Date']}
              rows={data.recent_subscribers.map((sub) => ([
                sub.name || '—',
                sub.email,
                sub.phone || '—',
                sub.instagram_handle || '—',
                sub.twitter_handle || '—',
                new Date(sub.created_at).toLocaleDateString(),
              ]))}
            />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Contact Submissions ({data.recent_contacts.length})</CardTitle>
            <CardDescription>Entries returned from server-side analytics API</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              emptyMessage="No contact submissions in this period"
              headers={['Name', 'Email', 'Message', 'Date']}
              rows={data.recent_contacts.map((contact) => ([
                contact.name,
                contact.email,
                contact.message,
                new Date(contact.created_at).toLocaleString(),
              ]))}
            />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Page Views ({data.recent_page_views.length})</CardTitle>
            <CardDescription>Latest page view events in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              emptyMessage="No page views in this period"
              headers={['Page', 'Device', 'Browser', 'Referrer', 'Time']}
              rows={data.recent_page_views.map((view) => ([
                view.page_path,
                view.device_type || '—',
                view.browser || '—',
                view.referrer || 'Direct',
                new Date(view.created_at).toLocaleString(),
              ]))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  icon: ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <Card className="glass-card border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className={`text-3xl font-bold ${accent}`}>{value}</div>
          <Icon className={`h-8 w-8 ${accent} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
      {message}
    </div>
  )
}

function DataTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[]
  rows: string[][]
  emptyMessage: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th key={header} className="text-left py-3 px-4">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/40 hover:bg-muted/5">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="py-3 px-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
      )}
    </div>
  )
}
