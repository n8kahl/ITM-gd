import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Use service role key for server-side token verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const redirect = request.nextUrl.searchParams.get('redirect') || '/admin'
  const conversationId = request.nextUrl.searchParams.get('id')

  if (!token) {
    return NextResponse.redirect(new URL('/admin/login?error=missing_token', request.url))
  }

  try {
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
      return NextResponse.redirect(new URL('/admin/login?error=invalid_token', request.url))
    }

    // Set httpOnly auth cookie (24 hours)
    const cookieStore = await cookies()
    cookieStore.set('titm_admin', 'true', {
      path: '/',
      maxAge: 86400, // 24 hours
      httpOnly: true, // Now secure - not readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    // Build redirect URL
    let redirectUrl = new URL(redirect, request.url)
    if (conversationId) {
      redirectUrl.searchParams.set('id', conversationId)
    }

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.redirect(new URL('/admin/login?error=verification_failed', request.url))
  }
}
