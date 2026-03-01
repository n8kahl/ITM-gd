import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { getCurrentAdminUserId, getSupabaseAdmin } from '@/app/api/admin/trade-review/_shared'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const supabase = getSupabaseAdmin()
    const actorId = await getCurrentAdminUserId()
    if (!actorId) return errorResponse('Unauthorized', 401)

    const { data: note, error: noteError } = await supabase
      .from('coach_trade_notes')
      .select('id,review_request_id')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    if (noteError) {
      console.error('[TradeReview][Publish] Failed to load note:', noteError.message)
      return errorResponse('Failed to load coach note', 500)
    }

    const nowIso = new Date().toISOString()
    let resolvedRequestId = (note?.review_request_id as string | null) ?? null

    if (!resolvedRequestId) {
      const { data: latestRequest } = await supabase
        .from('coach_review_requests')
        .select('id')
        .eq('journal_entry_id', parsedParams.id)
        .in('status', ['pending', 'in_review'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      resolvedRequestId = latestRequest?.id ?? null
    }

    if (note) {
      const { error: publishNoteError } = await supabase
        .from('coach_trade_notes')
        .update({
          is_published: true,
          published_at: nowIso,
        })
        .eq('id', note.id)

      if (publishNoteError) {
        console.error('[TradeReview][Publish] Failed to publish coach note:', publishNoteError.message)
        return errorResponse('Failed to publish coach note', 500)
      }
    } else {
      const { error: createPublishedNoteError } = await supabase
        .from('coach_trade_notes')
        .insert({
          journal_entry_id: parsedParams.id,
          review_request_id: resolvedRequestId,
          coach_user_id: actorId,
          is_published: true,
          published_at: nowIso,
        })

      if (createPublishedNoteError) {
        console.error('[TradeReview][Publish] Failed to create published coach note:', createPublishedNoteError.message)
        return errorResponse('Failed to publish coach note', 500)
      }
    }

    if (resolvedRequestId) {
      const { error: requestUpdateError } = await supabase
        .from('coach_review_requests')
        .update({
          status: 'completed',
          completed_at: nowIso,
        })
        .eq('id', resolvedRequestId)

      if (requestUpdateError) {
        console.error('[TradeReview][Publish] Failed to update request status:', requestUpdateError.message)
      }
    }

    const { error: journalUpdateError } = await supabase
      .from('journal_entries')
      .update({
        coach_review_status: 'completed',
      })
      .eq('id', parsedParams.id)

    if (journalUpdateError) {
      console.error('[TradeReview][Publish] Failed to update journal entry status:', journalUpdateError.message)
      return errorResponse('Failed to update journal status', 500)
    }

    const { error: logError } = await supabase
      .from('coach_review_activity_log')
      .insert({
        review_request_id: resolvedRequestId,
        journal_entry_id: parsedParams.id,
        actor_id: actorId,
        action: 'published',
        details: {
          published_at: nowIso,
        },
      })

    if (logError) {
      console.error('[TradeReview][Publish] Failed to write activity log:', logError.message)
    }

    return successResponse({ published: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}
