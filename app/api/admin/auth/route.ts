import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request)
    const rateLimitResult = checkRateLimit(clientIp, RATE_LIMITS.adminLogin)

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      )
    }

    const { password } = await request.json()

    // Get admin password from environment variable
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set')
      return NextResponse.json(
        { error: 'Admin authentication not configured' },
        { status: 500 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        {
          error: 'Invalid password',
          remaining: rateLimitResult.remaining,
        },
        { status: 401 }
      )
    }

    // Set auth cookie (24 hours)
    const cookieStore = await cookies()
    cookieStore.set('titm_admin', 'true', {
      path: '/',
      maxAge: 86400, // 24 hours
      httpOnly: true, // Secure - not readable by JavaScript (verified by middleware)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin auth error:', error)
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
  }
}
