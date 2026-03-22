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

type PeriodKey = '7d' | '30d' | '90d'

function periodToDays(period: PeriodKey): number {
  switch (period) {
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    default:
      return 30
  }
}

/**
 * GET /api/admin/academy/learning-analytics
 * Returns analytics data shaped for the LearningAnalytics dashboard component.
 * Supports ?period=7d|30d|90d and optional ?courseId=<uuid>.
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || '30d') as PeriodKey
    const courseId = searchParams.get('courseId') || null
    const days = periodToDays(period)
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const previousSinceDate = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString()

    const supabaseAdmin = getSupabaseAdmin()

    // Parallel queries for all metrics
    const [
      enrollmentsResult,
      activeProgressCurrentResult,
      activeProgressPreviousResult,
      lessonAttemptsCurrentResult,
      lessonAttemptsPreviousResult,
      quizAttemptsResult,
      eventsResult,
      lessonsWithModuleResult,
      blockEventsResult,
      lessonBlocksResult,
    ] = await Promise.all([
      // Total unique learners
      supabaseAdmin.from('academy_user_enrollments').select('user_id'),

      // Active learners (current period)
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('user_id, started_at, completed_at')
        .or(`started_at.gte.${sinceDate},completed_at.gte.${sinceDate}`),

      // Active learners (previous period for change calculation)
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('user_id, started_at, completed_at')
        .or(`started_at.gte.${previousSinceDate},started_at.lt.${sinceDate}`)
        .or(`completed_at.gte.${previousSinceDate},completed_at.lt.${sinceDate}`),

      // Lesson attempts (current period) — for completion rate + per-lesson breakdown
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('lesson_id, user_id, status, started_at, completed_at')
        .gte('started_at', sinceDate),

      // Lesson attempts (previous period) — for change calculation
      supabaseAdmin
        .from('academy_user_lesson_attempts')
        .select('lesson_id, user_id, status, started_at, completed_at')
        .gte('started_at', previousSinceDate)
        .lt('started_at', sinceDate),

      // Quiz score attempts
      supabaseAdmin
        .from('academy_user_assessment_attempts')
        .select('score, created_at')
        .not('score', 'is', null),

      // Learning events (current period) — daily active learners
      supabaseAdmin
        .from('academy_learning_events')
        .select('user_id, event_type, occurred_at, lesson_id, module_id')
        .gte('occurred_at', sinceDate)
        .order('occurred_at', { ascending: true }),

      // Lessons with module info
      supabaseAdmin
        .from('academy_lessons')
        .select('id, module_id, title, slug, academy_modules(id, title, slug)'),

      // Block-level completion events
      supabaseAdmin
        .from('academy_learning_events')
        .select('user_id, event_type, payload, lesson_id')
        .eq('event_type', 'block_completed')
        .gte('occurred_at', sinceDate),

      // All lesson blocks
      supabaseAdmin
        .from('academy_lesson_blocks')
        .select('id, lesson_id, position, title, block_type')
        .order('position', { ascending: true }),
    ])

    // ---------- Overview stats ----------
    const totalLearnersCurrent = new Set(
      (enrollmentsResult.data || []).map((r) => r.user_id).filter(Boolean)
    ).size

    const activeLearnersCurrentSet = new Set<string>()
    for (const row of activeProgressCurrentResult.data || []) {
      if (row.user_id) activeLearnersCurrentSet.add(row.user_id as string)
    }
    const activeLearnersCount = activeLearnersCurrentSet.size

    const activeLearnersPreviousSet = new Set<string>()
    for (const row of activeProgressPreviousResult.data || []) {
      if (row.user_id) activeLearnersPreviousSet.add(row.user_id as string)
    }
    const activeLearnersPreviousCount = activeLearnersPreviousSet.size

    // Completion rate: completed / started in current period
    const currentAttempts = lessonAttemptsCurrentResult.data || []
    const currentStarted = currentAttempts.length
    const currentCompleted = currentAttempts.filter((a) => a.status === 'passed').length
    const completionRate = currentStarted > 0 ? Math.round((currentCompleted / currentStarted) * 100) : 0

    const previousAttempts = lessonAttemptsPreviousResult.data || []
    const previousStarted = previousAttempts.length
    const previousCompleted = previousAttempts.filter((a) => a.status === 'passed').length
    const previousCompletionRate = previousStarted > 0 ? Math.round((previousCompleted / previousStarted) * 100) : 0

    // Quiz scores
    const allQuizScores = (quizAttemptsResult.data || [])
      .map((r) => (typeof r.score === 'number' ? r.score : null))
      .filter((s): s is number => s !== null)
    const avgQuizScore = allQuizScores.length > 0
      ? Math.round((allQuizScores.reduce((sum, s) => sum + s, 0) / allQuizScores.length) * 100)
      : 0

    // Changes
    const totalLearnersChange = 0 // Enrollment change requires tracking enrollment dates
    const activeLearnersChange = activeLearnersPreviousCount > 0
      ? Math.round(((activeLearnersCount - activeLearnersPreviousCount) / activeLearnersPreviousCount) * 100)
      : activeLearnersCount > 0 ? 100 : 0
    const completionRateChange = previousCompletionRate > 0
      ? completionRate - previousCompletionRate
      : completionRate > 0 ? completionRate : 0
    const avgQuizScoreChange = 0 // Would need period-bucketed quiz scores

    // ---------- Daily active learners ----------
    const dailyActiveMap = new Map<string, Set<string>>()
    for (const row of eventsResult.data || []) {
      if (!row.occurred_at || !row.user_id) continue
      const date = (row.occurred_at as string).slice(0, 10)
      const users = dailyActiveMap.get(date) || new Set<string>()
      users.add(row.user_id as string)
      dailyActiveMap.set(date, users)
    }
    const dailyActiveLearners = Array.from(dailyActiveMap.entries())
      .map(([date, users]) => ({ date, count: users.size }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ---------- Quiz score distribution ----------
    const scoreBuckets = ['0-20', '21-40', '41-60', '61-80', '81-100']
    const scoreDistribution = scoreBuckets.map((range) => ({ range, count: 0 }))
    for (const score of allQuizScores) {
      const pct = Math.round(score * 100)
      if (pct <= 20) scoreDistribution[0].count++
      else if (pct <= 40) scoreDistribution[1].count++
      else if (pct <= 60) scoreDistribution[2].count++
      else if (pct <= 80) scoreDistribution[3].count++
      else scoreDistribution[4].count++
    }

    // ---------- Lesson info lookup ----------
    const lessonInfoMap = new Map<string, { title: string; moduleId: string; moduleTitle: string }>()
    for (const row of lessonsWithModuleResult.data || []) {
      const relation = Array.isArray(row.academy_modules) ? row.academy_modules[0] : row.academy_modules
      lessonInfoMap.set(row.id as string, {
        title: (row.title as string) || 'Untitled',
        moduleId: (row.module_id as string) || '',
        moduleTitle: (relation as Record<string, unknown>)?.title as string || 'Unknown',
      })
    }

    // ---------- Per-lesson breakdown ----------
    const lessonStatsMap = new Map<string, {
      started: number
      completed: number
      totalTimeMs: number
      completedWithTime: number
      users: Set<string>
    }>()

    for (const row of currentAttempts) {
      const lid = row.lesson_id as string
      if (!lid) continue
      if (courseId) {
        const info = lessonInfoMap.get(lid)
        if (info && info.moduleId !== courseId) continue
      }
      const stats = lessonStatsMap.get(lid) || {
        started: 0, completed: 0, totalTimeMs: 0, completedWithTime: 0, users: new Set<string>(),
      }
      stats.started += 1
      stats.users.add(row.user_id as string)
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

    // Block-level drop-off detection
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
      list.push({
        id: block.id as string,
        position: block.position as number,
        title: block.title as string | null,
        blockType: block.block_type as string,
      })
      blocksByLesson.set(lid, list)
    }

    const lessonBreakdown = Array.from(lessonStatsMap.entries())
      .map(([lessonId, stats]) => {
        const info = lessonInfoMap.get(lessonId)
        const avgTimeMinutes = stats.completedWithTime > 0
          ? Math.round(stats.totalTimeMs / stats.completedWithTime / 60000)
          : 0
        const lessonCompletionRate = stats.started > 0
          ? Math.round((stats.completed / stats.started) * 100)
          : 0

        // Find drop-off block (lowest completion count)
        let dropOffBlock: {
          block_id: string
          title: string | null
          block_type: string
          position: number
        } | null = null
        const blocks = blocksByLesson.get(lessonId) || []
        const blockCounts = blockCompletionCounts.get(lessonId)
        if (blocks.length > 0 && blockCounts && blockCounts.size > 0) {
          let minCount = Infinity
          for (const block of blocks) {
            const count = blockCounts.get(block.id) || 0
            if (count < minCount) {
              minCount = count
              dropOffBlock = {
                block_id: block.id,
                title: block.title,
                block_type: block.blockType,
                position: block.position,
              }
            }
          }
        }

        return {
          lesson_id: lessonId,
          lesson_title: info?.title || 'Unknown',
          module_title: info?.moduleTitle || 'Unknown',
          completion_count: stats.completed,
          avg_time_minutes: avgTimeMinutes,
          completion_rate: lessonCompletionRate,
          drop_off_block: dropOffBlock,
        }
      })
      .sort((a, b) => b.completion_count - a.completion_count)
      .slice(0, 50)

    // ---------- Struggling lessons ----------
    const strugglingLessons = Array.from(lessonStatsMap.entries())
      .filter(([, stats]) => {
        const rate = stats.started > 0 ? (stats.completed / stats.started) * 100 : 100
        return rate < 70 && stats.started >= 3
      })
      .map(([lessonId, stats]) => {
        const info = lessonInfoMap.get(lessonId)
        const rate = stats.started > 0 ? Math.round((stats.completed / stats.started) * 100) : 0
        return {
          lesson_id: lessonId,
          lesson_title: info?.title || 'Unknown',
          course_title: info?.moduleTitle || 'Unknown',
          avg_score: rate,
          completion_rate: rate,
          user_count: stats.users.size,
        }
      })
      .sort((a, b) => a.completion_rate - b.completion_rate)
      .slice(0, 20)

    // ---------- Course (module) completion rates ----------
    const moduleStatsClean = new Map<string, { started: number; completed: number; title: string }>()
    for (const row of currentAttempts) {
      const lid = row.lesson_id as string
      const info = lessonInfoMap.get(lid)
      if (!info) continue
      const ms = moduleStatsClean.get(info.moduleId) || { started: 0, completed: 0, title: info.moduleTitle }
      ms.started += 1
      if (row.status === 'passed') ms.completed += 1
      moduleStatsClean.set(info.moduleId, ms)
    }

    const courseCompletions = Array.from(moduleStatsClean.entries())
      .map(([moduleId, ms]) => ({
        course_id: moduleId,
        course_title: ms.title,
        completion_rate: ms.started > 0 ? Math.round((ms.completed / ms.started) * 100) : 0,
      }))
      .sort((a, b) => b.completion_rate - a.completion_rate)

    return NextResponse.json({
      overview: {
        total_learners: totalLearnersCurrent,
        total_learners_change: totalLearnersChange,
        active_learners: activeLearnersCount,
        active_learners_change: activeLearnersChange,
        completion_rate: completionRate,
        completion_rate_change: completionRateChange,
        avg_quiz_score: avgQuizScore,
        avg_quiz_score_change: avgQuizScoreChange,
      },
      daily_active_learners: dailyActiveLearners,
      quiz_score_distribution: scoreDistribution,
      struggling_lessons: strugglingLessons,
      course_completions: courseCompletions,
      lesson_breakdown: lessonBreakdown,
    })
  } catch (error) {
    console.error('learning-analytics failed', error)
    return NextResponse.json(
      { error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
