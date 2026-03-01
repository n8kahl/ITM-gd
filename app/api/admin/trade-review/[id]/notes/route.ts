import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { coachNoteUpdateSchema } from '@/lib/validation/coach-review'
import { getCurrentAdminUserId, getSupabaseAdmin } from '@/app/api/admin/trade-review/_shared'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

async function writeActivityLog(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  journalEntryId: string
  reviewRequestId: string | null
  actorId: string
  action: 'draft_saved' | 'edited'
}) {
  const { error } = await params.supabase
    .from('coach_review_activity_log')
    .insert({
      review_request_id: params.reviewRequestId,
      journal_entry_id: params.journalEntryId,
      actor_id: params.actorId,
      action: params.action,
      details: {},
    })

  if (error) {
    console.error('[TradeReview][Notes] Failed to write activity log:', error.message)
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('coach_trade_notes')
      .select('*')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    if (error) {
      console.error('[TradeReview][Notes] Failed to load note:', error.message)
      return errorResponse('Failed to load coach note', 500)
    }

    return successResponse(data ?? null)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const parsedBody = coachNoteUpdateSchema.parse(await request.json())
    const supabase = getSupabaseAdmin()
    const actorId = await getCurrentAdminUserId()
    if (!actorId) return errorResponse('Unauthorized', 401)

    const { data: existing } = await supabase
      .from('coach_trade_notes')
      .select('id')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    if (existing) {
      return errorResponse('Coach note already exists for this entry', 409)
    }

    const { data: latestRequest } = await supabase
      .from('coach_review_requests')
      .select('id')
      .eq('journal_entry_id', parsedParams.id)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('coach_trade_notes')
      .insert({
        journal_entry_id: parsedParams.id,
        review_request_id: latestRequest?.id ?? null,
        coach_user_id: actorId,
        coach_response: parsedBody.coach_response ?? null,
        internal_notes: parsedBody.internal_notes ?? null,
      })
      .select('*')
      .single()

    if (error || !data) {
      console.error('[TradeReview][Notes] Failed to create note:', error?.message)
      return errorResponse('Failed to create coach note', 500)
    }

    await writeActivityLog({
      supabase,
      journalEntryId: parsedParams.id,
      reviewRequestId: data.review_request_id,
      actorId,
      action: 'draft_saved',
    })

    return successResponse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const parsedBody = coachNoteUpdateSchema.parse(await request.json())
    const supabase = getSupabaseAdmin()
    const actorId = await getCurrentAdminUserId()
    if (!actorId) return errorResponse('Unauthorized', 401)

    const { data: existingNote, error: existingError } = await supabase
      .from('coach_trade_notes')
      .select('*')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    if (existingError) {
      console.error('[TradeReview][Notes] Failed to load existing note:', existingError.message)
      return errorResponse('Failed to load existing note', 500)
    }

    if (!existingNote) {
      return errorResponse('Coach note not found for this entry', 404)
    }

    const mergedCoachResponse = parsedBody.coach_response
      ? {
          ...(existingNote.coach_response as Record<string, unknown> | null ?? {}),
          ...parsedBody.coach_response,
        }
      : existingNote.coach_response

    const payload: Record<string, unknown> = {
      coach_response: mergedCoachResponse,
      coach_user_id: actorId,
    }

    if (Object.prototype.hasOwnProperty.call(parsedBody, 'internal_notes')) {
      payload.internal_notes = parsedBody.internal_notes
    }

    const { data: updatedNote, error: updateError } = await supabase
      .from('coach_trade_notes')
      .update(payload)
      .eq('journal_entry_id', parsedParams.id)
      .select('*')
      .single()

    if (updateError || !updatedNote) {
      console.error('[TradeReview][Notes] Failed to update note:', updateError?.message)
      return errorResponse('Failed to update coach note', 500)
    }

    await writeActivityLog({
      supabase,
      journalEntryId: parsedParams.id,
      reviewRequestId: updatedNote.review_request_id,
      actorId,
      action: 'edited',
    })

    return successResponse(updatedNote)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}
