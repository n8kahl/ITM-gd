import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'journal-screenshots'
// Signed URLs last 7 days — entries persist, so regenerate on access
const SIGNED_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60

/**
 * POST /api/members/journal/screenshot-url
 * Generates a signed URL for a private screenshot in Supabase Storage.
 *
 * Body: { storagePath: string }
 *
 * Security:
 * - Requires authenticated user
 * - Storage path must start with the user's own ID (no cross-user access)
 * - Uses service role to sign (anon key cannot sign private bucket objects)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication via session cookies
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { storagePath } = body

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json(
        { error: 'storagePath is required' },
        { status: 400 },
      )
    }

    // Security: ensure the path belongs to the requesting user
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: 'Access denied: path does not belong to this user' },
        { status: 403 },
      )
    }

    // Use service role client to generate signed URL (anon key lacks permission on private buckets)
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 },
      )
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    const { data, error } = await adminSupabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

    if (error) {
      console.error('Signed URL generation error:', error)
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 },
      )
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (error) {
    console.error('Screenshot URL API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
