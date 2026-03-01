import type { CoachReviewStatsResponse } from '@/lib/types/coach-review'

interface ReviewStatsBarProps {
  stats: CoachReviewStatsResponse | null
}

interface StatCard {
  label: string
  value: string
}

export function ReviewStatsBar({ stats }: ReviewStatsBarProps) {
  const cards: StatCard[] = [
    {
      label: 'Pending Reviews',
      value: String(stats?.pending_count ?? 0),
    },
    {
      label: 'In Review',
      value: String(stats?.in_review_count ?? 0),
    },
    {
      label: 'Completed Today',
      value: String(stats?.completed_today ?? 0),
    },
    {
      label: 'Avg Response Time',
      value: stats?.avg_response_hours == null
        ? '—'
        : `${stats.avg_response_hours.toFixed(1)}h`,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="glass-card-heavy rounded-xl border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-ivory">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
