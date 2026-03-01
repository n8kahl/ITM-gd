import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import { getCurrentAdminUserId, getSupabaseAdmin } from '@/app/api/admin/trade-review/_shared'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
})

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^\w.\-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180)
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
    const parsedBody = uploadSchema.parse(await request.json())
    const supabase = getSupabaseAdmin()
    const actorId = await getCurrentAdminUserId()
    if (!actorId) return errorResponse('Unauthorized', 401)

    const safeFileName = sanitizeFileName(parsedBody.fileName)
    const storagePath = `${parsedParams.id}/${Date.now()}-${safeFileName}`

    const { data: signedUpload, error: signedUploadError } = await supabase
      .storage
      .from('coach-review-screenshots')
      .createSignedUploadUrl(storagePath)

    if (signedUploadError || !signedUpload) {
      console.error('[TradeReview][Screenshots] Failed to create signed upload URL:', signedUploadError?.message)
      return errorResponse('Failed to create screenshot upload URL', 500)
    }

    const { data: note } = await supabase
      .from('coach_trade_notes')
      .select('screenshots,review_request_id')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    const nextScreenshots = Array.from(new Set([
      ...((note?.screenshots as string[] | null) ?? []),
      storagePath,
    ]))

    if (note) {
      const { error: updateNoteError } = await supabase
        .from('coach_trade_notes')
        .update({
          screenshots: nextScreenshots,
          coach_user_id: actorId,
        })
        .eq('journal_entry_id', parsedParams.id)

      if (updateNoteError) {
        console.error('[TradeReview][Screenshots] Failed to update note screenshots:', updateNoteError.message)
      }
    } else {
      const { error: insertNoteError } = await supabase
        .from('coach_trade_notes')
        .insert({
          journal_entry_id: parsedParams.id,
          coach_user_id: actorId,
          screenshots: nextScreenshots,
        })

      if (insertNoteError) {
        console.error('[TradeReview][Screenshots] Failed to create note for screenshots:', insertNoteError.message)
      }
    }

    const { error: logError } = await supabase
      .from('coach_review_activity_log')
      .insert({
        review_request_id: note?.review_request_id ?? null,
        journal_entry_id: parsedParams.id,
        actor_id: actorId,
        action: 'screenshot_added',
        details: { path: storagePath },
      })

    if (logError) {
      console.error('[TradeReview][Screenshots] Failed to write activity log:', logError.message)
    }

    return successResponse({
      path: signedUpload.path,
      token: signedUpload.token,
      signed_url: signedUpload.signedUrl,
      content_type: parsedBody.contentType,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const actorId = await getCurrentAdminUserId()
    if (!actorId) return errorResponse('Unauthorized', 401)
    const supabase = getSupabaseAdmin()

    const url = new URL(request.url)
    const path = url.searchParams.get('path')

    if (!path || !path.startsWith(`${parsedParams.id}/`)) {
      return errorResponse('Valid screenshot path is required', 400)
    }

    const { error: deleteStorageError } = await supabase
      .storage
      .from('coach-review-screenshots')
      .remove([path])

    if (deleteStorageError) {
      console.error('[TradeReview][Screenshots] Failed to delete screenshot object:', deleteStorageError.message)
      return errorResponse('Failed to delete screenshot', 500)
    }

    const { data: note } = await supabase
      .from('coach_trade_notes')
      .select('screenshots,review_request_id')
      .eq('journal_entry_id', parsedParams.id)
      .maybeSingle()

    if (note) {
      const nextScreenshots = ((note.screenshots as string[] | null) ?? []).filter((screenshotPath) => screenshotPath !== path)
      const { error: updateNoteError } = await supabase
        .from('coach_trade_notes')
        .update({
          screenshots: nextScreenshots,
          coach_user_id: actorId,
        })
        .eq('journal_entry_id', parsedParams.id)

      if (updateNoteError) {
        console.error('[TradeReview][Screenshots] Failed to update note after delete:', updateNoteError.message)
      }

      const { error: logError } = await supabase
        .from('coach_review_activity_log')
        .insert({
          review_request_id: note.review_request_id,
          journal_entry_id: parsedParams.id,
          actor_id: actorId,
          action: 'screenshot_removed',
          details: { path },
        })

      if (logError) {
        console.error('[TradeReview][Screenshots] Failed to write activity log:', logError.message)
      }
    }

    return successResponse({ removed: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }
    return errorResponse('Internal server error', 500)
  }
}
