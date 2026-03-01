'use client'

import Image from 'next/image'
import { ClipboardCheck, CheckCircle2 } from 'lucide-react'
import type { CoachResponsePayload } from '@/lib/types/coach-review'

interface CoachFeedbackContentProps {
  feedback: CoachResponsePayload
  coachScreenshots?: string[]
  publishedAt?: string | null
  showPublishedAt?: boolean
  className?: string
}

function gradeBadgeClasses(grade: string): string {
  switch (grade) {
    case 'A':
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
    case 'B':
      return 'border-sky-400/40 bg-sky-500/10 text-sky-200'
    case 'C':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-200'
    case 'D':
      return 'border-orange-400/40 bg-orange-500/10 text-orange-200'
    default:
      return 'border-red-400/40 bg-red-500/10 text-red-200'
  }
}

function formatPublishedDate(value: string | null): string {
  if (!value) return 'Unknown date'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Unknown date'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CoachFeedbackContent({
  feedback,
  coachScreenshots = [],
  publishedAt = null,
  showPublishedAt = true,
  className = 'space-y-4 rounded-lg border border-white/10 bg-white/5 p-4',
}: CoachFeedbackContentProps) {
  return (
    <section className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-emerald-300" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-ivory">Coach Feedback</h3>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${gradeBadgeClasses(feedback.grade)}`}>
          Grade {feedback.grade}
        </span>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">What Went Well</p>
        <ul className="mt-2 space-y-1">
          {feedback.what_went_well.map((item, index) => (
            <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-ivory/90">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-300" strokeWidth={1.5} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Areas to Improve</p>
        <div className="mt-2 space-y-2">
          {feedback.areas_to_improve.map((item, index) => (
            <div key={`${item.point}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
              <p className="text-sm font-medium text-ivory">{item.point}</p>
              <p className="mt-1 text-sm text-ivory/80">{item.instruction}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Practice Drills</p>
        <div className="mt-2 space-y-2">
          {feedback.specific_drills.map((drill, index) => (
            <details key={`${drill.title}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
              <summary className="cursor-pointer text-sm font-medium text-ivory">{drill.title}</summary>
              <p className="mt-2 text-sm text-ivory/80">{drill.description}</p>
            </details>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Assessment</p>
        <p className="mt-2 text-sm text-ivory/90">{feedback.overall_assessment}</p>
      </div>

      {coachScreenshots.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Coach Screenshots</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {coachScreenshots.map((url) => (
              <div key={url} className="relative h-28 overflow-hidden rounded-md border border-white/10 bg-black/30">
                <Image
                  src={url}
                  alt="Coach review screenshot"
                  fill
                  sizes="(max-width: 768px) 50vw, 200px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showPublishedAt ? (
        <p className="text-xs text-muted-foreground">
          Reviewed on {formatPublishedDate(publishedAt)}
        </p>
      ) : null}
    </section>
  )
}
