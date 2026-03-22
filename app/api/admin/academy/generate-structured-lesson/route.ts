import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { isAdminUser, getServerUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { AiContentGeneratorService, AiContentGeneratorError } from '@/lib/academy-v3/services'
import { academyDifficultySchema } from '@/lib/academy-v3/contracts/domain'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const generateRequestSchema = z.object({
  topic: z.string().min(1),
  difficulty: academyDifficultySchema.default('beginner'),
  estimatedMinutes: z.number().int().min(5).max(120).default(15),
  keyTopics: z.array(z.string()).optional(),
  moduleTitle: z.string().optional(),
  moduleId: z.string().uuid().optional(),
  persist: z.boolean().default(false),
})

/**
 * POST /api/admin/academy/generate-structured-lesson
 * Generate a structured lesson with blocks using AI.
 * Set persist: true and provide moduleId to save to DB in draft status.
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = generateRequestSchema.parse(body)

    const supabaseAdmin = getSupabaseAdmin()
    const service = new AiContentGeneratorService(supabaseAdmin)

    const generated = await service.generateLesson({
      topic: parsed.topic,
      difficulty: parsed.difficulty,
      estimatedMinutes: parsed.estimatedMinutes,
      keyTopics: parsed.keyTopics,
      moduleTitle: parsed.moduleTitle,
    })

    if (!parsed.persist) {
      return NextResponse.json({ success: true, data: generated })
    }

    if (!parsed.moduleId) {
      return NextResponse.json(
        { success: false, error: 'moduleId is required when persist is true' },
        { status: 400 }
      )
    }

    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Verify module exists
    const { data: moduleRow, error: modError } = await supabaseAdmin
      .from('academy_modules')
      .select('id, title')
      .eq('id', parsed.moduleId)
      .maybeSingle()

    if (modError || !moduleRow) {
      return NextResponse.json(
        { success: false, error: 'Module not found' },
        { status: 404 }
      )
    }

    const persisted = await service.persistLesson({
      moduleId: parsed.moduleId,
      userId: user.id,
      lesson: generated,
    })

    return NextResponse.json({
      success: true,
      data: { ...generated, persisted },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof AiContentGeneratorError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 })
    }
    console.error('generate-structured-lesson POST failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
