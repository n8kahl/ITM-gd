'use client'

import { useEffect, useState } from 'react'
import { Brain, AlertTriangle, TrendingUp, X } from 'lucide-react'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

interface BehavioralInsight {
  id: string
  analysis_date: string
  insight_type: string
  title: string
  description: string
  recommendation: string | null
  severity: 'info' | 'warning' | 'critical' | 'positive'
}

function severityStyles(severity: BehavioralInsight['severity']): string {
  if (severity === 'critical') return 'border-red-500/30 bg-red-500/5 text-red-300'
  if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/5 text-amber-300'
  if (severity === 'positive') return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
  return 'border-white/[0.08] bg-white/[0.03] text-ivory'
}

export function BehavioralInsights() {
  const [insights, setInsights] = useState<BehavioralInsight[]>([])
  const [loading, setLoading] = useState(true)

  const loadInsights = async () => {
    try {
      const response = await fetch('/api/members/insights/behavioral?limit=12', { cache: 'no-store' })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      const result = await response.json()
      setInsights(Array.isArray(result.data) ? result.data : [])
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInsights()
  }, [])

  const dismissInsight = async (id: string) => {
    try {
      const response = await fetch('/api/members/insights/behavioral/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id }),
      })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      setInsights((prev) => prev.filter((insight) => insight.id !== id))
    } catch (error) {
      notifyAppError(createAppError(error))
    }
  }

  return (
    <section className="glass-card rounded-xl p-4 border border-white/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-ivory">Behavioral Insights</h3>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading behavioral analysis...</p>
      ) : insights.length === 0 ? (
        <p className="text-xs text-muted-foreground">No behavioral insights yet. Keep logging trades to build pattern analysis.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {insights.map((insight) => (
            <div key={insight.id} className={`rounded-lg border p-3 ${severityStyles(insight.severity)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {insight.severity === 'critical' || insight.severity === 'warning'
                    ? <AlertTriangle className="w-3.5 h-3.5" />
                    : <TrendingUp className="w-3.5 h-3.5" />}
                  <p className="text-xs font-medium">{insight.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissInsight(insight.id)}
                  className="p-1 rounded-md hover:bg-black/20"
                  aria-label="Dismiss insight"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] mt-1.5 opacity-85">{insight.description}</p>
              {insight.recommendation && (
                <p className="text-[11px] mt-1.5 opacity-80 italic">Recommendation: {insight.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
