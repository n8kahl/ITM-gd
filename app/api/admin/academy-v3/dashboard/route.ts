import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/admin/academy-v3/dashboard
 *
 * Returns content overview stats and health indicators for the academy admin dashboard.
 */
export async function GET() {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - admin access required' },
        { status: 401 }
      )
    }

    const supabase = getSupabaseAdmin()

    const [
      tracksResult,
      modulesResult,
      lessonsResult,
      blocksResult,
      assessmentsResult,
      enrollmentsResult,
      recentEventsResult,
    ] = await Promise.all([
      supabase
        .from('academy_tracks')
        .select('id, title, is_active'),
      supabase
        .from('academy_modules')
        .select('id, title, slug, track_id, is_published, metadata, cover_image_url'),
      supabase
        .from('academy_lessons')
        .select('id, title, module_id, is_published, status, hero_image_url, estimated_minutes'),
      supabase
        .from('academy_lesson_blocks')
        .select('id, lesson_id, block_type'),
      supabase
        .from('academy_assessments')
        .select('id, module_id, lesson_id'),
      supabase
        .from('academy_user_enrollments')
        .select('id, status'),
      supabase
        .from('academy_learning_events')
        .select('id, user_id, event_type, payload, occurred_at')
        .order('occurred_at', { ascending: false })
        .limit(20),
    ])

    const tracks = tracksResult.data ?? []
    const modules = modulesResult.data ?? []
    const lessons = lessonsResult.data ?? []
    const blocks = blocksResult.data ?? []
    const assessments = assessmentsResult.data ?? []
    const enrollments = enrollmentsResult.data ?? []
    const recentEvents = recentEventsResult.data ?? []

    // Content overview
    const publishedModules = modules.filter(m => m.is_published)
    const draftModules = modules.filter(m => !m.is_published)
    const publishedLessons = lessons.filter(l => l.is_published)
    const draftLessons = lessons.filter(l => !l.is_published)

    // Health indicators
    const lessonsWithoutAssessments = lessons
      .filter(l => l.is_published && !assessments.some(a => a.lesson_id === l.id))
      .map(l => ({ id: l.id, title: l.title }))

    const modulesWithoutCovers = modules
      .filter(m => m.is_published && !m.cover_image_url && !m.metadata?.thumbnail_url)
      .map(m => ({ id: m.id, title: m.title, slug: m.slug }))

    const lessonsWithoutHeroImages = lessons
      .filter(l => l.is_published && !l.hero_image_url)
      .map(l => ({ id: l.id, title: l.title }))

    // Lessons with zero blocks (empty content)
    const lessonIdsWithBlocks = new Set(blocks.map(b => b.lesson_id))
    const emptyLessons = lessons
      .filter(l => !lessonIdsWithBlocks.has(l.id))
      .map(l => ({ id: l.id, title: l.title }))

    // Orphaned blocks (blocks referencing non-existent lessons)
    const lessonIds = new Set(lessons.map(l => l.id))
    const orphanedBlockCount = blocks.filter(b => !lessonIds.has(b.lesson_id)).length

    // Active enrollments
    const activeEnrollments = enrollments.filter(e => e.status === 'active').length
    const completedEnrollments = enrollments.filter(e => e.status === 'completed').length

    // Total estimated curriculum time
    const totalMinutes = lessons.reduce((sum, l) => sum + (l.estimated_minutes || 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          tracks: { total: tracks.length, active: tracks.filter(t => t.is_active).length },
          modules: { total: modules.length, published: publishedModules.length, draft: draftModules.length },
          lessons: { total: lessons.length, published: publishedLessons.length, draft: draftLessons.length },
          blocks: { total: blocks.length },
          assessments: { total: assessments.length },
          enrollments: { total: enrollments.length, active: activeEnrollments, completed: completedEnrollments },
          totalCurriculumMinutes: totalMinutes,
        },
        health: {
          lessonsWithoutAssessments: lessonsWithoutAssessments.slice(0, 10),
          lessonsWithoutAssessmentsCount: lessonsWithoutAssessments.length,
          modulesWithoutCovers: modulesWithoutCovers.slice(0, 10),
          modulesWithoutCoversCount: modulesWithoutCovers.length,
          lessonsWithoutHeroImages: lessonsWithoutHeroImages.slice(0, 10),
          lessonsWithoutHeroImagesCount: lessonsWithoutHeroImages.length,
          emptyLessons: emptyLessons.slice(0, 10),
          emptyLessonsCount: emptyLessons.length,
          orphanedBlockCount,
        },
        recentActivity: recentEvents.map(e => ({
          id: e.id,
          userId: e.user_id,
          eventType: e.event_type,
          payload: e.payload,
          occurredAt: e.occurred_at,
        })),
      },
    })
  } catch (error) {
    console.error('[academy-admin-dashboard] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
