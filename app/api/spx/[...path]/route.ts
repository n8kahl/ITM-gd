import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function getRequestHost(request: Request): string {
  try {
    return new URL(request.url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function parseHostname(candidate: string): string {
  try {
    return new URL(candidate).hostname.toLowerCase()
  } catch {
    return ''
  }
}

function resolveBackendBaseUrl(request: Request): string {
  const candidates = [
    process.env.AI_COACH_API_URL,
    process.env.NEXT_PUBLIC_AI_COACH_API_URL,
    'http://localhost:3001',
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/+$/, ''))

  const host = getRequestHost(request)
  const normalizedHost = normalizeHost(host)

  const isLocalHost = host === 'localhost' || host === '127.0.0.1'
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'

  for (const candidate of candidates) {
    const candidateHost = parseHostname(candidate)
    if (candidateHost && normalizedHost && normalizeHost(candidateHost) === normalizedHost) {
      // Prevent recursive proxying when server env points back to this same host.
      continue
    }

    if (isLocalHost && preferLocalInDev && /railway\.app/i.test(candidate)) {
      return 'http://localhost:3001'
    }

    return candidate
  }

  return 'http://localhost:3001'
}

type HandlerContext = {
  params: Promise<{
    path: string[]
  }>
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyGexProfile(symbol: 'SPX' | 'SPY' | 'COMBINED') {
  return {
    symbol,
    spotPrice: 0,
    netGex: 0,
    flipPoint: 0,
    callWall: 0,
    putWall: 0,
    zeroGamma: 0,
    gexByStrike: [] as Array<{ strike: number; gex: number }>,
    keyLevels: [] as Array<{ strike: number; gex: number; type: 'call_wall' | 'put_wall' | 'high_oi' }>,
    expirationBreakdown: {} as Record<string, { netGex: number; callWall: number; putWall: number }>,
    timestamp: nowIso(),
  }
}

function spxFallbackPayload(segments: string[]): unknown | null {
  const route = segments.join('/')
  const timestamp = nowIso()

  switch (route) {
    case 'levels':
      return { levels: [], generatedAt: timestamp, degraded: true }
    case 'clusters':
      return { zones: [], generatedAt: timestamp, degraded: true }
    case 'gex':
      return {
        spx: emptyGexProfile('SPX'),
        spy: emptyGexProfile('SPY'),
        combined: emptyGexProfile('COMBINED'),
        degraded: true,
      }
    case 'gex/history':
      return { symbol: 'SPX', snapshots: [], count: 0, degraded: true }
    case 'setups':
      return { setups: [], count: 0, generatedAt: timestamp, degraded: true }
    case 'fibonacci':
      return { levels: [], count: 0, generatedAt: timestamp, degraded: true }
    case 'flow':
      return { events: [], count: 0, generatedAt: timestamp, degraded: true }
    case 'basis':
      return {
        current: 0,
        trend: 'stable',
        leading: 'neutral',
        ema5: 0,
        ema20: 0,
        zscore: 0,
        spxPrice: 0,
        spyPrice: 0,
        timestamp,
        degraded: true,
      }
    case 'regime':
      return {
        regime: 'ranging',
        direction: 'neutral',
        probability: 0,
        magnitude: 'small',
        confidence: 0,
        timestamp,
        prediction: {
          regime: 'ranging',
          direction: { bullish: 0, bearish: 0, neutral: 100 },
          magnitude: { small: 100, medium: 0, large: 0 },
          timingWindow: { description: 'SPX backend temporarily unavailable.', actionable: false },
          nextTarget: {
            upside: { price: 0, zone: 'unavailable' },
            downside: { price: 0, zone: 'unavailable' },
          },
          probabilityCone: [] as Array<{
            minutesForward: number
            high: number
            low: number
            center: number
            confidence: number
          }>,
          confidence: 0,
        },
        degraded: true,
      }
    case 'coach/state':
      return { messages: [], generatedAt: timestamp, degraded: true }
    default:
      return null
  }
}

async function proxy(request: Request, ctx: HandlerContext): Promise<Response> {
  const { path } = await ctx.params
  const segments = Array.isArray(path) ? path : []
  if (segments.length === 0) {
    return NextResponse.json(
      { error: 'Not found', message: 'Missing SPX endpoint path' },
      { status: 404, headers: { 'X-SPX-Proxy': 'next-app' } },
    )
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
      const contentType = response.headers.get('content-type') || ''
      const payload = await response.text()
      const fallback = request.method === 'GET' ? spxFallbackPayload(segments) : null

      if (contentType.includes('application/json')) {
        if (fallback) {
          return NextResponse.json(fallback, {
            status: 200,
            headers: {
              'X-SPX-Proxy': 'next-app',
              'X-SPX-Fallback': `upstream_${response.status}`,
              'X-SPX-Upstream-Status': String(response.status),
            },
          })
        }

        return new NextResponse(payload, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'X-SPX-Proxy': 'next-app',
            'X-SPX-Upstream-Status': String(response.status),
          },
        })
      }

      if (fallback) {
        return NextResponse.json(fallback, {
          status: 200,
          headers: {
            'X-SPX-Proxy': 'next-app',
            'X-SPX-Fallback': `upstream_${response.status}`,
            'X-SPX-Upstream-Status': String(response.status),
          },
        })
      }

      return NextResponse.json(
        {
          error: 'Upstream error',
          message: `SPX backend responded with status ${response.status}`,
        },
        {
          status: response.status,
          headers: {
            'X-SPX-Proxy': 'next-app',
            'X-SPX-Upstream-Status': String(response.status),
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
          'X-SPX-Proxy': 'next-app',
        },
      })
    }

    const payload = await response.text()
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'X-SPX-Proxy': 'next-app',
      },
    })
  } catch {
    const fallback = request.method === 'GET' ? spxFallbackPayload(segments) : null
    if (fallback) {
      return NextResponse.json(fallback, {
        status: 200,
        headers: {
          'X-SPX-Proxy': 'next-app',
          'X-SPX-Fallback': 'proxy_error',
        },
      })
    }

    return NextResponse.json(
      {
        error: 'Proxy error',
        message: 'Unable to reach SPX backend endpoint',
      },
      {
        status: 502,
        headers: {
          'X-SPX-Proxy': 'next-app',
        },
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
