import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

const COMPETENCY_VALUES = new Set([
  'market_context',
  'entry_validation',
  'position_sizing',
  'trade_management',
  'exit_discipline',
  'review_reflection',
])

type CompetencyKey =
  | 'market_context'
  | 'entry_validation'
  | 'position_sizing'
  | 'trade_management'
  | 'exit_discipline'
  | 'review_reflection'

function parseLimit(value: string | null): number {
  if (!value) return 20
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 20
  return Math.max(1, Math.min(100, Math.round(parsed)))
}

function normalizeCompetency(value: string | null): CompetencyKey | null {
  if (!value || !COMPETENCY_VALUES.has(value)) return null
  return value as CompetencyKey
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const limit = parseLimit(searchParams.get('limit'))
    const competency = normalizeCompetency(searchParams.get('competency'))
    const nowIso = new Date().toISOString()

    let queueQuery = supabase
      .from('review_queue_items')
      .select(`
        id,
        competency_key,
        source_lesson_id,
        source_course_id,
        question_data,
        due_at,
        interval_stage,
        status,
        difficulty_rating,
        stability_days,
        lessons:source_lesson_id (id, title),
        courses:source_course_id (id, title)
      `)
      .eq('user_id', user.id)
      .eq('status', 'due')
      .lte('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(limit)

    if (competency) {
      queueQuery = queueQuery.eq('competency_key', competency)
    }

    let dueCountQuery = supabase
      .from('review_queue_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'due')
      .lte('due_at', nowIso)

    if (competency) {
      dueCountQuery = dueCountQuery.eq('competency_key', competency)
    }

    const [queueResult, dueCountResult, competencyResult] = await Promise.all([
      queueQuery,
      dueCountQuery,
      supabase
        .from('user_competency_scores')
        .select('competency_key, score')
        .eq('user_id', user.id)
        .order('score', { ascending: true }),
    ])

    if (queueResult.error) {
      return NextResponse.json({ success: false, error: 'Failed to load review queue' }, { status: 500 })
    }

    const dueCountsByCompetency = new Map<CompetencyKey, number>()
    for (const row of queueResult.data || []) {
      const key = row.competency_key as CompetencyKey
      dueCountsByCompetency.set(key, (dueCountsByCompetency.get(key) || 0) + 1)
    }

    const weakCompetencies = (competencyResult.data || [])
      .map((row) => ({
        key: row.competency_key as CompetencyKey,
        score: Number(row.score || 0),
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((row) => row.key)

    const fallbackWeakCompetencies = [...dueCountsByCompetency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key)

    const totalDue = dueCountResult.count || 0

    const items = (queueResult.data || []).map((row) => {
      const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses

      return {
        id: row.id,
        competency_key: row.competency_key,
        source_lesson_id: row.source_lesson_id,
        source_course_id: row.source_course_id,
        lesson_title: lesson?.title || null,
        course_title: course?.title || null,
        question_data: row.question_data || null,
        due_at: row.due_at,
        interval_stage: row.interval_stage || 0,
        status: row.status,
        difficulty_rating: Number(row.difficulty_rating || 5),
        stability_days: Number(row.stability_days || 1),
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        items,
        stats: {
          total_due: totalDue,
          estimated_minutes: Math.max(1, Math.ceil(totalDue * 1.5)),
          weak_competencies: weakCompetencies.length > 0 ? weakCompetencies : fallbackWeakCompetencies,
        },
      },
    })
  } catch (error) {
    console.error('academy review queue failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
