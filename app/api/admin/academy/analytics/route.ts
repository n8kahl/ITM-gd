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

/** Parse period query param (7d/30d/90d) into number of days. */
function parsePeriodDays(period: string | null): number {
  switch (period) {
    case '7d': return 7
    case '90d': return 90
    default: return 30
  }
}

/**
 * GET /api/admin/academy/analytics
 * Admin-only academy analytics for academy_v3 schema.
 *
 * Response shape matches the LearningAnalytics component AnalyticsData interface:
 *   overview, daily_active_learners, quiz_score_distribution,
 *   struggling_lessons, course_completions, lesson_breakdown
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
    const days = parsePeriodDays(searchParams.get('period'))
    const now = Date.now()
    const sinceDate = new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
    const prevSinceDate = new Date(now - days * 2 * 24 * 60 * 60 * 1000).toISOString()

    const supabaseAdmin = getSupabaseAdmin()

    const [
      enrollmentsResult,
      lessonCompletionsResult,
      courseCompletionsResult,
      quizRowsResult,
      eventsResult,
      activeProgressRowsResult,
      lessonsWithModuleResult,
      lessonAttemptsDetailResult,
      blockEventsResult,
      lessonBlocksResult,
      // Previous period queries for change deltas
      prevEnrollmentsResult,
      prevActiveProgressResult,
      prevLessonCompletionsResult,
      prevQuizRowsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('user_id, started_at'),
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'passed')
        .gte('completed_at', sinceDate),
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('id, status, completed_at, user_id')
        .eq('status', 'completed'),
      supabaseAdmin
        .from('academy_user_assessment_attempts')
        .select('score, created_at')
        .not('score', 'is', null),
      supabaseAdmin
        .from('academy_learning_events')
        .select('user_id, event_type, payload, occurred_at, module_id, lesson_id')
        .gte('occurred_at', sinceDate)
        .order('occurred_at', { ascending: true }),
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('user_id, started_at, completed_at, lesson_id, status')
        .or(`started_at.gte.${sinceDate},completed_at.gte.${sinceDate}`),
      supabaseAdmin
        .from('academy_lessons')
        .select('id, module_id, title, slug, academy_modules(title, slug)'),
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('lesson_id, user_id, status, started_at, completed_at')
        .gte('started_at', sinceDate),
      supabaseAdmin
        .from('academy_learning_events')
        .select('user_id, event_type, payload, lesson_id')
        .eq('event_type', 'block_completed')
        .gte('occurred_at', sinceDate),
      supabaseAdmin
        .from('academy_lesson_blocks')
        .select('id, lesson_id, position, title, block_type')
        .order('position', { ascending: true }),
      // Previous period: enrollments
      supabaseAdmin
        .from('academy_user_enrollments')
        .select('user_id')
        .gte('started_at', prevSinceDate)
        .lt('started_at', sinceDate),
      // Previous period: active learners
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('user_id')
        .or(`started_at.gte.${prevSinceDate},completed_at.gte.${prevSinceDate}`)
        .lt('started_at', sinceDate),
      // Previous period: lesson completions
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'passed')
        .gte('completed_at', prevSinceDate)
        .lt('completed_at', sinceDate),
      // Previous period: quiz scores
      supabaseAdmin
        .from('academy_user_assessment_attempts')
        .select('score, created_at')
        .not('score', 'is', null)
        .gte('created_at', prevSinceDate)
        .lt('created_at', sinceDate),
    ])

    // --- Overview stats ---
    const totalLearners = new Set(
      (enrollmentsResult.data || [])
        .map((row: { user_id: string }) => row.user_id)
        .filter(Boolean)
    ).size

    const activeLearners = new Set<string>()
    for (const row of activeProgressRowsResult.data || []) {
      if (row.user_id) activeLearners.add(row.user_id as string)
    }

    // Completion rate: completed enrollments / total enrollments
    const allEnrollments = enrollmentsResult.data || []
    const completedEnrollments = (courseCompletionsResult.data || []).length
    const completionRate = allEnrollments.length > 0
      ? (completedEnrollments / allEnrollments.length) * 100
      : 0

    // Quiz scores
    const quizRows = (quizRowsResult.data || []).filter(
      (row: { score: number | null }) => typeof row.score === 'number'
    )
    const avgQuizScore = quizRows.length > 0
      ? (quizRows.reduce((sum: number, row: { score: number | null }) => sum + Number(row.score || 0), 0) / quizRows.length) * 100
      : 0

    // Previous period stats for change calculations
    const prevTotalLearners = new Set(
      (prevEnrollmentsResult.data || [])
        .map((row: { user_id: string }) => row.user_id)
        .filter(Boolean)
    ).size

    const prevActiveLearners = new Set(
      (prevActiveProgressResult.data || [])
        .map((row: { user_id: string }) => row.user_id)
        .filter(Boolean)
    ).size

    const prevQuizRows = (prevQuizRowsResult.data || []).filter(
      (row: { score: number | null }) => typeof row.score === 'number'
    )
    const prevAvgQuizScore = prevQuizRows.length > 0
      ? (prevQuizRows.reduce((sum: number, row: { score: number | null }) => sum + Number(row.score || 0), 0) / prevQuizRows.length) * 100
      : 0

    function percentChange(current: number, previous: number): number {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }

    const overview = {
      total_learners: totalLearners,
      total_learners_change: percentChange(totalLearners, prevTotalLearners),
      active_learners: activeLearners.size,
      active_learners_change: percentChange(activeLearners.size, prevActiveLearners),
      completion_rate: Math.round(completionRate * 10) / 10,
      completion_rate_change: 0, // Would need prev period enrollment completion data
      avg_quiz_score: Math.round(avgQuizScore * 10) / 10,
      avg_quiz_score_change: percentChange(avgQuizScore, prevAvgQuizScore),
    }

    // --- Daily active learners ---
    const dailyActivityMap = new Map<string, Set<string>>()
    for (const row of eventsResult.data || []) {
      if (!row.occurred_at || !row.user_id) continue
      const date = (row.occurred_at as string).slice(0, 10)
      const users = dailyActivityMap.get(date) || new Set<string>()
      users.add(row.user_id as string)
      dailyActivityMap.set(date, users)
    }

    const daily_active_learners = Array.from(dailyActivityMap.entries())
      .map(([date, users]) => ({ date, count: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days)

    // --- Quiz score distribution ---
    const scoreBuckets = [
      { range: '0-20%', min: 0, max: 20 },
      { range: '21-40%', min: 21, max: 40 },
      { range: '41-60%', min: 41, max: 60 },
      { range: '61-80%', min: 61, max: 80 },
      { range: '81-100%', min: 81, max: 100 },
    ]
    const quiz_score_distribution = scoreBuckets.map(({ range, min, max }) => ({
      range,
      count: quizRows.filter((row: { score: number | null }) => {
        const pct = Number(row.score || 0) * 100
        return pct >= min && pct <= max
      }).length,
    }))

    // --- Struggling lessons (low avg score or completion rate) ---
    const lessonToModule = new Map<string, { moduleId: string; title: string }>()
    for (const row of lessonsWithModuleResult.data || []) {
      const relation = Array.isArray(row.academy_modules)
        ? row.academy_modules[0]
        : row.academy_modules
      lessonToModule.set(row.id as string, {
        moduleId: (row.module_id as string) || 'unknown',
        title: (relation as Record<string, string> | null)?.title || 'Unknown',
      })
    }

    // Build per-lesson quiz stats for struggling detection
    const lessonQuizStats = new Map<string, { scores: number[]; userIds: Set<string> }>()
    for (const evt of eventsResult.data || []) {
      if (evt.event_type !== 'assessment_completed') continue
      const payload = asObject(evt.payload)
      const lessonId = typeof payload.lesson_id === 'string' ? payload.lesson_id : (evt.lesson_id as string)
      const score = typeof payload.score === 'number' ? payload.score : null
      if (!lessonId || score === null) continue
      const stats = lessonQuizStats.get(lessonId) || { scores: [], userIds: new Set<string>() }
      stats.scores.push(score * 100)
      if (evt.user_id) stats.userIds.add(evt.user_id as string)
      lessonQuizStats.set(lessonId, stats)
    }

    // Also use lesson attempt data for struggling detection
    const lessonAttemptStats = new Map<string, { started: number; completed: number; userIds: Set<string> }>()
    for (const row of lessonAttemptsDetailResult.data || []) {
      const lid = row.lesson_id as string
      if (!lid) continue
      const stats = lessonAttemptStats.get(lid) || { started: 0, completed: 0, userIds: new Set<string>() }
      stats.started += 1
      if (row.status === 'passed') stats.completed += 1
      if (row.user_id) stats.userIds.add(row.user_id as string)
      lessonAttemptStats.set(lid, stats)
    }

    const lessonInfoMap = new Map<string, { title: string; moduleTitle: string }>()
    for (const row of lessonsWithModuleResult.data || []) {
      const relation = Array.isArray(row.academy_modules)
        ? row.academy_modules[0]
        : row.academy_modules
      lessonInfoMap.set(row.id as string, {
        title: (row.title as string) || 'Untitled',
        moduleTitle: (relation as Record<string, string> | null)?.title || 'Unknown',
      })
    }

    const struggling_lessons: Array<{
      lesson_id: string
      lesson_title: string
      course_title: string
      avg_score: number
      completion_rate: number
      user_count: number
    }> = []

    for (const [lessonId, info] of lessonInfoMap) {
      const quizStats = lessonQuizStats.get(lessonId)
      const attemptStats = lessonAttemptStats.get(lessonId)
      if (!attemptStats || attemptStats.started === 0) continue

      const avgScore = quizStats && quizStats.scores.length > 0
        ? quizStats.scores.reduce((a, b) => a + b, 0) / quizStats.scores.length
        : 0
      const cr = (attemptStats.completed / attemptStats.started) * 100

      // Mark as struggling if avg score < 70 or completion rate < 50
      if (avgScore < 70 || cr < 50) {
        const moduleInfo = lessonToModule.get(lessonId)
        struggling_lessons.push({
          lesson_id: lessonId,
          lesson_title: info.title,
          course_title: moduleInfo?.title || info.moduleTitle,
          avg_score: Math.round(avgScore * 10) / 10,
          completion_rate: Math.round(cr * 10) / 10,
          user_count: attemptStats.userIds.size,
        })
      }
    }

    struggling_lessons.sort((a, b) => a.avg_score - b.avg_score)

    // --- Course completions ---
    // Use event-based module activity to derive per-course completion rates
    const moduleActivityCounts = new Map<string, { users: Set<string>; completedUsers: Set<string>; title: string }>()
    for (const row of eventsResult.data || []) {
      const moduleId = row.module_id as string
      if (!moduleId) continue
      const stats = moduleActivityCounts.get(moduleId) || { users: new Set<string>(), completedUsers: new Set<string>(), title: 'Unknown' }
      if (row.user_id) stats.users.add(row.user_id as string)
      if (row.event_type === 'module_completed' && row.user_id) {
        stats.completedUsers.add(row.user_id as string)
      }
      moduleActivityCounts.set(moduleId, stats)
    }

    // Backfill titles from lesson-module relation
    for (const [, info] of lessonToModule) {
      const stats = moduleActivityCounts.get(info.moduleId)
      if (stats) stats.title = info.title
    }

    const course_completions = Array.from(moduleActivityCounts.entries())
      .filter(([, stats]) => stats.users.size > 0)
      .map(([courseId, stats]) => ({
        course_id: courseId,
        course_title: stats.title,
        completion_rate: stats.users.size > 0
          ? Math.round((stats.completedUsers.size / stats.users.size) * 100)
          : 0,
      }))
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 10)

    // --- Per-lesson breakdown ---
    const lessonAttempts = lessonAttemptsDetailResult.data || []
    const lessonStatsMap = new Map<string, {
      started: number
      completed: number
      totalTimeMs: number
      completedWithTime: number
    }>()
    for (const row of lessonAttempts) {
      const lid = row.lesson_id as string
      if (!lid) continue
      const stats = lessonStatsMap.get(lid) || { started: 0, completed: 0, totalTimeMs: 0, completedWithTime: 0 }
      stats.started += 1
      if (row.status === 'passed' && row.completed_at) {
        stats.completed += 1
        if (row.started_at) {
          const elapsed = new Date(row.completed_at as string).getTime() - new Date(row.started_at as string).getTime()
          if (elapsed > 0 && elapsed < 24 * 60 * 60 * 1000) {
            stats.totalTimeMs += elapsed
            stats.completedWithTime += 1
          }
        }
      }
      lessonStatsMap.set(lid, stats)
    }

    // Block-level completion counts per lesson for drop-off detection
    const blockCompletionCounts = new Map<string, Map<string, number>>()
    for (const evt of blockEventsResult.data || []) {
      const lid = evt.lesson_id as string
      const payload = asObject(evt.payload)
      const blockId = typeof payload.block_id === 'string' ? payload.block_id : null
      if (!lid || !blockId) continue
      const lessonMap = blockCompletionCounts.get(lid) || new Map<string, number>()
      lessonMap.set(blockId, (lessonMap.get(blockId) || 0) + 1)
      blockCompletionCounts.set(lid, lessonMap)
    }

    const blocksByLesson = new Map<string, Array<{ id: string; position: number; title: string | null; blockType: string }>>()
    for (const block of lessonBlocksResult.data || []) {
      const lid = block.lesson_id as string
      if (!lid) continue
      const list = blocksByLesson.get(lid) || []
      list.push({ id: block.id as string, position: block.position as number, title: block.title as string | null, blockType: block.block_type as string })
      blocksByLesson.set(lid, list)
    }

    const lesson_breakdown = Array.from(lessonStatsMap.entries())
      .map(([lessonId, stats]) => {
        const info = lessonInfoMap.get(lessonId)
        const avgTimeMinutes = stats.completedWithTime > 0
          ? Math.round(stats.totalTimeMs / stats.completedWithTime / 60000)
          : 0
        const cr = stats.started > 0
          ? Math.round((stats.completed / stats.started) * 100)
          : 0

        let dropOffBlock: { id: string; title: string | null; blockType: string; position: number } | null = null
        const blocks = blocksByLesson.get(lessonId) || []
        const blockCounts = blockCompletionCounts.get(lessonId)
        if (blocks.length > 0 && blockCounts && blockCounts.size > 0) {
          let minCount = Infinity
          for (const block of blocks) {
            const count = blockCounts.get(block.id) || 0
            if (count < minCount) {
              minCount = count
              dropOffBlock = block
            }
          }
        }

        return {
          lesson_id: lessonId,
          lesson_title: info?.title || 'Unknown',
          module_title: info?.moduleTitle || 'Unknown',
          completion_count: stats.completed,
          avg_time_minutes: avgTimeMinutes,
          completion_rate: cr,
          drop_off_block: dropOffBlock ? {
            block_id: dropOffBlock.id,
            title: dropOffBlock.title,
            block_type: dropOffBlock.blockType,
            position: dropOffBlock.position,
          } : null,
        }
      })
      .sort((a, b) => b.completion_count - a.completion_count)
      .slice(0, 50)

    // Return flat AnalyticsData shape (component casts entire response as AnalyticsData)
    return NextResponse.json({
      overview,
      daily_active_learners,
      quiz_score_distribution,
      struggling_lessons,
      course_completions,
      lesson_breakdown,
    })
  } catch (error) {
    console.error('academy analytics failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
