'use client'

import { useEffect, useState } from 'react'
import type { CoachResponsePayload, CoachReviewStatus } from '@/lib/types/coach-review'
import { CoachFeedbackContent } from '@/components/journal/coach-feedback-content'

interface CoachFeedbackResponse {
  coach_response: CoachResponsePayload | null
  coach_screenshots: string[]
  published_at: string | null
  review_status: CoachReviewStatus | null
}

interface CoachFeedbackSectionProps {
  entryId: string
}

export function CoachFeedbackSection({ entryId }: CoachFeedbackSectionProps) {
  const [data, setData] = useState<CoachFeedbackResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadFeedback = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/members/journal/${entryId}/coach-feedback`, { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!active) return
        if (!response.ok || payload?.success !== true) {
          setData(null)
          return
        }
        setData(payload.data as CoachFeedbackResponse)
      } catch {
        if (active) setData(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadFeedback()

    return () => {
      active = false
    }
  }, [entryId])

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-muted-foreground">
        Loading coach feedback...
      </div>
    )
  }

  if (!data?.coach_response) {
    return null
  }

  const feedback = data.coach_response

  return (
    <CoachFeedbackContent
      feedback={feedback}
      coachScreenshots={data.coach_screenshots}
      publishedAt={data.published_at}
      showPublishedAt
    />
  )
}
