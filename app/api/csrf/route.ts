import { NextResponse } from 'next/server'
import { getCsrfToken } from '@/lib/csrf'

/**
 * GET /api/csrf - Get a CSRF token for the current session
 * Frontend should call this and include the token in X-CSRF-Token header for POST/PUT/DELETE
 */
export async function GET() {
  try {
    const token = await getCsrfToken()
    return NextResponse.json({ token })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
}
