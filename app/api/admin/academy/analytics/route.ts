import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function parsePayloadXp(payload: unknown): number {
  const parsed = asObject(payload)
  const candidates = [parsed.xp_earned, parsed.xpEarned, parsed.xp, parsed.points]
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }
  return 0
}

/**
 * GET /api/admin/academy/analytics
 * Admin-only academy analytics for academy_v3 schema.
 */
export async function GET(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(365, Math.max(1, Number.parseInt(searchParams.get('days') || '30', 10)))
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const supabaseAdmin = getSupabaseAdmin()

    const [
      enrollmentsResult,
      lessonCompletionsResult,
      courseCompletionsResult,
      quizRowsResult,
      onboardingResult,
      eventsResult,
      activeProgressRowsResult,
      lessonsWithModuleResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('user_id'),
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'passed')
        .gte('completed_at', sinceDate),
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', sinceDate),
      supabaseAdmin
        .from('academy_user_assessment_attempts')
        .select('score')
        .not('score', 'is', null),
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', sinceDate),
      supabaseAdmin
        .from('academy_learning_events')
        .select('user_id, event_type, payload, occurred_at, module_id')
        .gte('occurred_at', sinceDate)
        .order('occurred_at', { ascending: true }),
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('user_id, started_at, completed_at')
        .or(`started_at.gte.${sinceDate},completed_at.gte.${sinceDate}`),
      supabaseAdmin
        .from('academy_lessons')
        .select('id, module_id, academy_modules(title, slug)'),
    ])

    const totalLearners = new Set(
      (enrollmentsResult.data || [])
        .map((row) => row.user_id)
        .filter(Boolean)
    ).size

    const activeLearners = new Set<string>()
    for (const row of activeProgressRowsResult.data || []) {
      if (row.user_id) {
        activeLearners.add(row.user_id)
      }
    }

    const quizRows = (quizRowsResult.data || []).filter((row) => typeof row.score === 'number')
    const avgQuizScore = quizRows.length > 0
      ? Math.round((quizRows.reduce((sum, row) => sum + Number(row.score || 0), 0) / quizRows.length) * 100)
      : 0
    const quizPassRate = quizRows.length > 0
      ? Math.round((quizRows.filter((row) => Number(row.score || 0) >= 0.7).length / quizRows.length) * 100)
      : 0

    const lessonToModule = new Map<string, { moduleId: string; title: string; slug: string }>()
    for (const row of lessonsWithModuleResult.data || []) {
      const relation = Array.isArray(row.academy_modules) ? row.academy_modules[0] : row.academy_modules
      lessonToModule.set(row.id, {
        moduleId: row.module_id || 'unknown',
        title: relation?.title || 'Unknown',
        slug: relation?.slug || '',
      })
    }

    const moduleEventCounts = new Map<string, { count: number; title: string; slug: string }>()
    for (const row of eventsResult.data || []) {
      const moduleId = row.module_id || ''
      if (!moduleId) continue

      const existing = moduleEventCounts.get(moduleId)
      if (existing) {
        existing.count += 1
      } else {
        moduleEventCounts.set(moduleId, {
          count: 1,
          title: 'Unknown',
          slug: '',
        })
      }
    }

    // Backfill module title/slug from lesson relation if event only carried lesson_id in payload.
    for (const row of eventsResult.data || []) {
      const payload = asObject(row.payload)
      const lessonId = typeof payload.lesson_id === 'string' ? payload.lesson_id : null
      if (!lessonId) continue
      const lessonModule = lessonToModule.get(lessonId)
      if (!lessonModule) continue
      const existing = moduleEventCounts.get(lessonModule.moduleId)
      if (existing) {
        existing.title = lessonModule.title
        existing.slug = lessonModule.slug
      }
    }

    const topCourses = Array.from(moduleEventCounts.entries())
      .map(([course_id, info]) => ({
        course_id,
        title: info.title,
        slug: info.slug,
        enrollments: info.count,
      }))
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 10)

    const xpBySource = new Map<string, number>()
    let totalXpAwarded = 0
    for (const row of eventsResult.data || []) {
      const source = row.event_type || 'unknown'
      const amount = parsePayloadXp(row.payload)
      xpBySource.set(source, (xpBySource.get(source) || 0) + amount)
      totalXpAwarded += amount
    }

    const dailyActivityMap = new Map<string, Set<string>>()
    for (const row of eventsResult.data || []) {
      if (!row.occurred_at || !row.user_id) continue
      const date = row.occurred_at.slice(0, 10)
      const users = dailyActivityMap.get(date) || new Set<string>()
      users.add(row.user_id)
      dailyActivityMap.set(date, users)
    }

    const dailyActivity = Array.from(dailyActivityMap.entries())
      .map(([date, users]) => ({
        date,
        activities: users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_learners: totalLearners,
          active_learners: activeLearners.size,
          lessons_completed: lessonCompletionsResult.count || 0,
          courses_completed: courseCompletionsResult.count || 0,
          new_onboardings: onboardingResult.count || 0,
        },
        quiz_stats: {
          total_attempts: quizRows.length,
          avg_score: avgQuizScore,
          pass_rate: quizPassRate,
        },
        top_courses: topCourses,
        xp_stats: {
          total_awarded: totalXpAwarded,
          by_source: Object.fromEntries(xpBySource),
        },
        daily_activity: dailyActivity,
        period_days: days,
      },
    })
  } catch (error) {
    console.error('academy analytics failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
