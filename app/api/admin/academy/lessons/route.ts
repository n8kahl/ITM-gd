import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { listLessonsByStatusRequestSchema } from '@/lib/academy-v3/contracts/api'
import { AcademyContentWorkflowService } from '@/lib/academy-v3/services/content-workflow-service'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { searchParams } = request.nextUrl
    const parsed = listLessonsByStatusRequestSchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      moduleId: searchParams.get('moduleId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    if (!parsed.success) {
      return errorResponse('Invalid query parameters', 400, parsed.error.flatten())
    }

    const supabase = getSupabaseAdmin()
    const service = new AcademyContentWorkflowService(supabase)
    const result = await service.listLessons(parsed.data)

    return successResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return errorResponse(message, 500)
  }
}
