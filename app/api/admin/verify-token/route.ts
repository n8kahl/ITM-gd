import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

/**
 * Magic Link Token Verification Route
 *
 * This route verifies magic link tokens for backup admin access.
 * Tokens are generated and stored in admin_access_tokens table,
 * typically sent via Discord webhook notifications.
 */

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(url, serviceKey)
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const redirect = request.nextUrl.searchParams.get('redirect') || '/admin'
  const conversationId = request.nextUrl.searchParams.get('id')
  const highlight = request.nextUrl.searchParams.get('highlight')

  if (!token) {
    // Redirect to main login with error
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url))
  }

  try {
    const supabase = getSupabaseClient()

    // Atomic operation: verify AND mark as used in single query
    // This prevents race condition where token could be used twice
    const { data: tokenData, error } = await supabase
      .from('admin_access_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select()
      .single()

    if (error || !tokenData) {
      console.error('Token verification failed:', error?.message || 'Token not found or expired')
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
    }

    // Set httpOnly auth cookie (24 hours)
    const cookieStore = await cookies()
    cookieStore.set('titm_admin', 'true', {
      path: '/',
      maxAge: 86400, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    // Build redirect URL with preserved query params
    const redirectUrl = new URL(redirect, request.url)
    if (conversationId) {
      redirectUrl.searchParams.set('id', conversationId)
    }
    if (highlight) {
      redirectUrl.searchParams.set('highlight', highlight)
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url))
  }
}
