import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app'
const DEFAULT_PROXY_TIMEOUT_MS = 4000
const COACH_STREAM_TIMEOUT_MS = 15000

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

function toBackendCandidates(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    if (!value) continue
    const normalized = value.replace(/\/+$/, '')
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }

  return out
}

function resolveBackendBaseUrls(request: Request): string[] {
  const host = getRequestHost(request)
  const normalizedHost = normalizeHost(host)
  const isLocalHost = host === 'localhost' || host === '127.0.0.1'
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'

  const envCandidates = toBackendCandidates([
    process.env.SPX_BACKEND_URL,
    process.env.AI_COACH_API_URL,
    process.env.NEXT_PUBLIC_AI_COACH_API_URL,
  ])

  const defaults = isLocalHost && preferLocalInDev
    ? [DEFAULT_LOCAL_BACKEND, DEFAULT_REMOTE_BACKEND]
    : [DEFAULT_REMOTE_BACKEND, DEFAULT_LOCAL_BACKEND]

  const candidates = toBackendCandidates([...envCandidates, ...defaults])

  const filtered: string[] = []

  for (const candidate of candidates) {
    const candidateHost = parseHostname(candidate)
    if (candidateHost && normalizedHost && normalizeHost(candidateHost) === normalizedHost) {
      // Prevent recursive proxying when server env points back to this same host.
      continue
    }
    filtered.push(candidate)
  }

  return filtered.length > 0 ? filtered : [DEFAULT_LOCAL_BACKEND]
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
    case 'contract-select':
      return {
        contract: null,
        confidence: 0,
        rationale: 'SPX backend temporarily unavailable.',
        riskProfile: {
          maxRisk: 0,
          rewardTarget: 0,
          stopLoss: 0,
        },
        generatedAt: timestamp,
        degraded: true,
      }
    default:
      return null
  }
}

function getTimeoutMs(method: string, segments: string[]): number {
  if (method === 'POST' && segments[0] === 'coach' && segments[1] === 'message') {
    return COACH_STREAM_TIMEOUT_MS
  }

  const configured = Number.parseInt(process.env.SPX_PROXY_TIMEOUT_MS || '', 10)
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  return DEFAULT_PROXY_TIMEOUT_MS
}

function dedupeAuthHeaders(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    if (!value) continue
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }

  return out
}

async function fetchUpstream(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function proxy(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const path = (await ctx.params)?.path ?? []
  const segments = Array.isArray(path) ? path : []
  if (segments.length === 0) {
    return NextResponse.json(
      { error: 'Not found', message: 'Missing SPX endpoint path' },
      { status: 404, headers: { 'X-SPX-Proxy': 'next-app' } },
    )
  }

  try {
    const url = new URL(request.url)
    const backendBases = resolveBackendBaseUrls(request)
    const upstreamPath = `/api/spx/${segments.join('/')}${url.search}`
    const timeoutMs = getTimeoutMs(request.method, segments)

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
      // Keep undefined and let backend return auth errors.
    }

    const authHeaders = dedupeAuthHeaders([sessionAuthHeader, incomingAuthHeader])
    if (authHeaders.length === 0) {
      // Allow unauthenticated pass-through so upstream returns explicit auth errors.
      authHeaders.push('')
    }

    const requestBody = request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.text()
      : undefined

    let lastResponse: Response | null = null
    let lastUpstreamBase = ''

    for (const backendBase of backendBases) {
      const upstream = `${backendBase}${upstreamPath}`
      lastUpstreamBase = backendBase

      for (let authIndex = 0; authIndex < authHeaders.length; authIndex += 1) {
        const authHeader = authHeaders[authIndex]
        const hasMoreAuthCandidates = authIndex < authHeaders.length - 1

        const init: RequestInit = {
          method: request.method,
          headers: {
            ...(authHeader ? { Authorization: authHeader } : {}),
            'Content-Type': request.headers.get('content-type') || 'application/json',
          },
          cache: 'no-store',
          ...(requestBody !== undefined ? { body: requestBody } : {}),
        }

        try {
          const response = await fetchUpstream(upstream, init, timeoutMs)
          lastResponse = response

          if (response.ok) {
            if ((response.headers.get('content-type') || '').includes('text/event-stream')) {
              return new NextResponse(response.body, {
                status: response.status,
                headers: {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  Connection: 'keep-alive',
                  'X-SPX-Proxy': 'next-app',
                  'X-SPX-Upstream': backendBase,
                },
              })
            }

            const payload = await response.text()
            return new NextResponse(payload, {
              status: response.status,
              headers: {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'X-SPX-Proxy': 'next-app',
                'X-SPX-Upstream': backendBase,
              },
            })
          }

          // Retry same upstream with alternate auth when first token is stale.
          if (response.status === 401 && hasMoreAuthCandidates) {
            continue
          }

          // Retry against the next backend candidate if this upstream is unhealthy.
          const isRetryableStatus = response.status >= 500
          const hasMoreBackends = backendBase !== backendBases[backendBases.length - 1]
          if (isRetryableStatus && hasMoreBackends) {
            break
          }

          const contentType = response.headers.get('content-type') || ''
          const payload = await response.text()
          const fallback = request.method === 'GET' ? spxFallbackPayload(segments) : null
          const shouldFallback = response.status >= 500

          if (contentType.includes('application/json')) {
            if (fallback && shouldFallback) {
              return NextResponse.json(fallback, {
                status: 200,
                headers: {
                  'X-SPX-Proxy': 'next-app',
                  'X-SPX-Fallback': `upstream_${response.status}`,
                  'X-SPX-Upstream-Status': String(response.status),
                  'X-SPX-Upstream': backendBase,
                },
              })
            }

            return new NextResponse(payload, {
              status: response.status,
              headers: {
                'Content-Type': 'application/json',
                'X-SPX-Proxy': 'next-app',
                'X-SPX-Upstream-Status': String(response.status),
                'X-SPX-Upstream': backendBase,
              },
            })
          }

          if (fallback && shouldFallback) {
            return NextResponse.json(fallback, {
              status: 200,
              headers: {
                'X-SPX-Proxy': 'next-app',
                'X-SPX-Fallback': `upstream_${response.status}`,
                'X-SPX-Upstream-Status': String(response.status),
                'X-SPX-Upstream': backendBase,
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
                'X-SPX-Upstream': backendBase,
              },
            },
          )
        } catch {
          // Try next auth candidate; if none left, loop advances to next backend.
          if (hasMoreAuthCandidates) {
            continue
          }
        }
      }
    }

    const fallback = request.method === 'GET' ? spxFallbackPayload(segments) : null
    if (fallback) {
      return NextResponse.json(fallback, {
        status: 200,
        headers: {
          'X-SPX-Proxy': 'next-app',
          'X-SPX-Fallback': 'proxy_error',
          ...(lastResponse ? { 'X-SPX-Upstream-Status': String(lastResponse.status) } : {}),
          ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
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
          ...(lastResponse ? { 'X-SPX-Upstream-Status': String(lastResponse.status) } : {}),
          ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
        },
      },
    )
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx)
}
