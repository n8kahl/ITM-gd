import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function resolveBackendBaseUrl(request: Request): string {
  const configured =
    process.env.AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    'http://localhost:3001'

  const host = (() => {
    try {
      return new URL(request.url).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()

  const isLocalHost = host === 'localhost' || host === '127.0.0.1'
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'
  if (isLocalHost && preferLocalInDev && /railway\.app/i.test(configured)) {
    return 'http://localhost:3001'
  }

  return configured.replace(/\/+$/, '')
}

async function resolveAuthHeaders(request: Request): Promise<{ primary?: string; fallback?: string }> {
  let incomingAuthHeader: string | undefined
  let sessionAuthHeader: string | undefined

  const incomingAuth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (incomingAuth && /^bearer\s+/i.test(incomingAuth)) {
    incomingAuthHeader = incomingAuth
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.access_token) {
      sessionAuthHeader = `Bearer ${session.access_token}`
    }
  } catch {
    // Keep the proxy public if no session is available.
  }

  return {
    primary: incomingAuthHeader || sessionAuthHeader,
    fallback:
      incomingAuthHeader && sessionAuthHeader && incomingAuthHeader !== sessionAuthHeader
        ? sessionAuthHeader
        : undefined,
  }
}

async function fetchUpstreamWithRetry(upstream: string, authHeaders: { primary?: string; fallback?: string }) {
  const runFetch = (authHeader?: string) =>
    fetch(upstream, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

  let response = await runFetch(authHeaders.primary)
  if (response.status === 401 && authHeaders.fallback) {
    response = await runFetch(authHeaders.fallback)
  }

  return response
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol } = await ctx.params
    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
    }

    const url = new URL(request.url)
    const backendBase = resolveBackendBaseUrl(request)
    const upstream = `${backendBase}/api/chart/${encodeURIComponent(symbol)}${url.search}`

    const authHeaders = await resolveAuthHeaders(request)
    const response = await fetchUpstreamWithRetry(upstream, authHeaders)
    const payload = await response.text()

    if (!response.ok) {
      return new NextResponse(
        payload || JSON.stringify({ message: 'Failed to fetch chart data.' }),
        {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
          },
        },
      )
    }

    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'proxy_error', message: 'Failed to fetch chart data.' },
      { status: 502 },
    )
  }
}
