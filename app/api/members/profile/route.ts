import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { successResponse, errorResponse } from '@/lib/api/response'
import { memberProfileUpdateSchema } from '@/lib/validation/social'
import { sanitizeContent } from '@/lib/sanitize'
import type { MemberProfile } from '@/lib/types/social'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    // Try to fetch existing profile
    const { data: profile, error: fetchError } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // No row found — create with defaults
      const { data: newProfile, error: insertError } = await supabase
        .from('member_profiles')
        .insert({ user_id: user.id })
        .select('*')
        .single()

      if (insertError) {
        return errorResponse(insertError.message, 500)
      }

      return successResponse<MemberProfile>(newProfile)
    }

    if (fetchError) {
      return errorResponse(fetchError.message, 500)
    }

    return successResponse<MemberProfile>(profile)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const body = await request.json()
    const parsed = memberProfileUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return errorResponse('Invalid request body', 400, parsed.error.flatten())
    }

    const updateData = { ...parsed.data }

    // Sanitize string fields
    if (updateData.display_name) {
      updateData.display_name = sanitizeContent(updateData.display_name)
    }
    if (updateData.bio) {
      updateData.bio = sanitizeContent(updateData.bio)
    }
    if (updateData.tagline) {
      updateData.tagline = sanitizeContent(updateData.tagline)
    }

    const { data: profile, error: updateError } = await supabase
      .from('member_profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (updateError) {
      // If no row to update, create one first then update
      if (updateError.code === 'PGRST116') {
        await supabase
          .from('member_profiles')
          .insert({ user_id: user.id })

        const { data: updatedProfile, error: retryError } = await supabase
          .from('member_profiles')
          .update(updateData)
          .eq('user_id', user.id)
          .select('*')
          .single()

        if (retryError) {
          return errorResponse(retryError.message, 500)
        }

        return successResponse<MemberProfile>(updatedProfile)
      }

      return errorResponse(updateError.message, 500)
    }

    return successResponse<MemberProfile>(profile)
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
