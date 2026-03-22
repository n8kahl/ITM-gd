import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { isAdminUser } from '@/lib/supabase-server'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'
import { BulkContentService, BulkContentError } from '@/lib/academy-v3/services'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/admin/academy/bulk-content?programCode=<code>
 * Export curriculum as JSON. Optional programCode filter.
 */
export async function GET(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const programCode = url.searchParams.get('programCode') ?? undefined

    const service = new BulkContentService(getSupabaseAdmin())
    const curriculum = await service.exportCurriculum(programCode)

    return NextResponse.json({ success: true, data: curriculum })
  } catch (error) {
    if (error instanceof BulkContentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 })
    }
    console.error('bulk-content GET failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/academy/bulk-content
 * Import curriculum from JSON payload. Validates with Zod before writing.
 * Body: BulkCurriculum JSON
 */
export async function POST(request: NextRequest) {
  try {
    if (!await isAdminUser()) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const service = new BulkContentService(getSupabaseAdmin())
    const result = await service.importCurriculum(body)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid curriculum format', details: error.errors },
        { status: 400 }
      )
    }
    if (error instanceof BulkContentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 422 })
    }
    console.error('bulk-content POST failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
