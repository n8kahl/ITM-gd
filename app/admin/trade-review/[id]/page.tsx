'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { TradeDetailPanel } from '@/components/admin/trade-review/trade-detail-panel'
import { MarketContextPanel } from '@/components/admin/trade-review/market-context-panel'
import { CoachWorkspace } from '@/components/admin/trade-review/coach-workspace'
import type { CoachResponsePayload, CoachTradeNote } from '@/lib/types/coach-review'
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
    assigned_to_name?: string | null
  } | null
  coach_note: CoachTradeNote | null
  member_stats: Record<string, unknown>
  activity_log: Array<Record<string, unknown>>
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
          {detail.review_request?.status === 'in_review' && detail.review_request.assigned_to_name ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              Claimed by {detail.review_request.assigned_to_name}
            </div>
          ) : null}
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
