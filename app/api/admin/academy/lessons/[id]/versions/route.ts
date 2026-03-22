import { createClient } from '@supabase/supabase-js'

import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { AcademyVersioningService } from '@/lib/academy-v3/services/versioning-service'
import { AcademyLessonNotFoundError } from '@/lib/academy-v3/services/errors'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminUser())) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { id } = await params
    const supabase = getSupabaseAdmin()
    const service = new AcademyVersioningService(supabase)
    const versions = await service.listVersionHistory(id)

    return successResponse({ versions })
  } catch (err) {
    if (err instanceof AcademyLessonNotFoundError) {
      return errorResponse('Lesson not found', 404)
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
