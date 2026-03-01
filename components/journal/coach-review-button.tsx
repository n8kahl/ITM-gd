'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import type { JournalEntry } from '@/lib/types/journal'

interface CoachReviewButtonProps {
  entryId: string
  status: JournalEntry['coach_review_status']
  onStatusChange?: (nextStatus: JournalEntry['coach_review_status']) => void
  disabled?: boolean
}

export function CoachReviewButton({
  entryId,
  status,
  onStatusChange,
  disabled = false,
}: CoachReviewButtonProps) {
  const { hasPermission } = useMemberAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hasPermission('flag_for_coach_review')) {
    return null
  }

  if (status === 'completed') {
    return null
  }

  const handleRequestReview = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/members/journal/${entryId}/request-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'normal' }),
      })

      const payload = await response.json().catch(() => null)
      if (response.status === 409) {
        onStatusChange?.('pending')
        return
      }

      if (!response.ok || payload?.success !== true) {
        setError(payload?.error || 'Unable to submit coach review request.')
        return
      }

      const nextStatus = payload?.data?.status === 'in_review' ? 'in_review' : 'pending'
      onStatusChange?.(nextStatus)
    } catch {
      setError('Unable to submit coach review request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Coach Review</p>

      {status === 'pending' ? (
        <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200">
          Coach Review Pending
        </span>
      ) : status === 'in_review' ? (
        <span className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-200">
          Under Coach Review
        </span>
      ) : (
        <Button
          type="button"
          onClick={() => { void handleRequestReview() }}
          disabled={disabled || submitting}
          variant="luxury-outline"
          size="sm"
          className="h-10 px-4"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? 'Submitting...' : 'Request Coach Review'}
        </Button>
      )}

      {error ? (
        <p className="mt-2 text-xs text-red-300">{error}</p>
      ) : null}
    </div>
  )
}
