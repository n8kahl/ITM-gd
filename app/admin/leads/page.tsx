"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Users,
  CheckCircle,
  XCircle,
  MessageCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Download,
  Filter
} from "lucide-react"
import { getCohortApplications, updateCohortApplicationStatus, CohortApplication } from "@/lib/supabase"

type StatusFilter = 'all' | CohortApplication['status']

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  contacted: { label: 'Contacted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MessageCircle },
}

export default function LeadsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<CohortApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

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

  // Load applications
  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getCohortApplications(1000, 0, statusFilter === 'all' ? undefined : statusFilter)
      setApplications(data || [])
    } catch (error) {
      console.error('Failed to load applications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  // Update application status
  const handleStatusUpdate = async (id: string, newStatus: CohortApplication['status']) => {
    setUpdating(id)
    try {
      await updateCohortApplicationStatus(id, newStatus, undefined, 'Admin')
      // Update local state
      setApplications(prev => prev.map(app =>
        app.id === id ? { ...app, status: newStatus, reviewed_at: new Date().toISOString() } : app
      ))
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdating(null)
    }
  }

  // Calculate metrics
  const metrics = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    contacted: applications.filter(a => a.status === 'contacted').length,
  }

  // Export to CSV
  const exportToCSV = () => {
    let csvContent = 'Name,Email,Phone,Status,Message,Created At,Reviewed At\n'
    csvContent += applications.map(a =>
      `"${a.name}","${a.email}","${a.phone || ''}","${a.status}","${a.message.replace(/"/g, '""')}","${a.created_at}","${a.reviewed_at || ''}"`
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cohort-applications.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-champagne mx-auto mb-4" />
          <p className="text-muted-foreground">Loading applications...</p>
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
                <span className="text-gradient-champagne">Precision Cohort</span>
                <span className="text-muted-foreground">Leads</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage mentorship program applications
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
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
                onClick={() => router.push('/admin/analytics')}
              >
                Analytics
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

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'pending', 'approved', 'rejected', 'contacted'] as const).map(filter => {
              const count = filter === 'all' ? metrics.total : metrics[filter]
              return (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? 'luxury-champagne' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                  className="gap-2"
                >
                  {filter === 'all' ? 'All' : STATUS_CONFIG[filter].label}
                  <span className="px-1.5 py-0.5 rounded text-xs bg-white/10">
                    {count}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="glass-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-champagne">{metrics.total}</div>
                <Users className="h-8 w-8 text-champagne/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-yellow-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-yellow-400">{metrics.pending}</div>
                <Clock className="h-8 w-8 text-yellow-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-400">{metrics.approved}</div>
                <CheckCircle className="h-8 w-8 text-green-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-red-400">{metrics.rejected}</div>
                <XCircle className="h-8 w-8 text-red-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contacted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-400">{metrics.contacted}</div>
                <MessageCircle className="h-8 w-8 text-blue-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications List */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Applications ({applications.length})
            </CardTitle>
            <CardDescription>
              Click on an application to expand details and take action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {applications.map((app) => {
                const isExpanded = expandedId === app.id
                const StatusIcon = STATUS_CONFIG[app.status].icon

                return (
                  <div
                    key={app.id}
                    className="border border-border/40 rounded-lg overflow-hidden hover:border-champagne/30 transition-colors"
                  >
                    {/* Header Row */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/5"
                      onClick={() => setExpandedId(isExpanded ? null : app.id!)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[app.status].color}`}>
                          <StatusIcon className="h-3 w-3 inline mr-1" />
                          {STATUS_CONFIG[app.status].label}
                        </div>
                        <div>
                          <div className="font-medium">{app.name}</div>
                          <div className="text-sm text-muted-foreground">{app.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          {app.created_at ? new Date(app.created_at).toLocaleDateString() : '-'}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                        {/* Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</div>
                            <a href={`mailto:${app.email}`} className="text-champagne hover:underline">
                              {app.email}
                            </a>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</div>
                            <div>{app.phone || 'Not provided'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Applied</div>
                            <div>
                              {app.created_at ? new Date(app.created_at).toLocaleString() : '-'}
                            </div>
                          </div>
                        </div>

                        {/* Message */}
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</div>
                          <div className="bg-muted/10 rounded-lg p-4 whitespace-pre-wrap text-sm">
                            {app.message}
                          </div>
                        </div>

                        {/* Review Info */}
                        {app.reviewed_at && (
                          <div className="text-sm text-muted-foreground">
                            Last reviewed: {new Date(app.reviewed_at).toLocaleString()}
                            {app.reviewed_by && ` by ${app.reviewed_by}`}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          {app.status !== 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => handleStatusUpdate(app.id!, 'approved')}
                              disabled={updating === app.id}
                            >
                              {updating === app.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-4 w-4 mr-1" />
                              )}
                              Approve
                            </Button>
                          )}
                          {app.status !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleStatusUpdate(app.id!, 'rejected')}
                              disabled={updating === app.id}
                            >
                              {updating === app.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <XCircle className="h-4 w-4 mr-1" />
                              )}
                              Reject
                            </Button>
                          )}
                          {app.status !== 'contacted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => handleStatusUpdate(app.id!, 'contacted')}
                              disabled={updating === app.id}
                            >
                              {updating === app.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <MessageCircle className="h-4 w-4 mr-1" />
                              )}
                              Mark Contacted
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                          >
                            <a href={`mailto:${app.email}?subject=TradeITM Precision Cohort Application`}>
                              Send Email
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {applications.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No applications found</p>
                  <p className="text-sm mt-1">
                    {statusFilter !== 'all' ? `No ${statusFilter} applications` : 'Applications will appear here'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
