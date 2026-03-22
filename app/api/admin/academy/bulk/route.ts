import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { logAdminActivity } from '@/lib/admin/audit-log'
import { BulkContentService } from '@/lib/academy-v3/services/bulk-content-service'
import { bulkImportPayloadSchema } from '@/lib/academy-v3/contracts/api'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/admin/academy/bulk
 * Exports the entire curriculum (programs → tracks → modules → lessons → blocks) as JSON.
 */
export async function GET() {
  try {
    if (!await isAdminUser()) {
      return errorResponse('Unauthorized - admin access required', 401)
    }

    const supabase = getSupabaseAdmin()
    const service = new BulkContentService(supabase)
    const payload = await service.exportCurriculum()

    await logAdminActivity({
      action: 'curriculum_exported',
      targetType: 'curriculum',
      details: { trackCount: payload.tracks.length },
    })

    return successResponse(payload)
  } catch (err) {
    console.error('bulk export failed', err)
    const message = err instanceof Error ? err.message : 'Export failed'
    return errorResponse(message, 500)
  }
}

/**
 * POST /api/admin/academy/bulk
 * Imports lessons and blocks from JSON payload, upserting by slug within a target module.
 * All imported lessons are created with status='draft'.
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return errorResponse('Unauthorized - admin access required', 401)
    }

    const body: unknown = await request.json()
    const parsed = bulkImportPayloadSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('Invalid import payload', 400, parsed.error.issues)
    }

    const supabase = getSupabaseAdmin()
    const service = new BulkContentService(supabase)
    const result = await service.importLessons(parsed.data)

    await logAdminActivity({
      action: 'curriculum_imported',
      targetType: 'curriculum',
      details: {
        moduleSlug: parsed.data.moduleSlug,
        lessonsCreated: result.lessonsCreated,
        lessonsUpdated: result.lessonsUpdated,
        blocksWritten: result.blocksWritten,
      },
    })

    return successResponse(result)
  } catch (err) {
    console.error('bulk import failed', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return errorResponse(message, 500)
  }
}
