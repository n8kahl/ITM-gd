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

    const { data: activeRequest, error: activeRequestError } = await supabase
      .from('coach_review_requests')
      .select('id')
      .eq('journal_entry_id', parsedParams.id)
      .in('status', ['pending', 'in_review'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeRequestError) {
      console.error('[TradeReview][Dismiss] Failed to load active request:', activeRequestError.message)
      return errorResponse('Failed to load active review request', 500)
    }

    const nowIso = new Date().toISOString()

    if (activeRequest) {
      const { error: dismissError } = await supabase
        .from('coach_review_requests')
        .update({
          status: 'dismissed',
          completed_at: nowIso,
        })
        .eq('id', activeRequest.id)

      if (dismissError) {
        console.error('[TradeReview][Dismiss] Failed to dismiss request:', dismissError.message)
        return errorResponse('Failed to dismiss review request', 500)
      }
    }

    const { error: journalUpdateError } = await supabase
      .from('journal_entries')
      .update({
        coach_review_status: null,
      })
      .eq('id', parsedParams.id)

    if (journalUpdateError) {
      console.error('[TradeReview][Dismiss] Failed to update journal status:', journalUpdateError.message)
      return errorResponse('Failed to update journal status', 500)
    }

    const { error: logError } = await supabase
      .from('coach_review_activity_log')
      .insert({
        review_request_id: activeRequest?.id ?? null,
        journal_entry_id: parsedParams.id,
        actor_id: actorId,
        action: 'dismissed',
        details: {
          dismissed_at: nowIso,
        },
      })

    if (logError) {
      console.error('[TradeReview][Dismiss] Failed to write activity log:', logError.message)
    }

    return successResponse({ dismissed: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}
