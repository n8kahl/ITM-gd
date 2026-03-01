'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ClipboardCheck } from 'lucide-react'
import { TradeDetailPanel } from '@/components/admin/trade-review/trade-detail-panel'
import { MarketContextPanel } from '@/components/admin/trade-review/market-context-panel'
import { CoachWorkspace } from '@/components/admin/trade-review/coach-workspace'
import type {
  CoachDraftStatus,
  CoachMemberStats,
  CoachResponsePayload,
  CoachReviewActivityEntry,
  CoachTradeNote,
} from '@/lib/types/coach-review'
import type { JournalEntry } from '@/lib/types/journal'

interface AdminTradeReviewDetailPageProps {
  params: Promise<{
    id: string
  }>
}

interface TradeReviewDetailResponse {
  entry: JournalEntry
  member: {
    display_name: string
    avatar_url: string | null
    discord_username: string | null
    tier: string | null
  }
  review_request: {
    id: string
    status: 'pending' | 'in_review' | 'completed' | 'dismissed'
    assigned_to: string | null
    requested_at: string
    assigned_to_name?: string | null
  } | null
  coach_note: CoachTradeNote | null
  draft_status?: CoachDraftStatus
  member_stats: CoachMemberStats
  activity_log: CoachReviewActivityEntry[]
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || !payload?.success || payload.data === undefined) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload.data
}

const reviewStatusClasses: Record<NonNullable<TradeReviewDetailResponse['review_request']>['status'], string> = {
  pending: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  in_review: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
  completed: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
  dismissed: 'border-white/15 bg-white/5 text-ivory/80',
}

const draftStatusClasses: Record<CoachDraftStatus, string> = {
  none: 'border-white/15 bg-white/5 text-ivory/80',
  ai_draft: 'border-sky-400/40 bg-sky-500/10 text-sky-200',
  manual_draft: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  published: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTradeDate(value: string | null | undefined): string {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatQueueAge(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  const deltaMs = Date.now() - parsed.getTime()
  if (deltaMs < 0) return '0m'
  const totalMinutes = Math.floor(deltaMs / (60 * 1000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function deriveDraftStatus(detail: TradeReviewDetailResponse): CoachDraftStatus {
  if (detail.draft_status) return detail.draft_status
  if (!detail.coach_note) return 'none'
  if (detail.coach_note.is_published) return 'published'
  if (detail.coach_note.coach_response) return 'manual_draft'
  if (detail.coach_note.ai_draft) return 'ai_draft'
  return 'none'
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function AdminTradeReviewDetailPage({ params }: AdminTradeReviewDetailPageProps) {
  const { id: entryId } = use(params)
  const [detail, setDetail] = useState<TradeReviewDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [uploading, setUploading] = useState(false)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchApi<TradeReviewDetailResponse>(`/api/admin/trade-review/${entryId}`)
      setDetail(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load trade review detail')
    } finally {
      setLoading(false)
    }
  }, [entryId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const handleGenerateAI = async (coachPreliminaryNotes: string) => {
    setGenerating(true)
    try {
      await fetchApi<{ draft: CoachResponsePayload }>(
        '/api/admin/trade-review/ai-coach',
        {
          method: 'POST',
          body: JSON.stringify({
            journal_entry_id: entryId,
            coach_preliminary_notes: coachPreliminaryNotes || undefined,
          }),
        },
      )
      await loadDetail()
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveDraft = async (payload: { coach_response: CoachResponsePayload; internal_notes: string | null }) => {
    setSaving(true)
    try {
      const method = detail?.coach_note ? 'PATCH' : 'POST'
      await fetchApi<CoachTradeNote>(`/api/admin/trade-review/${entryId}/notes`, {
        method,
        body: JSON.stringify(payload),
      })
      await loadDetail()
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    try {
      await fetchApi<{ published: boolean }>(`/api/admin/trade-review/${entryId}/publish`, {
        method: 'POST',
      })
      await loadDetail()
    } finally {
      setPublishing(false)
    }
  }

  const handleDismiss = async () => {
    setDismissing(true)
    try {
      await fetchApi<{ dismissed: boolean }>(`/api/admin/trade-review/${entryId}/dismiss`, {
        method: 'POST',
      })
      await loadDetail()
    } finally {
      setDismissing(false)
    }
  }

  const handleUploadScreenshot = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Only PNG, JPEG, and WEBP screenshots are supported.')
    }

    setUploading(true)
    try {
      const uploadTicket = await fetchApi<{
        path: string
        signed_url: string
      }>(`/api/admin/trade-review/${entryId}/screenshots`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      })

      const uploadResponse = await fetch(uploadTicket.signed_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })

      if (!uploadResponse.ok) {
        await fetch(`/api/admin/trade-review/${entryId}/screenshots?path=${encodeURIComponent(uploadTicket.path)}`, {
          method: 'DELETE',
        })
        throw new Error('Failed to upload screenshot to storage')
      }

      await loadDetail()
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveScreenshot = async (path: string) => {
    setUploading(true)
    try {
      await fetchApi<{ removed: boolean }>(`/api/admin/trade-review/${entryId}/screenshots?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      })
      await loadDetail()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <header className="glass-card-heavy rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
          <h1 className="text-xl font-semibold text-ivory">Trade Review Detail</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Entry ID: <span className="font-mono text-ivory/90">{entryId}</span>
        </p>
      </header>

      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
          Loading trade review detail...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : detail ? (
        <>
          <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/15 bg-black/30">
                  {detail.member.avatar_url ? (
                    <Image
                      src={detail.member.avatar_url}
                      alt={detail.member.display_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-ivory/70">
                      {detail.member.display_name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ivory">{detail.member.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {detail.entry.symbol.toUpperCase()} {toTitleCase(detail.entry.direction)} {toTitleCase(detail.entry.contract_type)}
                    {' · '}
                    {formatTradeDate(detail.entry.trade_date)}
                  </p>
                </div>
                {detail.member.tier ? (
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
                    {detail.member.tier}
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">P&L</p>
                  <p className={`mt-1 font-mono text-lg ${detail.entry.pnl != null && detail.entry.pnl < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {formatCurrency(detail.entry.pnl)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">P&L %</p>
                  <p className={`mt-1 font-mono text-lg ${detail.entry.pnl_percentage != null && detail.entry.pnl_percentage < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {formatPercent(detail.entry.pnl_percentage)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-xs ${reviewStatusClasses[detail.review_request?.status ?? 'pending']}`}>
                Review: {toTitleCase(detail.review_request?.status ?? 'pending')}
              </span>
              <span className={`rounded-full border px-2 py-1 text-xs ${draftStatusClasses[deriveDraftStatus(detail)]}`}>
                Draft: {toTitleCase(deriveDraftStatus(detail))}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-ivory/80">
                {detail.review_request?.assigned_to_name
                  ? `Assigned: ${detail.review_request.assigned_to_name}`
                  : 'Assigned: Unassigned'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-ivory/80">
                Waiting: {formatQueueAge(detail.review_request?.requested_at)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <TradeDetailPanel
              entry={detail.entry}
              memberDisplayName={detail.member.display_name}
              memberDiscordUsername={detail.member.discord_username}
              memberAvatarUrl={detail.member.avatar_url}
              memberTier={detail.member.tier}
            />
            <MarketContextPanel snapshot={detail.coach_note?.market_data_snapshot ?? null} />
            <CoachWorkspace
              key={detail.coach_note?.updated_at ?? 'no-note'}
              entryId={entryId}
              note={detail.coach_note}
              activityLog={detail.activity_log}
              generating={generating}
              saving={saving}
              publishing={publishing}
              dismissing={dismissing}
              uploading={uploading}
              onGenerateAI={handleGenerateAI}
              onSaveDraft={handleSaveDraft}
              onPublish={handlePublish}
              onDismiss={handleDismiss}
              onUploadScreenshot={handleUploadScreenshot}
              onRemoveScreenshot={handleRemoveScreenshot}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
