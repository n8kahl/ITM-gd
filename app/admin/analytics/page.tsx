"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users,
  Eye,
  MousePointerClick,
  Mail,
  MessageSquare,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  TrendingUp,
  Download,
  Calendar,
  RefreshCw
} from "lucide-react"
import {
  getSubscribers,
  getContactSubmissions,
  getPageViews,
  getClickEvents,
  getDeviceBreakdown,
  getBrowserBreakdown,
  Subscriber,
  ContactSubmission,
  PageView,
  ClickEvent
} from "@/lib/supabase"
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"

interface AnalyticsData {
  subscribers: Subscriber[]
  contacts: ContactSubmission[]
  pageViews: PageView[]
  clickEvents: ClickEvent[]
  deviceBreakdown: Record<string, number>
  browserBreakdown: Record<string, number>
}

const COLORS = {
  desktop: '#047857', // emerald
  mobile: '#d4af37', // champagne
  tablet: '#6366f1', // indigo
  chrome: '#4285f4',
  safari: '#000000',
  firefox: '#ff7139',
  edge: '#0078d7',
  other: '#9ca3af'
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('30days')
  const [data, setData] = useState<AnalyticsData>({
    subscribers: [],
    contacts: [],
    pageViews: [],
    clickEvents: [],
    deviceBreakdown: {},
    browserBreakdown: {}
  })

  // Check admin access
  useEffect(() => {
    const checkAuth = () => {
      const cookies = document.cookie.split(';')
      const adminCookie = cookies.find(c => c.trim().startsWith('titm_admin='))

      if (!adminCookie || !adminCookie.includes('true')) {
        router.push('/')
      }
    }

    checkAuth()
  }, [router])

  // Load analytics data
  const loadData = async () => {
    setLoading(true)
    try {
      const [subs, contacts, views, clicks, devices, browsers] = await Promise.all([
        getSubscribers(1000),
        getContactSubmissions(1000),
        getPageViews(1000),
        getClickEvents(1000),
        getDeviceBreakdown(dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 365),
        getBrowserBreakdown(dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 365),
      ])

      setData({
        subscribers: subs || [],
        contacts: contacts || [],
        pageViews: views || [],
        clickEvents: clicks || [],
        deviceBreakdown: devices || {},
        browserBreakdown: browsers || {}
      })
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [dateRange])

  // Calculated metrics
  const uniqueVisitors = new Set(data.pageViews.map(v => v.session_id)).size
  const totalPageViews = data.pageViews.length
  const totalClicks = data.clickEvents.length
  const totalSubscribers = data.subscribers.length
  const totalContacts = data.contacts.length

  // Device data for pie chart
  const deviceData = Object.entries(data.deviceBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }))

  // Browser data for pie chart
  const browserData = Object.entries(data.browserBreakdown).map(([name, value]) => ({
    name: name.split(' ')[0] || 'Unknown',
    value
  }))

  // Click events breakdown
  const clickBreakdown = data.clickEvents.reduce((acc, event) => {
    const type = event.element_type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const clickData = Object.entries(clickBreakdown).map(([name, value]) => ({
    name: name.replace(/_/g, ' ').toUpperCase(),
    value
  }))

  // Export to CSV
  const exportToCSV = (dataType: 'subscribers' | 'contacts' | 'pageviews' | 'clicks') => {
    let csvContent = ''
    let filename = ''

    switch (dataType) {
      case 'subscribers':
        csvContent = 'Name,Email,Phone,Instagram,Twitter,Created At\n'
        csvContent += data.subscribers.map(s =>
          `"${s.name}","${s.email}","${s.phone || ''}","${s.instagram_handle || ''}","${s.twitter_handle || ''}","${s.created_at}"`
        ).join('\n')
        filename = 'subscribers.csv'
        break
      case 'contacts':
        csvContent = 'Name,Email,Phone,Message,Created At\n'
        csvContent += data.contacts.map(c =>
          `"${c.name}","${c.email}","${c.phone || ''}","${c.message}","${c.created_at}"`
        ).join('\n')
        filename = 'contacts.csv'
        break
      case 'pageviews':
        csvContent = 'Session ID,Page,Referrer,Device,Browser,OS,Created At\n'
        csvContent += data.pageViews.map(p =>
          `"${p.session_id}","${p.page_path}","${p.referrer || ''}","${p.device_type}","${p.browser}","${p.os}","${p.created_at}"`
        ).join('\n')
        filename = 'pageviews.csv'
        break
      case 'clicks':
        csvContent = 'Session ID,Element Type,Label,Value,Page,Created At\n'
        csvContent += data.clickEvents.map(c =>
          `"${c.session_id}","${c.element_type}","${c.element_label || ''}","${c.element_value || ''}","${c.page_path}","${c.created_at}"`
        ).join('\n')
        filename = 'clicks.csv'
        break
    }

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

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
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-gradient-champagne">TradeITM</span>
                <span className="text-muted-foreground">Analytics</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time insights and metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/leads')}
              >
                Leads
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/packages')}
              >
                Packages
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  document.cookie = 'titm_admin=; path=/; max-age=0'
                  router.push('/')
                }}
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="flex gap-2 mt-4">
            {(['today', '7days', '30days', 'all'] as const).map(range => (
              <Button
                key={range}
                variant={dateRange === range ? 'luxury-champagne' : 'outline'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === 'today' ? 'Today' : range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : 'All Time'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-champagne">{totalPageViews.toLocaleString()}</div>
                <Eye className="h-8 w-8 text-champagne/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Visitors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-wealth-emerald">{uniqueVisitors.toLocaleString()}</div>
                <Users className="h-8 w-8 text-wealth-emerald/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscribers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-champagne">{totalSubscribers.toLocaleString()}</div>
                <Mail className="h-8 w-8 text-champagne/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contact Forms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-wealth-emerald">{totalContacts.toLocaleString()}</div>
                <MessageSquare className="h-8 w-8 text-wealth-emerald/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-champagne">{totalClicks.toLocaleString()}</div>
                <MousePointerClick className="h-8 w-8 text-champagne/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Device Breakdown */}
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
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS] || COLORS.other} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No device data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Click Events Breakdown */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="h-5 w-5" />
                Click Heatmap
              </CardTitle>
              <CardDescription>Most clicked elements</CardDescription>
            </CardHeader>
            <CardContent>
              {clickData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={clickData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis tick={{ fill: '#999' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="value" fill="#d4af37" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No click data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscribers Table */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Subscribers ({data.subscribers.length})
                </CardTitle>
                <CardDescription>All email signups</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV('subscribers')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Phone</th>
                    <th className="text-left py-3 px-4">Instagram</th>
                    <th className="text-left py-3 px-4">Twitter</th>
                    <th className="text-left py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscribers.map((sub, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-muted/5">
                      <td className="py-3 px-4">{sub.name}</td>
                      <td className="py-3 px-4">{sub.email}</td>
                      <td className="py-3 px-4">{sub.phone || '-'}</td>
                      <td className="py-3 px-4">{sub.instagram_handle || '-'}</td>
                      <td className="py-3 px-4">{sub.twitter_handle || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.subscribers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No subscribers yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Submissions Table */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Contact Submissions ({data.contacts.length})
                </CardTitle>
                <CardDescription>All contact form messages</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV('contacts')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Message</th>
                    <th className="text-left py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contacts.map((contact, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-muted/5">
                      <td className="py-3 px-4">{contact.name}</td>
                      <td className="py-3 px-4">{contact.email}</td>
                      <td className="py-3 px-4 max-w-md truncate">{contact.message}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.contacts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No contact submissions yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Page Views Summary */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Recent Page Views
                </CardTitle>
                <CardDescription>Latest visitor activity</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV('pageviews')}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4">Page</th>
                    <th className="text-left py-3 px-4">Device</th>
                    <th className="text-left py-3 px-4">Browser</th>
                    <th className="text-left py-3 px-4">Referrer</th>
                    <th className="text-left py-3 px-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pageViews.slice(0, 20).map((view, idx) => (
                    <tr key={idx} className="border-b border-border/40 hover:bg-muted/5">
                      <td className="py-3 px-4">{view.page_path}</td>
                      <td className="py-3 px-4 capitalize">{view.device_type || '-'}</td>
                      <td className="py-3 px-4">{view.browser || '-'}</td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground">
                        {view.referrer || 'Direct'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {view.created_at ? new Date(view.created_at).toLocaleTimeString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.pageViews.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No page views yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
