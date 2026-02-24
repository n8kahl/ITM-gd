'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AcademyLessonRow } from '@/components/academy/academy-lesson-row'
import { AcademyShell } from '@/components/academy/academy-shell'
import { fetchAcademyModule, fetchAcademyModuleProgress, fetchAcademyPlan } from '@/lib/academy-v3/client'

type ModuleData = Awaited<ReturnType<typeof fetchAcademyModule>>
type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type ModuleProgress = Awaited<ReturnType<typeof fetchAcademyModuleProgress>>

type LessonStatus = 'done' | 'next' | 'in_progress' | 'locked'

function computeLessonStatuses(moduleData: ModuleData, progressData: ModuleProgress | null): Record<string, LessonStatus> {
  const rawStatuses = new Map<string, string>()
  for (const lesson of progressData?.lessons || []) {
    rawStatuses.set(lesson.lessonId, lesson.status)
  }

  const computed: Record<string, LessonStatus> = {}
  let flowLocked = false

  for (const lesson of moduleData.lessons) {
    const rawStatus = rawStatuses.get(lesson.id)

    if (rawStatus === 'passed') {
      computed[lesson.id] = 'done'
      continue
    }

    if (!flowLocked && (rawStatus === 'in_progress' || rawStatus === 'submitted')) {
      computed[lesson.id] = 'in_progress'
      flowLocked = true
      continue
    }

    if (!flowLocked) {
      computed[lesson.id] = 'next'
      flowLocked = true
      continue
    }

    computed[lesson.id] = 'locked'
  }

  return computed
}

export function AcademyModuleDetail({ slug }: { slug: string }) {
  const [moduleData, setModuleData] = useState<ModuleData | null>(null)
  const [planData, setPlanData] = useState<PlanData | null>(null)
  const [progressData, setProgressData] = useState<ModuleProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([fetchAcademyModule(slug), fetchAcademyPlan(), fetchAcademyModuleProgress(slug)])
      .then(([modulePayload, planPayload, progressPayload]) => {
        if (!active) return
        setModuleData(modulePayload)
        setPlanData(planPayload)
        setProgressData(progressPayload)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load module')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  const trackTitle = useMemo(() => {
    if (!planData || !moduleData) return 'Track'
    const track = planData.tracks.find((item) => item.id === moduleData.trackId)
    return track?.title || 'Track'
  }, [planData, moduleData])

  const lessonStatusById = useMemo(() => {
    if (!moduleData) return {}
    return computeLessonStatuses(moduleData, progressData)
  }, [moduleData, progressData])

  return (
    <AcademyShell
      title="Module Detail"
      description="Work through lessons in sequence with clear completion and next-up signals."
      maxWidthClassName="max-w-5xl"
    >
      {loading ? (
        <div className="glass-card-heavy rounded-xl border border-white/10 p-6 text-sm text-zinc-300">Loading module...</div>
      ) : error || !moduleData ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error || 'Module not found'}</div>
      ) : (
        <div className="space-y-4">
          <Link
            href="/members/academy/modules"
            className="inline-flex items-center gap-1 text-sm text-zinc-300 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Modules
          </Link>

          <section className="glass-card-heavy rounded-xl border border-white/10 p-5">
            <h2 className="text-xl font-semibold text-white">{moduleData.title}</h2>
            <p className="mt-2 text-sm text-zinc-300">{moduleData.description || 'Structured training module.'}</p>
            <p className="mt-3 text-xs text-zinc-400">
              {moduleData.lessons.length} lessons · ~{moduleData.estimatedMinutes} min · Track: {trackTitle}
            </p>
          </section>

          <div className="space-y-2">
            {moduleData.lessons.map((lesson, index) => (
              <AcademyLessonRow
                key={lesson.id}
                lessonId={lesson.id}
                index={index}
                title={lesson.title}
                objective={lesson.learningObjective}
                estimatedMinutes={lesson.estimatedMinutes}
                status={lessonStatusById[lesson.id] || 'locked'}
              />
            ))}
          </div>
        </div>
      )}
    </AcademyShell>
  )
}
