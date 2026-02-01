import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()

  // Delete the admin cookie by setting it to expire immediately
  cookieStore.set('titm_admin', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  return NextResponse.json({ success: true })
}

// Also support GET for simple redirects
export async function GET() {
  const cookieStore = await cookies()

  cookieStore.set('titm_admin', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  // Use request URL origin in production, never localhost
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'
  return NextResponse.redirect(new URL('/', origin))
}
