'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CoachReviewQueueItem, CoachReviewStatsResponse } from '@/lib/types/coach-review'
import { ReviewStatsBar } from '@/components/admin/trade-review/review-stats-bar'
import { ReviewQueueTable } from '@/components/admin/trade-review/review-queue-table'
import { ReviewBrowseTable, type ReviewBrowseItem } from '@/components/admin/trade-review/review-browse-table'

type TabKey = 'queue' | 'browse'

type QueueFilters = {
  status: 'pending' | 'in_review' | 'completed' | 'dismissed' | 'all'
  priority: 'normal' | 'urgent' | 'all'
  symbol: string
  member: string
}

type BrowseFilters = {
  symbol: string
  direction: 'all' | 'long' | 'short'
  contractType: 'all' | 'stock' | 'call' | 'put'
  memberSearch: string
  startDate: string
  endDate: string
  hasCoachNote: 'all' | 'true' | 'false'
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error || `Failed to load ${url}`)
  }
  return payload.data
}

export default function AdminTradeReviewPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('queue')
  const [stats, setStats] = useState<CoachReviewStatsResponse | null>(null)
  const [queueItems, setQueueItems] = useState<CoachReviewQueueItem[]>([])
  const [browseItems, setBrowseItems] = useState<ReviewBrowseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [queueFilters, setQueueFilters] = useState<QueueFilters>({
    status: 'pending',
    priority: 'all',
    symbol: '',
    member: '',
  })

  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>({
    symbol: '',
    direction: 'all',
    contractType: 'all',
    memberSearch: '',
    startDate: '',
    endDate: '',
    hasCoachNote: 'all',
  })

  const queueQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('status', queueFilters.status)
    params.set('priority', queueFilters.priority)
    params.set('limit', '100')
    if (queueFilters.symbol.trim()) params.set('symbol', queueFilters.symbol.trim())
    if (queueFilters.member.trim()) params.set('member', queueFilters.member.trim())
    return params.toString()
  }, [queueFilters])

  const browseQuery = useMemo(() => {
    const params = new URLSearchParams()
    params.set('limit', '100')
    params.set('direction', browseFilters.direction)
    params.set('contractType', browseFilters.contractType)
    if (browseFilters.symbol.trim()) params.set('symbol', browseFilters.symbol.trim())
    if (browseFilters.memberSearch.trim()) params.set('memberSearch', browseFilters.memberSearch.trim())
    if (browseFilters.startDate) params.set('startDate', new Date(`${browseFilters.startDate}T00:00:00.000Z`).toISOString())
    if (browseFilters.endDate) params.set('endDate', new Date(`${browseFilters.endDate}T23:59:59.999Z`).toISOString())
    if (browseFilters.hasCoachNote !== 'all') params.set('hasCoachNote', browseFilters.hasCoachNote)
    return params.toString()
  }, [browseFilters])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const statsPromise = fetchApi<CoachReviewStatsResponse>('/api/admin/trade-review/stats')
      if (activeTab === 'queue') {
        const [statsData, queueData] = await Promise.all([
          statsPromise,
          fetchApi<CoachReviewQueueItem[]>(`/api/admin/trade-review?${queueQuery}`),
        ])
        setStats(statsData)
        setQueueItems(queueData)
      } else {
        const [statsData, browseData] = await Promise.all([
          statsPromise,
          fetchApi<ReviewBrowseItem[]>(`/api/admin/trade-review/browse?${browseQuery}`),
        ])
        setStats(statsData)
        setBrowseItems(browseData)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load trade review data')
    } finally {
      setLoading(false)
    }
  }, [activeTab, browseQuery, queueQuery])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <div className="space-y-4">
      <header className="glass-card-heavy rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-ivory">Trade Review</h1>
          </div>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-9 px-3"
            onClick={() => { void loadData() }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Review flagged trades, browse member journals, and publish coach feedback.
        </p>
      </header>

      <ReviewStatsBar stats={stats} />

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'queue' ? 'default' : 'luxury-outline'}
          className="h-9 px-3"
          onClick={() => setActiveTab('queue')}
        >
          Queue
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === 'browse' ? 'default' : 'luxury-outline'}
          className="h-9 px-3"
          onClick={() => setActiveTab('browse')}
        >
          Browse All
        </Button>
      </div>

      {activeTab === 'queue' ? (
        <div className="glass-card-heavy grid grid-cols-1 gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-4">
          <select
            value={queueFilters.status}
            onChange={(event) => setQueueFilters((prev) => ({ ...prev, status: event.target.value as QueueFilters['status'] }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          >
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All Statuses</option>
          </select>
          <select
            value={queueFilters.priority}
            onChange={(event) => setQueueFilters((prev) => ({ ...prev, priority: event.target.value as QueueFilters['priority'] }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          >
            <option value="all">All Priorities</option>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
          <input
            value={queueFilters.symbol}
            placeholder="Filter symbol"
            onChange={(event) => setQueueFilters((prev) => ({ ...prev, symbol: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
          <input
            value={queueFilters.member}
            placeholder="Filter member"
            onChange={(event) => setQueueFilters((prev) => ({ ...prev, member: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
        </div>
      ) : (
        <div className="glass-card-heavy grid grid-cols-1 gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-3 xl:grid-cols-7">
          <input
            value={browseFilters.symbol}
            placeholder="Symbol"
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, symbol: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
          <select
            value={browseFilters.direction}
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, direction: event.target.value as BrowseFilters['direction'] }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          >
            <option value="all">All Directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select
            value={browseFilters.contractType}
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, contractType: event.target.value as BrowseFilters['contractType'] }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          >
            <option value="all">All Contracts</option>
            <option value="stock">Stock</option>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
          <input
            value={browseFilters.memberSearch}
            placeholder="Member"
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, memberSearch: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
          <input
            type="date"
            value={browseFilters.startDate}
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, startDate: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
          <input
            type="date"
            value={browseFilters.endDate}
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, endDate: event.target.value }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          />
          <select
            value={browseFilters.hasCoachNote}
            onChange={(event) => setBrowseFilters((prev) => ({ ...prev, hasCoachNote: event.target.value as BrowseFilters['hasCoachNote'] }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory"
          >
            <option value="all">Any Note State</option>
            <option value="true">Has Coach Note</option>
            <option value="false">No Coach Note</option>
          </select>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
          Loading trade review data...
        </div>
      ) : activeTab === 'queue' ? (
        <ReviewQueueTable items={queueItems} />
      ) : (
        <ReviewBrowseTable items={browseItems} />
      )}
    </div>
  )
}
