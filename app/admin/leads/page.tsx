"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  Filter,
  TrendingUp,
  DollarSign,
  Target,
  Sparkles
} from "lucide-react"
import { CohortApplication, ApplicationMetadata } from "@/lib/supabase"
import { formatDate, formatDateTime } from "@/lib/formatting"

type StatusFilter = 'all' | CohortApplication['status']

type EnrichedApplication = CohortApplication & {
  metadata?: ApplicationMetadata
  submission_type?: string
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  contacted: { label: 'Contacted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: MessageCircle },
}

function LeadsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<EnrichedApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(highlightId)
  const [updating, setUpdating] = useState<string | null>(null)

  // Load applications via API route (uses service role for RLS bypass)
  const loadData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      const response = await fetch(`/api/admin/leads?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load applications')
      }
      const result = await response.json()
      setApplications(result.data || [])
    } catch (error) {
      console.error('Failed to load applications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  // Update application status via API route
  const handleStatusUpdate = async (id: string, newStatus: CohortApplication['status']) => {
    setUpdating(id)
    try {
      const response = await fetch('/api/admin/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, reviewed_by: 'Admin' }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update status')
      }
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

  // Check if applicant is high value ($25k+)
  const isHighValue = (app: EnrichedApplication) => {
    return app.metadata?.account_size === '$25k+'
  }

  // Calculate metrics
  const metrics = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    contacted: applications.filter(a => a.status === 'contacted').length,
    highValue: applications.filter(a => isHighValue(a)).length,
  }

  // Export to CSV
  const exportToCSV = () => {
    let csvContent = 'Name,Email,Phone,Discord,Experience,Account Size,Primary Struggle,Status,Goal,Created At,Reviewed At\n'
    csvContent += applications.map(a => {
      const m = a.metadata || {}
      return `"${a.name}","${a.email}","${a.phone || ''}","${m.discord_handle || ''}","${m.experience_level || ''}","${m.account_size || ''}","${m.primary_struggle || ''}","${a.status}","${(m.short_term_goal || '').replace(/"/g, '""')}","${a.created_at}","${a.reviewed_at || ''}"`
    }).join('\n')

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
              {/* Primary Actions - Always Visible */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData()}
                className="gap-2 min-h-[44px]"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              {/* Secondary Actions - Hidden on Mobile */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-2 hidden md:flex"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/analytics')}
                className="hidden md:inline-flex"
              >
                Analytics
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/packages')}
                className="hidden md:inline-flex"
              >
                Packages
              </Button>

              {/* Logout - Always Visible */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  document.cookie = 'titm_admin=; path=/; max-age=0'
                  router.push('/')
                }}
                className="min-h-[44px]"
              >
                <span className="hidden sm:inline">Logout</span>
                <span className="sm:hidden">Exit</span>
              </Button>
            </div>
          </div>

          {/* Filter Tabs - Horizontal Scroll on Mobile */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {(['all', 'pending', 'approved', 'rejected', 'contacted'] as const).map(filter => {
              const count = filter === 'all' ? metrics.total : metrics[filter]
              return (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? 'luxury-champagne' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                  className="gap-2 whitespace-nowrap flex-shrink-0"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

          <Card className="glass-card border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Value ($25k+)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-emerald-500">{metrics.highValue}</div>
                <Sparkles className="h-8 w-8 text-emerald-500/50" />
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
                const highValue = isHighValue(app)
                const hasMetadata = app.metadata && Object.keys(app.metadata).length > 0

                return (
                  <div
                    key={app.id}
                    className={`border rounded-lg overflow-hidden transition-colors ${
                      highlightId === app.id
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : highValue
                          ? 'border-emerald-500/30 hover:border-emerald-500/50'
                          : 'border-border/40 hover:border-champagne/30'
                    }`}
                  >
                    {/* Header Row - Mobile Optimized */}
                    <div
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-muted/5 gap-3"
                      onClick={() => setExpandedId(isExpanded ? null : app.id!)}
                    >
                      {/* Left Side - Name, Status, Badges */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                        {/* Status and Badges Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_CONFIG[app.status].color}`}>
                            <StatusIcon className="h-3 w-3 inline mr-1" />
                            {STATUS_CONFIG[app.status].label}
                          </div>

                          {/* High Value Badge */}
                          {highValue && (
                            <div className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              High Value
                            </div>
                          )}
                        </div>

                        {/* Name and Email */}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            <span className="truncate">{app.name}</span>
                            {hasMetadata && (
                              <span className="text-xs text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                                Wizard
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">{app.email}</div>
                        </div>
                      </div>

                      {/* Right Side - Metadata and Date */}
                      <div className="flex items-center gap-3 justify-between md:justify-end flex-shrink-0">
                        {/* Quick metadata preview - Hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3">
                          {app.metadata?.account_size && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              {app.metadata.account_size}
                            </div>
                          )}
                          {app.metadata?.experience_level && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <TrendingUp className="h-3 w-3" />
                              {app.metadata.experience_level}
                            </div>
                          )}
                        </div>

                        {/* Date and Chevron */}
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(app.created_at, { format: 'short' })}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-4">
                        {/* Application Metadata (if from wizard) */}
                        {hasMetadata && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/5 rounded-lg border border-border/20">
                            {app.metadata?.discord_handle && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" />
                                  Discord
                                </div>
                                <div className="font-medium">{app.metadata.discord_handle}</div>
                              </div>
                            )}
                            {app.metadata?.experience_level && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Experience
                                </div>
                                <div className="font-medium">{app.metadata.experience_level}</div>
                              </div>
                            )}
                            {app.metadata?.account_size && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  Account Size
                                </div>
                                <div className={`font-medium ${highValue ? 'text-emerald-500' : ''}`}>
                                  {app.metadata.account_size}
                                  {highValue && <Sparkles className="h-3 w-3 inline ml-1" />}
                                </div>
                              </div>
                            )}
                            {app.metadata?.primary_struggle && (
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  Primary Struggle
                                </div>
                                <div className="font-medium">{app.metadata.primary_struggle}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 12-Month Goal */}
                        {app.metadata?.short_term_goal && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">12-Month Goal</div>
                            <div className="bg-muted/10 rounded-lg p-4 whitespace-pre-wrap text-sm">
                              {app.metadata.short_term_goal}
                            </div>
                          </div>
                        )}

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
                              {formatDateTime(app.created_at)}
                            </div>
                          </div>
                        </div>

                        {/* Original Message (if not from wizard or as fallback) */}
                        {(!hasMetadata || app.message) && (
                          <div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                              {hasMetadata ? 'Full Application' : 'Message'}
                            </div>
                            <div className="bg-muted/10 rounded-lg p-4 whitespace-pre-wrap text-sm">
                              {app.message}
                            </div>
                          </div>
                        )}

                        {/* Review Info */}
                        {app.reviewed_at && (
                          <div className="text-sm text-muted-foreground">
                            Last reviewed: {formatDateTime(app.reviewed_at)}
                            {app.reviewed_by && ` by ${app.reviewed_by}`}
                          </div>
                        )}

                        {/* Action Buttons - Touch-Friendly */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {app.status !== 'approved' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-500/30 text-green-400 hover:bg-green-500/10 min-h-[44px]"
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
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10 min-h-[44px]"
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
                              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 min-h-[44px]"
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
                            className="min-h-[44px]"
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

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-champagne mx-auto mb-4" />
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    }>
      <LeadsContent />
    </Suspense>
  )
}
