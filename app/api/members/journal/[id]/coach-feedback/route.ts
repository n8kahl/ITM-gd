import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import type { CoachResponsePayload, CoachReviewStatus } from '@/lib/types/coach-review'

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24

const paramsSchema = z.object({
  id: z.string().uuid(),
})

function isMissingRelation(error: { code?: string; message?: string } | null, relation: string): boolean {
  if (!error) return false
  const code = String(error.code ?? '').toUpperCase()
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST116') {
    return true
  }
  const message = String(error.message ?? '').toLowerCase()
  return message.includes(relation.toLowerCase()) && message.includes('does not exist')
}

async function signCoachScreenshotPaths(paths: string[], supabase: SupabaseClient) {
  if (paths.length === 0) return [] as string[]

  const bucket = supabase.storage.from('coach-review-screenshots')
  const dedupedPaths = Array.from(new Set(paths.filter((path) => typeof path === 'string' && path.length > 0)))
  const signedByPath = new Map<string, string>()

  const createSignedUrlsMaybe = (
    bucket as unknown as {
      createSignedUrls?: (inputPaths: string[], expiresIn: number) => Promise<{
        data?: Array<{ path?: string | null; signedUrl?: string | null }> | null
        error?: { message?: string } | null
      }>
    }
  ).createSignedUrls

  if (typeof createSignedUrlsMaybe === 'function') {
    const { data, error } = await createSignedUrlsMaybe.call(bucket, dedupedPaths, SIGNED_URL_TTL_SECONDS)
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row?.path && row.signedUrl) {
          signedByPath.set(row.path, row.signedUrl)
        }
      }
    }
  }

  if (signedByPath.size === 0) {
    const signedEntries = await Promise.all(dedupedPaths.map(async (path) => {
      const { data, error } = await bucket.createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      return [path, !error && data?.signedUrl ? data.signedUrl : null] as const
    }))

    for (const [path, signedUrl] of signedEntries) {
      if (signedUrl) signedByPath.set(path, signedUrl)
    }
  }

  return dedupedPaths
    .map((path) => signedByPath.get(path) ?? null)
    .filter((url): url is string => Boolean(url))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedUserFromRequest(request)
  if (!auth) return errorResponse('Unauthorized', 401)

  try {
    const parsedParams = paramsSchema.parse(await params)

    const { data: entry, error: entryError } = await auth.supabase
      .from('journal_entries')
      .select('id,coach_review_status')
      .eq('id', parsedParams.id)
      .eq('user_id', auth.user.id)
      .maybeSingle()

    if (entryError) {
      console.error('[CoachReview] Failed to load journal entry for feedback:', entryError.message)
      return errorResponse('Failed to load journal entry', 500)
    }

    if (!entry) {
      return errorResponse('Trade entry not found', 404)
    }

    const coachNoteQuery = await auth.supabase
      .from('coach_trade_notes')
      .select('coach_response,screenshots,published_at')
      .eq('journal_entry_id', parsedParams.id)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (coachNoteQuery.error && !isMissingRelation(coachNoteQuery.error, 'coach_trade_notes')) {
      console.error('[CoachReview] Failed to load coach note:', coachNoteQuery.error.message)
      return errorResponse('Failed to load coach feedback', 500)
    }

    const coachNote = coachNoteQuery.data
    const rawScreenshotPaths = Array.isArray(coachNote?.screenshots)
      ? coachNote.screenshots.filter((path): path is string => typeof path === 'string')
      : []
    const screenshotUrls = await signCoachScreenshotPaths(rawScreenshotPaths, auth.supabase)

    let reviewStatus: CoachReviewStatus | null = (entry.coach_review_status as CoachReviewStatus | null) ?? null

    if (!reviewStatus) {
      const latestRequestQuery = await auth.supabase
        .from('coach_review_requests')
        .select('status')
        .eq('journal_entry_id', parsedParams.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestRequestQuery.error && latestRequestQuery.data?.status) {
        reviewStatus = latestRequestQuery.data.status as CoachReviewStatus
      }
    }

    return successResponse({
      coach_response: (coachNote?.coach_response as CoachResponsePayload | null) ?? null,
      coach_screenshots: screenshotUrls,
      published_at: coachNote?.published_at ?? null,
      review_status: reviewStatus,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('[CoachReview] coach-feedback route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
