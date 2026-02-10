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

function normalizeCourseRelation(
  value: unknown
): { title?: string; slug?: string } | null {
  if (Array.isArray(value)) {
    const first = value[0]
    return first && typeof first === 'object'
      ? (first as { title?: string; slug?: string })
      : null
  }

  if (value && typeof value === 'object') {
    return value as { title?: string; slug?: string }
  }

  return null
}

/**
 * GET /api/admin/academy/analytics
 * Admin-only academy analytics using current production schema.
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
      totalLearnersResult,
      lessonCompletionsResult,
      courseCompletionsResult,
      quizRowsResult,
      courseProgressRowsResult,
      onboardingResult,
      xpActivityRowsResult,
      dailyActivityRowsResult,
      activeProgressRowsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('user_learning_profiles')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('user_lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', sinceDate),
      supabaseAdmin
        .from('user_course_progress')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', sinceDate),
      supabaseAdmin
        .from('user_lesson_progress')
        .select('quiz_score, quiz_attempts')
        .gt('quiz_attempts', 0),
      supabaseAdmin
        .from('user_course_progress')
        .select('course_id, courses(title, slug)'),
      supabaseAdmin
        .from('user_learning_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceDate),
      supabaseAdmin
        .from('user_learning_activity_log')
        .select('activity_type, xp_earned')
        .gte('created_at', sinceDate)
        .gt('xp_earned', 0),
      supabaseAdmin
        .from('user_learning_activity_log')
        .select('user_id, created_at')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('user_lesson_progress')
        .select('user_id, started_at, completed_at')
        .or(`started_at.gte.${sinceDate},completed_at.gte.${sinceDate}`),
    ])

    const activeLearners = new Set<string>()
    for (const row of activeProgressRowsResult.data || []) {
      if (row.user_id) {
        activeLearners.add(row.user_id)
      }
    }

    const quizRows = quizRowsResult.data || []
    const scoredQuizRows = quizRows.filter((row) => typeof row.quiz_score === 'number')
    const avgQuizScore = scoredQuizRows.length > 0
      ? Math.round(scoredQuizRows.reduce((sum, row) => sum + (row.quiz_score || 0), 0) / scoredQuizRows.length)
      : 0
    const quizPassRate = scoredQuizRows.length > 0
      ? Math.round((scoredQuizRows.filter((row) => (row.quiz_score || 0) >= 70).length / scoredQuizRows.length) * 100)
      : 0

    const courseCounts = new Map<string, { count: number; title: string; slug: string }>()
    for (const row of courseProgressRowsResult.data || []) {
      const courseId = row.course_id
      if (!courseId) continue

      const existing = courseCounts.get(courseId)
      const courseInfo = normalizeCourseRelation(row.courses)
      if (existing) {
        existing.count += 1
      } else {
        courseCounts.set(courseId, {
          count: 1,
          title: courseInfo?.title || 'Unknown',
          slug: courseInfo?.slug || '',
        })
      }
    }

    const topCourses = Array.from(courseCounts.entries())
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
    for (const row of xpActivityRowsResult.data || []) {
      const source = row.activity_type || 'unknown'
      const amount = row.xp_earned || 0
      xpBySource.set(source, (xpBySource.get(source) || 0) + amount)
      totalXpAwarded += amount
    }

    const dailyActivityMap = new Map<string, Set<string>>()
    for (const row of dailyActivityRowsResult.data || []) {
      if (!row.created_at || !row.user_id) continue
      const date = row.created_at.slice(0, 10)
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
          total_learners: totalLearnersResult.count || 0,
          active_learners: activeLearners.size,
          lessons_completed: lessonCompletionsResult.count || 0,
          courses_completed: courseCompletionsResult.count || 0,
          new_onboardings: onboardingResult.count || 0,
        },
        quiz_stats: {
          total_attempts: quizRows.reduce((sum, row) => sum + (row.quiz_attempts || 0), 0),
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
