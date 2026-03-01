import type { CoachResponsePayload } from '@/lib/types/coach-review'

interface CoachFeedbackCardProps {
  title?: string
  feedback: CoachResponsePayload | null
}

export function CoachFeedbackCard({ title = 'Coach Feedback', feedback }: CoachFeedbackCardProps) {
  if (!feedback) {
    return (
      <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-muted-foreground">
        No coach feedback drafted yet.
      </div>
    )
  }

  return (
    <div className="glass-card-heavy space-y-4 rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ivory">{title}</h2>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
          Grade {feedback.grade}
        </span>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">What Went Well</p>
        <ul className="mt-1 space-y-1 text-sm text-ivory/90">
          {feedback.what_went_well.map((item, index) => (
            <li key={`${item}-${index}`}>• {item}</li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Areas to Improve</p>
        <div className="mt-1 space-y-2">
          {feedback.areas_to_improve.map((item, index) => (
            <div key={`${item.point}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
              <p className="text-sm font-medium text-ivory">{item.point}</p>
              <p className="mt-1 text-sm text-ivory/80">{item.instruction}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Specific Drills</p>
        <div className="mt-1 space-y-2">
          {feedback.specific_drills.map((drill, index) => (
            <div key={`${drill.title}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
              <p className="text-sm font-medium text-ivory">{drill.title}</p>
              <p className="mt-1 text-sm text-ivory/80">{drill.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall Assessment</p>
        <p className="mt-1 text-sm text-ivory/90">{feedback.overall_assessment}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Confidence" value={feedback.confidence} />
        <Metric label="Grade Reasoning" value={feedback.grade_reasoning} />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-ivory">{value}</p>
    </div>
  )
}
