import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function resolveBackendBaseUrl(request: Request): string {
  const configured = (
    process.env.AI_COACH_API_URL ||
    process.env.NEXT_PUBLIC_AI_COACH_API_URL ||
    'http://localhost:3001'
  ).replace(/\/+$/, '')

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

  return configured
}

type HandlerContext = {
  params: Promise<{
    path: string[]
  }>
}

async function proxy(request: Request, ctx: HandlerContext): Promise<Response> {
  const { path } = await ctx.params
  const segments = Array.isArray(path) ? path : []
  if (segments.length === 0) {
    return NextResponse.json({ error: 'Not found', message: 'Missing SPX endpoint path' }, { status: 404 })
  }

  try {
    const url = new URL(request.url)
    const backendBase = resolveBackendBaseUrl(request)
    const upstream = `${backendBase}/api/spx/${segments.join('/')}${url.search}`

    let authHeader: string | undefined
    const incomingAuth = request.headers.get('authorization') || request.headers.get('Authorization')

    if (incomingAuth && /^bearer\s+/i.test(incomingAuth)) {
      authHeader = incomingAuth
    }

    if (!authHeader) {
      try {
        const supabase = await createServerSupabaseClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`
        }
      } catch {
        // Keep undefined and let backend return auth errors.
      }
    }

    const init: RequestInit = {
      method: request.method,
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': request.headers.get('content-type') || 'application/json',
      },
      cache: 'no-store',
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text()
    }

    const response = await fetch(upstream, init)

    if (!response.ok) {
      const payload = await response.text()
      return new NextResponse(
        payload ||
          JSON.stringify({
            error: 'Upstream error',
            message: `SPX backend responded with status ${response.status}`,
          }),
        {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('content-type') || 'application/json',
          },
        },
      )
    }

    if ((response.headers.get('content-type') || '').includes('text/event-stream')) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const payload = await response.text()
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch {
    return NextResponse.json(
      {
        error: 'Proxy error',
        message: 'Unable to reach SPX backend endpoint',
      },
      {
        status: 502,
      },
    )
  }
}

export async function GET(request: Request, ctx: HandlerContext) {
  return proxy(request, ctx)
}

export async function POST(request: Request, ctx: HandlerContext) {
  return proxy(request, ctx)
}
