'use client'

import { useEffect, useMemo, useState } from 'react'

import { AcademyModuleCard } from '@/components/academy/academy-module-card'
import { AcademyShell } from '@/components/academy/academy-shell'
import { fetchAcademyPlan, fetchAcademyProgressSummary } from '@/lib/academy-v3/client'

type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type ProgressSummary = Awaited<ReturnType<typeof fetchAcademyProgressSummary>>

export function AcademyModuleCatalog() {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchAcademyPlan(), fetchAcademyProgressSummary()])
      .then(([planData, progressSummary]) => {
        if (!active) return
        setPlan(planData)
        setSummary(progressSummary)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load module catalog')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const moduleProgressById = useMemo(() => {
    const entries = new Map<string, number>()
    for (const moduleItem of summary?.modules || []) {
      entries.set(moduleItem.moduleId, moduleItem.progressPercent)
    }
    return entries
  }, [summary])

  return (
    <AcademyShell
      title="Modules"
      description="Browse the curriculum by track and move through each module in sequence."
      maxWidthClassName="max-w-6xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading modules...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="space-y-7">
          {plan?.tracks.map((track, index) => (
            <section key={track.id} className="space-y-3 border-b border-white/5 pb-6 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
                  <p className="text-xs font-semibold uppercase tracking-[0.09em] text-emerald-300">{track.title}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                  Track {index + 1} of {plan.tracks.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {track.modules.map((moduleItem) => (
                  <AcademyModuleCard
                    key={moduleItem.id}
                    moduleItem={moduleItem}
                    trackTitle={track.title}
                    progressPercent={moduleProgressById.get(moduleItem.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AcademyShell>
  )
}
