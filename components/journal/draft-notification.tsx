'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Check, X } from 'lucide-react'

/**
 * Draft Notification Banner
 *
 * Displays a notification when there are pending auto-draft journal entries
 * awaiting user confirmation. Fetches draft count from the journal API and
 * provides quick-action buttons to review or dismiss.
 *
 * Spec: TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md — Phase 2, Slice 2B
 */

interface DraftNotificationProps {
  /** Called when user clicks "Review Drafts" */
  onReviewDrafts: () => void
}

interface DraftInfo {
  count: number
  latestSymbol: string | null
}

const POLL_INTERVAL_MS = 60_000

export function DraftNotification({ onReviewDrafts }: DraftNotificationProps) {
  const [draftInfo, setDraftInfo] = useState<DraftInfo>({ count: 0, latestSymbol: null })
  const [dismissed, setDismissed] = useState(false)

  const fetchDrafts = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/members/journal?includeDrafts=true&isOpen=true&limit=5&offset=0&sortBy=created_at&sortDir=desc',
        { cache: 'no-store' },
      )

      if (!response.ok) return

      const payload = await response.json()
      if (!payload.success || !Array.isArray(payload.data)) return

      const drafts = (payload.data as Array<Record<string, unknown>>).filter(
        (entry) => entry.is_draft === true && entry.draft_status === 'pending',
      )

      setDraftInfo({
        count: drafts.length,
        latestSymbol: drafts[0]?.symbol as string | null,
      })
    } catch {
      // Silently fail — this is a non-critical notification
    }
  }, [])

  useEffect(() => {
    void fetchDrafts()
    const interval = setInterval(() => void fetchDrafts(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchDrafts])

  if (draftInfo.count === 0 || dismissed) return null

  return (
    <div className="flex items-center gap-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
      <BookOpen className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.5} />

      <p className="flex-1 text-xs text-emerald-200">
        <span className="font-medium">{draftInfo.count}</span>
        {' '}pending draft{draftInfo.count !== 1 ? 's' : ''}
        {draftInfo.latestSymbol ? (
          <> — latest: <span className="font-mono text-emerald-300">{draftInfo.latestSymbol}</span></>
        ) : null}
      </p>

      <button
        type="button"
        onClick={onReviewDrafts}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
      >
        <Check className="h-3 w-3" strokeWidth={2} />
        Review
      </button>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-md p-1 text-white/40 transition-colors hover:text-white/60"
        aria-label="Dismiss draft notification"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  )
}
