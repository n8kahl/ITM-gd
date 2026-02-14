import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sanitizeString, screenshotUploadSchema } from '@/lib/validation/journal-entry'

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

function sanitizeFileName(fileName: string): string {
  return sanitizeString(fileName, 255).replace(/[^a-zA-Z0-9._-]/g, '_')
}

const screenshotReadUrlSchema = z.object({
  storagePath: z.string().min(1).max(512),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const body = await request.json() as unknown

    const readRequest = screenshotReadUrlSchema.safeParse(body)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase service role environment variables')
      return errorResponse('Server configuration error', 500)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Read path: return a signed URL for an existing screenshot object.
    if (readRequest.success) {
      const storagePath = readRequest.data.storagePath.trim().replace(/^\/+/, '')

      if (storagePath.includes('..')) {
        return errorResponse('Invalid storage path', 400)
      }

      if (!storagePath.startsWith(`${user.id}/`)) {
        return errorResponse('Forbidden storage path', 403)
      }

      const { data, error } = await admin
        .storage
        .from('journal-screenshots')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 30)

      if (error || !data) {
        console.error('Failed to create signed read URL:', error)
        return errorResponse('Failed to create signed URL', 500)
      }

      return successResponse({
        signedUrl: data.signedUrl,
        storagePath,
      })
    }

    // Upload path: return a signed upload URL and storage destination.
    const validated = screenshotUploadSchema.parse(body)

    const sanitizedFileName = sanitizeFileName(validated.fileName)
    const extension = sanitizedFileName.split('.').pop()?.toLowerCase() ?? ''
    const expectedExtension = CONTENT_TYPE_TO_EXTENSION[validated.contentType]

    const extensionMatches = (
      extension === expectedExtension
      || (validated.contentType === 'image/jpeg' && extension === 'jpeg')
    )

    if (!extensionMatches) {
      return errorResponse('File extension does not match content type', 400)
    }

    const storagePath = `${user.id}/${crypto.randomUUID()}/${sanitizedFileName}`

    if (storagePath.includes('..')) {
      return errorResponse('Invalid storage path', 400)
    }

    const { data, error } = await admin
      .storage
      .from('journal-screenshots')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('Failed to create signed upload URL:', error)
      return errorResponse('Failed to create upload URL', 500)
    }

    return successResponse({
      uploadUrl: data.signedUrl,
      storagePath,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('Screenshot URL route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
