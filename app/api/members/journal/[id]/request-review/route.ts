import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { requestReviewSchema } from '@/lib/validation/coach-review'
import type { CoachReviewRequest } from '@/lib/types/coach-review'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function hasCoachReviewPermission(
  userSupabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await userSupabase.rpc('user_has_permission', {
    target_user_id: userId,
    permission_name: 'flag_for_coach_review',
  })

  if (!error && typeof data === 'boolean') {
    return data
  }

  const fallback = await userSupabase
    .from('user_permissions')
    .select('app_permissions(name)')
    .eq('user_id', userId)

  if (fallback.error) {
    return false
  }

  return (fallback.data ?? []).some((row) => {
    const permission = (row as { app_permissions?: { name?: string } | null }).app_permissions
    return permission?.name === 'flag_for_coach_review'
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedUserFromRequest(request)
  if (!auth) return errorResponse('Unauthorized', 401)

  try {
    const parsedParams = paramsSchema.parse(await params)
    const parsedBody = requestReviewSchema.parse(await request.json().catch(() => ({})))

    const permitted = await hasCoachReviewPermission(auth.supabase, auth.user.id)
    if (!permitted) {
      return errorResponse('You do not have permission to request coach review', 403)
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { data: entry, error: entryError } = await supabaseAdmin
      .from('journal_entries')
      .select('id,user_id,is_draft')
      .eq('id', parsedParams.id)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (entryError) {
      console.error('[CoachReview] Failed to load journal entry:', entryError.message)
      return errorResponse('Failed to load journal entry', 500)
    }

    if (!entry) {
      return errorResponse('Trade entry not found', 404)
    }

    if (entry.is_draft === true) {
      return errorResponse('Draft entries cannot be submitted for coach review', 400)
    }

    const { data: existingRequest, error: existingRequestError } = await supabaseAdmin
      .from('coach_review_requests')
      .select('id,status')
      .eq('journal_entry_id', parsedParams.id)
      .in('status', ['pending', 'in_review'])
      .maybeSingle()

    if (existingRequestError) {
      console.error('[CoachReview] Failed to check active review request:', existingRequestError.message)
      return errorResponse('Failed to check existing review requests', 500)
    }

    if (existingRequest) {
      return errorResponse('A review request already exists for this trade', 409)
    }

    const requestedAt = new Date().toISOString()

    const { data: insertedRequest, error: insertError } = await supabaseAdmin
      .from('coach_review_requests')
      .insert({
        journal_entry_id: parsedParams.id,
        user_id: auth.user.id,
        status: 'pending',
        priority: parsedBody.priority,
        requested_at: requestedAt,
      })
      .select('*')
      .single()

    if (insertError || !insertedRequest) {
      if (insertError?.code === '23505') {
        return errorResponse('A review request already exists for this trade', 409)
      }
      console.error('[CoachReview] Failed to insert review request:', insertError?.message)
      return errorResponse('Failed to create review request', 500)
    }

    const { error: journalUpdateError } = await supabaseAdmin
      .from('journal_entries')
      .update({
        coach_review_status: 'pending',
        coach_review_requested_at: requestedAt,
      })
      .eq('id', parsedParams.id)
      .eq('user_id', auth.user.id)

    if (journalUpdateError) {
      console.error('[CoachReview] Failed to update journal coach status:', journalUpdateError.message)
      return errorResponse('Failed to update journal review status', 500)
    }

    const { error: logError } = await supabaseAdmin
      .from('coach_review_activity_log')
      .insert({
        review_request_id: insertedRequest.id,
        journal_entry_id: parsedParams.id,
        actor_id: auth.user.id,
        action: 'requested',
        details: {
          priority: parsedBody.priority,
          requested_at: requestedAt,
        },
      })

    if (logError) {
      console.error('[CoachReview] Failed to write activity log row:', logError.message)
    }

    return successResponse(insertedRequest as CoachReviewRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('[CoachReview] request-review route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
