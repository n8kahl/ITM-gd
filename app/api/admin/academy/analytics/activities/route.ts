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

/**
 * GET /api/admin/academy/analytics/activities
 * Per-activity analytics: pass rate, avg score, time-to-complete.
 *
 * Query params:
 *   blockType — optional filter by activity block type
 *   lessonId  — optional filter by lesson UUID
 *   limit     — max results (default 50, max 200)
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
    const blockType = searchParams.get('blockType')
    const lessonId = searchParams.get('lessonId')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 1), 200)

    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from('academy_learning_events')
      .select('entity_id, xp_earned, metadata, created_at')
      .eq('event_type', 'activity_submission')
      .order('created_at', { ascending: false })
      .limit(limit * 20) // Fetch extra rows for grouping

    if (blockType) {
      query = query.filter('metadata->>blockType', 'eq', blockType)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch activity analytics', error.message)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity analytics' },
        { status: 500 }
      )
    }

    // Aggregate by block
    const byBlock = new Map<string, {
      blockId: string
      blockType: string
      lessonId: string
      submissions: number
      passes: number
      totalScore: number
      totalMaxScore: number
      totalTimeMs: number
      timeCount: number
    }>()

    for (const row of data ?? []) {
      const meta = row.metadata as Record<string, unknown> | null
      if (!meta) continue

      const blockId = row.entity_id as string
      const bt = (meta.blockType as string) ?? 'unknown'
      const lid = (meta.lessonId as string) ?? ''
      const score = typeof meta.score === 'number' ? meta.score : 0
      const maxScore = typeof meta.maxScore === 'number' ? meta.maxScore : 0
      const isCorrect = meta.isCorrect === true
      const timeSpentMs = typeof meta.timeSpentMs === 'number' ? meta.timeSpentMs : 0

      // Apply lessonId filter at JS level since metadata filtering is limited
      if (lessonId && lid !== lessonId) continue

      const existing = byBlock.get(blockId)
      if (existing) {
        existing.submissions++
        if (isCorrect) existing.passes++
        existing.totalScore += score
        existing.totalMaxScore += maxScore
        if (timeSpentMs > 0) {
          existing.totalTimeMs += timeSpentMs
          existing.timeCount++
        }
      } else {
        byBlock.set(blockId, {
          blockId,
          blockType: bt,
          lessonId: lid,
          submissions: 1,
          passes: isCorrect ? 1 : 0,
          totalScore: score,
          totalMaxScore: maxScore,
          totalTimeMs: timeSpentMs > 0 ? timeSpentMs : 0,
          timeCount: timeSpentMs > 0 ? 1 : 0,
        })
      }
    }

    const activities = [...byBlock.values()]
      .map((b) => ({
        blockId: b.blockId,
        blockType: b.blockType,
        lessonId: b.lessonId,
        submissions: b.submissions,
        passRate: b.submissions > 0 ? Math.round((b.passes / b.submissions) * 100) : 0,
        averageScore: b.totalMaxScore > 0
          ? Math.round((b.totalScore / b.totalMaxScore) * 100)
          : 0,
        avgTimeToCompleteMs: b.timeCount > 0
          ? Math.round(b.totalTimeMs / b.timeCount)
          : null,
      }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, limit)

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('activity analytics failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
