'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Bookmark, BookOpen, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SavedCourse {
  id: string
  slug: string
  title: string
  description: string | null
}

interface SavedLesson {
  id: string
  title: string
  course_slug: string | null
  course_title: string | null
}

interface SavedItem {
  id: string
  entity_type: 'course' | 'lesson'
  entity_id: string
  created_at: string
  course: SavedCourse | null
  lesson: SavedLesson | null
}

interface SavedResponse {
  success: boolean
  data?: {
    items: SavedItem[]
  }
}

export default function AcademySavedPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null)
  const [items, setItems] = useState<SavedItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadSavedItems = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/academy/saved')
      const payload = (await response.json().catch(() => null)) as
        | (SavedResponse & { error?: string })
        | null

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            (response.status === 401
              ? 'Your session has expired. Refresh and sign in again.'
              : 'Failed to load saved items')
        )
      }

      if (!payload?.success || !payload.data) {
        throw new Error('Invalid saved items payload')
      }
      setItems(payload.data.items || [])
    } catch (savedError) {
      setError(savedError instanceof Error ? savedError.message : 'Unable to load saved items')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSavedItems()
  }, [loadSavedItems])

  const savedCourses = useMemo(
    () => items.filter((item) => item.entity_type === 'course' && item.course),
    [items]
  )
  const savedLessons = useMemo(
    () => items.filter((item) => item.entity_type === 'lesson' && item.lesson),
    [items]
  )

  const toggleSave = async (item: SavedItem) => {
    setIsUpdatingId(item.id)
    try {
      const response = await fetch('/api/academy/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: item.entity_type,
          entity_id: item.entity_id,
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; data?: { saved?: boolean }; error?: string }
        | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update saved item')
      }

      if (payload?.success && payload?.data?.saved === false) {
        setItems((previous) => previous.filter((saved) => saved.id !== item.id))
      }
    } catch (savedError) {
      setError(savedError instanceof Error ? savedError.message : 'Unable to update saved item')
    } finally {
      setIsUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5',
          'flex flex-col gap-2'
        )}
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <Bookmark className="w-4 h-4" />
          <h1 className="text-sm font-semibold uppercase tracking-[0.12em]">Saved</h1>
        </div>
        <p className="text-sm text-white/70">
          Your saved lessons, drills, and references will appear here for quick access.
        </p>
      </div>

      {error && (
        <div className="glass-card-heavy rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-100">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-3 h-4 w-72 animate-pulse rounded bg-white/10" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold text-white">Nothing saved yet</h2>
          <p className="mt-2 text-sm text-white/60">
            Save courses and lessons by clicking the bookmark icon.
          </p>
          <Link
            href="/members/academy/courses"
            className="inline-flex items-center gap-2 mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
          >
            Explore Courses
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/75">Saved Courses</h2>
            {savedCourses.length === 0 ? (
              <p className="mt-3 text-sm text-white/55">Courses you bookmark will appear here.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {savedCourses.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/members/academy/courses/${item.course?.slug}`}
                        className="text-sm font-medium text-white hover:text-emerald-300"
                      >
                        {item.course?.title || 'Saved course'}
                      </Link>
                      {item.course?.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-white/55">{item.course.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSave(item)}
                      disabled={isUpdatingId === item.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        isUpdatingId === item.id
                          ? 'cursor-not-allowed border-white/15 bg-white/[0.03] text-white/45'
                          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                      )}
                    >
                      {isUpdatingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                      Unsave
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/75">Saved Lessons</h2>
            {savedLessons.length === 0 ? (
              <p className="mt-3 text-sm text-white/55">Lesson bookmarks will appear here.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {savedLessons.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/members/academy/learn/${item.lesson?.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-emerald-300"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-emerald-300" />
                        {item.lesson?.title || 'Saved lesson'}
                      </Link>
                      {item.lesson?.course_slug && (
                        <p className="mt-1 text-xs text-white/55">
                          <Link
                            href={`/members/academy/courses/${item.lesson.course_slug}`}
                            className="hover:text-emerald-300"
                          >
                            {item.lesson.course_title || 'Course'}
                          </Link>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSave(item)}
                      disabled={isUpdatingId === item.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        isUpdatingId === item.id
                          ? 'cursor-not-allowed border-white/15 bg-white/[0.03] text-white/45'
                          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                      )}
                    >
                      {isUpdatingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                      Unsave
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
