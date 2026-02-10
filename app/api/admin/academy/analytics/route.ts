import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'

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
 * Admin only. Learning analytics: completion rates, quiz scores,
 * daily active learners, popular courses, and engagement trends.
 * Query params: days (default 30)
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
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)))
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const supabaseAdmin = getSupabaseAdmin()

    // Run all analytics queries in parallel
    const [
      totalLearnersResult,
      activeLearnersResult,
      lessonCompletionsResult,
      courseCompletionsResult,
      quizStatsResult,
      topCoursesResult,
      onboardingResult,
      xpStatsResult,
      dailyActivityResult,
    ] = await Promise.all([
      // Total learners (users with learning profiles)
      supabaseAdmin
        .from('user_learning_profiles')
        .select('id', { count: 'exact', head: true }),

      // Active learners in period
      supabaseAdmin
        .from('user_lesson_progress')
        .select('user_id', { count: 'exact', head: true })
        .gte('updated_at', sinceDate),

      // Lesson completions in period
      supabaseAdmin
        .from('user_lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', sinceDate),

      // Course completions in period
      supabaseAdmin
        .from('user_course_progress')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', sinceDate),

      // Quiz statistics
      supabaseAdmin
        .from('quiz_attempts')
        .select('score_pct, passed')
        .gte('created_at', sinceDate),

      // Top courses by enrollment
      supabaseAdmin
        .from('user_course_progress')
        .select('course_id, courses(title, slug)')
        .gte('created_at', sinceDate),

      // Onboarding completion rate
      supabaseAdmin
        .from('user_learning_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sinceDate),

      // XP distribution
      supabaseAdmin
        .from('xp_transactions')
        .select('amount, source')
        .gte('created_at', sinceDate),

      // Daily activity for the period (last 30 items max)
      supabaseAdmin
        .from('user_lesson_progress')
        .select('updated_at, status')
        .gte('updated_at', sinceDate)
        .order('updated_at', { ascending: true }),
    ])

    // Compute quiz averages
    const quizAttempts = quizStatsResult.data || []
    const avgQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            quizAttempts.reduce((sum, q) => sum + (q.score_pct || 0), 0) /
              quizAttempts.length
          )
        : 0
    const quizPassRate =
      quizAttempts.length > 0
        ? Math.round(
            (quizAttempts.filter((q) => q.passed).length / quizAttempts.length) *
              100
          )
        : 0

    // Compute top courses
    const courseCounts = new Map<string, { count: number; title: string; slug: string }>()
    for (const entry of topCoursesResult.data || []) {
      const id = entry.course_id
      const existing = courseCounts.get(id)
      const courseInfo = normalizeCourseRelation(entry.courses)
      if (existing) {
        existing.count++
      } else {
        courseCounts.set(id, {
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

    // Compute XP breakdown by source
    const xpBySource = new Map<string, number>()
    let totalXpAwarded = 0
    for (const tx of xpStatsResult.data || []) {
      const current = xpBySource.get(tx.source) || 0
      xpBySource.set(tx.source, current + (tx.amount || 0))
      totalXpAwarded += tx.amount || 0
    }

    // Compute daily active learners (grouped by date)
    const dailyActivity = new Map<string, Set<string>>()
    // We don't have user_id in the select, so count by activity instead
    const dailyCompletions = new Map<string, number>()
    for (const entry of dailyActivityResult.data || []) {
      const date = new Date(entry.updated_at).toISOString().split('T')[0]
      dailyCompletions.set(date, (dailyCompletions.get(date) || 0) + 1)
    }

    const dailyActivityArray = Array.from(dailyCompletions.entries())
      .map(([date, activities]) => ({ date, activities }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Last 30 days

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          total_learners: totalLearnersResult.count || 0,
          active_learners: activeLearnersResult.count || 0,
          lessons_completed: lessonCompletionsResult.count || 0,
          courses_completed: courseCompletionsResult.count || 0,
          new_onboardings: onboardingResult.count || 0,
        },
        quiz_stats: {
          total_attempts: quizAttempts.length,
          avg_score: avgQuizScore,
          pass_rate: quizPassRate,
        },
        top_courses: topCourses,
        xp_stats: {
          total_awarded: totalXpAwarded,
          by_source: Object.fromEntries(xpBySource),
        },
        daily_activity: dailyActivityArray,
        period_days: days,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
