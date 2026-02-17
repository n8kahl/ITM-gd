'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { AcademyPanel, AcademyV3Shell } from '@/components/academy-v3/academy-v3-shell'
import { AcademyMarkdown } from '@/components/academy-v3/shared/academy-markdown'
import { fetchAcademyLesson, fetchAcademyModule, fetchAcademyPlan } from '@/lib/academy-v3/client'

type PlanData = Awaited<ReturnType<typeof fetchAcademyPlan>>
type ModuleData = Awaited<ReturnType<typeof fetchAcademyModule>>
type LessonData = Awaited<ReturnType<typeof fetchAcademyLesson>>

function getBlockMarkdown(block: LessonData['blocks'][number]): string {
  const markdown = block.contentJson?.markdown
  if (typeof markdown === 'string' && markdown.trim().length > 0) {
    return markdown
  }

  const content = block.contentJson?.content
  if (typeof content === 'string' && content.trim().length > 0) {
    return content
  }

  return '_No block content available for this step yet._'
}

export function ModulesCatalog() {
  const searchParams = useSearchParams()
  const requestedModuleSlug = searchParams.get('module')
  const requestedLessonId = searchParams.get('lesson')
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [selectedModule, setSelectedModule] = useState<ModuleData | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [moduleLoading, setModuleLoading] = useState(false)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectModule = (slug: string | null) => {
    setSelectedSlug(slug)
    setModuleLoading(Boolean(slug))
    setSelectedLessonId(null)
    setSelectedLesson(null)
    setLessonLoading(false)
  }

  const selectLesson = (lessonId: string | null) => {
    setSelectedLessonId(lessonId)
    setSelectedLesson(null)
    setLessonLoading(Boolean(lessonId))
  }

  useEffect(() => {
    let active = true

    fetchAcademyPlan()
      .then((planData) => {
        if (!active) return
        setPlan(planData)
        const availableModules = planData.tracks.flatMap((track) => track.modules)
        const firstModuleSlug = planData.tracks[0]?.modules[0]?.slug || null
        const lessonMatchedModule = requestedLessonId
          ? availableModules.find((moduleItem) => (
            moduleItem.lessons.some((lesson) => lesson.id === requestedLessonId)
          ))
          : null
        const preferredModuleSlug = (
          requestedModuleSlug && availableModules.some((moduleItem) => moduleItem.slug === requestedModuleSlug)
        )
          ? requestedModuleSlug
          : lessonMatchedModule?.slug || firstModuleSlug
        selectModule(preferredModuleSlug)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load modules')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [requestedLessonId, requestedModuleSlug])

  useEffect(() => {
    if (!selectedSlug) {
      return
    }

    let active = true

    fetchAcademyModule(selectedSlug)
      .then((moduleData) => {
        if (!active) return
        setSelectedModule(moduleData)
        const preferredLessonId = (
          requestedLessonId && moduleData.lessons.some((lesson) => lesson.id === requestedLessonId)
        )
          ? requestedLessonId
          : moduleData.lessons[0]?.id || null
        selectLesson(preferredLessonId)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load module details')
      })
      .finally(() => {
        if (active) setModuleLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedSlug, requestedLessonId])

  useEffect(() => {
    if (!selectedLessonId) {
      return
    }

    let active = true

    fetchAcademyLesson(selectedLessonId)
      .then((lessonData) => {
        if (!active) return
        setSelectedLesson(lessonData)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load lesson details')
      })
      .finally(() => {
        if (active) setLessonLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedLessonId])

  const modules = useMemo(() => {
    if (!plan) return []

    return plan.tracks.flatMap((track) =>
      track.modules.map((moduleItem) => ({
        ...moduleItem,
        trackTitle: track.title,
      }))
    )
  }, [plan])

  return (
    <AcademyV3Shell
      title="Modules"
      description="Choose a module and work lesson-by-lesson through structured blocks, assessments, and remediation."
    >
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-[#111318] p-6 text-sm text-zinc-300">Loading modules...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr]">
          <AcademyPanel title="Module List">
            <ul className="space-y-2">
              {modules.map((moduleItem) => (
                <li key={moduleItem.id}>
                  <button
                    type="button"
                    onClick={() => selectModule(moduleItem.slug)}
                    className={`w-full rounded-md border px-3 py-3 text-left transition-colors ${
                      moduleItem.slug === selectedSlug
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/10 bg-transparent hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{moduleItem.title}</p>
                    <p className="mt-1 text-xs text-zinc-400">{moduleItem.trackTitle} · {moduleItem.lessons.length} lessons</p>
                  </button>
                </li>
              ))}
            </ul>
          </AcademyPanel>

          <AcademyPanel title="Module + Lesson Content">
            {moduleLoading ? (
              <p className="text-sm text-zinc-400">Loading module details...</p>
            ) : selectedModule ? (
              <div className="space-y-4">
                <div>
                  <p className="text-base font-medium text-white">{selectedModule.title}</p>
                  <p className="mt-1 text-sm text-zinc-300">{selectedModule.description || 'No description provided.'}</p>
                  <p className="mt-2 text-xs text-zinc-400">{selectedModule.estimatedMinutes} minutes estimated</p>
                </div>

                <ol className="space-y-2">
                  {selectedModule.lessons.map((lesson, index) => (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => selectLesson(lesson.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                          lesson.id === selectedLessonId
                            ? 'border-emerald-500/40 bg-emerald-500/10'
                            : 'border-white/10 bg-transparent hover:border-white/20'
                        }`}
                      >
                        <p className="text-sm text-white">{index + 1}. {lesson.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {lesson.estimatedMinutes} min · {lesson.difficulty}
                        </p>
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="rounded-md border border-white/10 bg-[#0f1117] p-4">
                  {lessonLoading ? (
                    <p className="text-sm text-zinc-400">Loading lesson content...</p>
                  ) : selectedLesson ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-base font-semibold text-white">{selectedLesson.title}</p>
                        <p className="mt-1 text-sm text-zinc-300">{selectedLesson.learningObjective}</p>
                      </div>

                      {selectedLesson.blocks.length === 0 ? (
                        <p className="text-sm text-zinc-400">No lesson blocks are available yet.</p>
                      ) : (
                        <ol className="space-y-3">
                          {selectedLesson.blocks.map((block, index) => (
                            <li key={block.id} className="rounded-md border border-white/10 bg-[#10131a] p-3">
                              <p className="text-xs uppercase tracking-wide text-emerald-300">
                                Step {index + 1}: {block.blockType.replaceAll('_', ' ')}
                              </p>
                              {block.title ? <p className="mt-1 text-sm font-medium text-white">{block.title}</p> : null}
                              <div className="mt-2 text-sm text-zinc-200">
                                <AcademyMarkdown content={getBlockMarkdown(block)} />
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">Choose a lesson to view full content.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Choose a module to view lessons.</p>
            )}
          </AcademyPanel>
        </div>
      )}
    </AcademyV3Shell>
  )
}
