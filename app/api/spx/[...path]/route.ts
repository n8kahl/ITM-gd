import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app'
const DEFAULT_PROXY_TIMEOUT_MS = 12000
const SNAPSHOT_PROXY_TIMEOUT_MS = 45000
const CONTRACT_SELECT_TIMEOUT_MS = 30000
const HEAVY_ENDPOINT_TIMEOUT_MS = 25000
const COACH_STREAM_TIMEOUT_MS = 15000
const STALE_CACHE_TTL_MS = 5 * 60 * 1000
const STALE_CACHEABLE_ENDPOINTS = new Set(['snapshot', 'contract-select'])

interface StaleCacheEntry {
  payload: string
  contentType: string
  capturedAt: number
}

const staleCache = new Map<string, StaleCacheEntry>()

interface UrlInfo {
  host: string
  hostname: string
}

function parseUrlInfo(value: string): UrlInfo | null {
  try {
    const url = new URL(value)
    return {
      host: url.host.toLowerCase(),
      hostname: url.hostname.toLowerCase(),
    }
  } catch {
    return null
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
  const requestInfo = parseUrlInfo(request.url)
  const requestHost = requestInfo?.host || ''
  const requestHostname = requestInfo?.hostname || ''
  const isLocalHost = requestHostname === 'localhost' || requestHostname === '127.0.0.1'
  const preferLocalInDev = process.env.NEXT_PUBLIC_FORCE_REMOTE_AI_COACH !== 'true'
  const disableRemoteFallbackInDev = process.env.ALLOW_REMOTE_SPX_FALLBACK === 'false'
    || process.env.NEXT_PUBLIC_ALLOW_REMOTE_SPX_FALLBACK === 'false'
  const forceLocalOnlyInDev = process.env.FORCE_LOCAL_SPX_BACKEND === 'true'
    || process.env.NEXT_PUBLIC_FORCE_LOCAL_SPX_BACKEND === 'true'
  const allowRemoteFallbackInDev = !disableRemoteFallbackInDev && !forceLocalOnlyInDev

  const envCandidates = toBackendCandidates([
    process.env.SPX_BACKEND_URL,
    process.env.AI_COACH_API_URL,
    process.env.NEXT_PUBLIC_AI_COACH_API_URL,
  ])

  const defaults = isLocalHost && preferLocalInDev
    ? allowRemoteFallbackInDev
      ? [DEFAULT_LOCAL_BACKEND, DEFAULT_REMOTE_BACKEND]
      : [DEFAULT_LOCAL_BACKEND]
    : [DEFAULT_REMOTE_BACKEND]

  const candidates = toBackendCandidates([...envCandidates, ...defaults])

  const filtered: string[] = []

  for (const candidate of candidates) {
    const candidateInfo = parseUrlInfo(candidate)
    const candidateHost = candidateInfo?.host || ''
    const candidateHostname = candidateInfo?.hostname || ''

    if (!isLocalHost && (candidateHostname === 'localhost' || candidateHostname === '127.0.0.1')) {
      // Never try localhost fallback from remote environments.
      continue
    }
    if (candidateHost && requestHost && candidateHost === requestHost) {
      // Prevent recursive proxying only when candidate points to this same origin (host:port).
      continue
    }
    filtered.push(candidate)
  }

  return filtered
}

function getTimeoutMs(method: string, segments: string[]): number {
  const endpoint = segments[0] || ''

  if (method === 'POST' && endpoint === 'coach' && segments[1] === 'message') {
    return COACH_STREAM_TIMEOUT_MS
  }

  const configured = Number.parseInt(process.env.SPX_PROXY_TIMEOUT_MS || '', 10)
  if (Number.isFinite(configured) && configured > 0) {
    return configured
  }

  if (method === 'GET' && endpoint === 'snapshot') {
    return SNAPSHOT_PROXY_TIMEOUT_MS
  }

  if (method === 'GET' && endpoint === 'contract-select') {
    return CONTRACT_SELECT_TIMEOUT_MS
  }
  if (method === 'GET' && (endpoint === 'levels' || endpoint === 'clusters' || endpoint === 'gex' || endpoint === 'flow' || endpoint === 'regime')) {
    return HEAVY_ENDPOINT_TIMEOUT_MS
  }

  return DEFAULT_PROXY_TIMEOUT_MS
}

function getStaleCacheKey(method: string, endpoint: string, search: string): string | null {
  if (method !== 'GET') return null
  if (!STALE_CACHEABLE_ENDPOINTS.has(endpoint)) return null
  return `${endpoint}${search}`
}

function putStaleCache(cacheKey: string | null, payload: string, contentType: string): void {
  if (!cacheKey) return
  staleCache.set(cacheKey, {
    payload,
    contentType,
    capturedAt: Date.now(),
  })
}

function getStaleCache(cacheKey: string | null): StaleCacheEntry | null {
  if (!cacheKey) return null
  const entry = staleCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() - entry.capturedAt > STALE_CACHE_TTL_MS) {
    staleCache.delete(cacheKey)
    return null
  }
  return entry
}

function degradedSnapshotResponse(message: string, timeoutMs: number, upstream?: string): NextResponse {
  return NextResponse.json(
    {
      degraded: true,
      message,
      generatedAt: new Date().toISOString(),
      levels: [],
      clusters: [],
      fibLevels: [],
      flow: [],
      coachMessages: [],
      setups: [],
      basis: {
        current: 0,
        trend: 'stable',
        leading: 'neutral',
        ema5: 0,
        ema20: 0,
        zscore: 0,
      },
      regime: {
        regime: 'compression',
        direction: 'neutral',
        probability: 0,
        magnitude: 'small',
        confidence: 0,
        timestamp: new Date().toISOString(),
      },
      prediction: {
        regime: 'compression',
        direction: { bullish: 0, bearish: 0, neutral: 1 },
        magnitude: { small: 1, medium: 0, large: 0 },
        timingWindow: { description: 'Degraded mode', actionable: false },
        nextTarget: {
          upside: { price: 0, zone: 'unavailable' },
          downside: { price: 0, zone: 'unavailable' },
        },
        probabilityCone: [],
        confidence: 0,
      },
      gex: {
        spx: {
          netGex: 0,
          flipPoint: 0,
          callWall: 0,
          putWall: 0,
          zeroGamma: 0,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: new Date().toISOString(),
        },
        spy: {
          netGex: 0,
          flipPoint: 0,
          callWall: 0,
          putWall: 0,
          zeroGamma: 0,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: new Date().toISOString(),
        },
        combined: {
          netGex: 0,
          flipPoint: 0,
          callWall: 0,
          putWall: 0,
          zeroGamma: 0,
          gexByStrike: [],
          keyLevels: [],
          expirationBreakdown: {},
          timestamp: new Date().toISOString(),
        },
      },
    },
    {
      status: 200,
      headers: {
        'X-SPX-Proxy': 'next-app',
        'X-SPX-Degraded': 'snapshot-fallback',
        'X-SPX-Timeout-Ms': String(timeoutMs),
        ...(upstream ? { 'X-SPX-Upstream': upstream } : {}),
      },
    },
  )
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
    const endpoint = segments[0] || ''
    const upstreamPath = `/api/spx/${segments.join('/')}${url.search}`
    const timeoutMs = getTimeoutMs(request.method, segments)
    const staleCacheKey = getStaleCacheKey(request.method, endpoint, url.search)

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
    let lastFailureKind: 'timeout' | 'network' | null = null

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
            const contentType = response.headers.get('content-type') || 'application/json'
            putStaleCache(staleCacheKey, payload, contentType)
            return new NextResponse(payload, {
              status: response.status,
              headers: {
                'Content-Type': contentType,
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
          if (isRetryableStatus) {
            break
          }

          const contentType = response.headers.get('content-type') || ''
          const payload = await response.text()

          if (contentType.includes('application/json')) {
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
        } catch (error) {
          lastFailureKind = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network'
          // Try next auth candidate; if none left, loop advances to next backend.
          if (hasMoreAuthCandidates) {
            continue
          }
        }
      }
    }

    if (lastResponse) {
      if (lastResponse.status >= 500) {
        const stale = getStaleCache(staleCacheKey)
        if (stale) {
          return new NextResponse(stale.payload, {
            status: 200,
            headers: {
              'Content-Type': stale.contentType || 'application/json',
              'X-SPX-Proxy': 'next-app',
              'X-SPX-Stale': 'true',
              ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
            },
          })
        }

        if (request.method === 'GET' && endpoint === 'snapshot') {
          return degradedSnapshotResponse('SPX service unavailable (degraded fallback).', timeoutMs, lastUpstreamBase)
        }
      }

      const upstreamStatus = lastResponse.status
      const payload = await lastResponse.text()
      const contentType = lastResponse.headers.get('content-type') || 'application/json'

      return new NextResponse(payload, {
        status: upstreamStatus,
        headers: {
          'Content-Type': contentType,
          'X-SPX-Proxy': 'next-app',
          'X-SPX-Upstream-Status': String(upstreamStatus),
          ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
        },
      })
    }

    const stale = getStaleCache(staleCacheKey)
    if (stale) {
      return new NextResponse(stale.payload, {
        status: 200,
        headers: {
          'Content-Type': stale.contentType || 'application/json',
          'X-SPX-Proxy': 'next-app',
          'X-SPX-Stale': 'true',
          ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
        },
      })
    }

    if (request.method === 'GET' && endpoint === 'snapshot') {
      return degradedSnapshotResponse(
        lastFailureKind === 'timeout'
          ? 'SPX snapshot timed out (degraded fallback).'
          : 'SPX snapshot unavailable (degraded fallback).',
        timeoutMs,
        lastUpstreamBase,
      )
    }

    return NextResponse.json(
      {
        error: 'Proxy error',
        message: lastFailureKind === 'timeout'
          ? 'SPX backend request timed out'
          : 'Unable to reach SPX backend endpoint',
      },
      {
        status: 502,
        headers: {
          'X-SPX-Proxy': 'next-app',
          ...(lastFailureKind ? { 'X-SPX-Failure': lastFailureKind } : {}),
          'X-SPX-Timeout-Ms': String(timeoutMs),
          ...(lastUpstreamBase ? { 'X-SPX-Upstream': lastUpstreamBase } : {}),
        },
      },
    )
  } catch {
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
