import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app'
const TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS = 90000

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
      continue
    }
    if (candidateHost && requestHost && candidateHost === requestHost) {
      continue
    }
    filtered.push(candidate)
  }

  return filtered
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

function isSupportedPath(method: string, segments: string[]): boolean {
  if (segments.length !== 1) return false
  const endpoint = segments[0] || ''
  return (method === 'GET' && endpoint === 'health')
    || (method === 'POST' && endpoint === 'build')
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

function jsonError(
  status: number,
  error: string,
  message: string,
  timeoutMs: number = TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS,
  upstream?: string,
): NextResponse {
  return NextResponse.json(
    { error, message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Trade-Day-Replay-Proxy': 'next-app',
        'X-Trade-Day-Replay-Timeout-Ms': String(timeoutMs),
        ...(upstream ? { 'X-Trade-Day-Replay-Upstream': upstream } : {}),
      },
    },
  )
}

async function proxy(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const path = (await ctx.params)?.path ?? []
  const segments = Array.isArray(path) ? path : []
  if (segments.length === 0) {
    return jsonError(404, 'Not found', 'Missing trade-day-replay endpoint path')
  }

  if (!isSupportedPath(request.method, segments)) {
    return jsonError(404, 'Not found', `Unsupported trade-day-replay endpoint: ${request.method} /${segments.join('/')}`)
  }

  try {
    const backendBases = resolveBackendBaseUrls(request)
    if (backendBases.length === 0) {
      return jsonError(502, 'Upstream unavailable', 'No eligible backend URL candidates available')
    }

    const url = new URL(request.url)
    const upstreamPath = `/api/trade-day-replay/${segments.join('/')}${url.search}`

    let incomingAuthHeader: string | undefined
    let sessionAuthHeader: string | undefined
    const incomingAuth = request.headers.get('authorization') || request.headers.get('Authorization')
    if (incomingAuth?.trim()) {
      incomingAuthHeader = incomingAuth.trim()
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

    const authHeaders = dedupeAuthHeaders([incomingAuthHeader, sessionAuthHeader])
    if (authHeaders.length === 0) {
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
          const response = await fetchUpstream(upstream, init, TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS)
          lastResponse = response

          if (response.ok) {
            const payload = await response.text()
            const contentType = response.headers.get('content-type') || 'application/json'
            return new NextResponse(payload, {
              status: response.status,
              headers: {
                'Cache-Control': 'no-store',
                'Content-Type': contentType,
                'X-Trade-Day-Replay-Proxy': 'next-app',
                'X-Trade-Day-Replay-Upstream': backendBase,
                'X-Trade-Day-Replay-Timeout-Ms': String(TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS),
              },
            })
          }

          if (response.status === 401 && hasMoreAuthCandidates) {
            continue
          }

          const isRetryableStatus = response.status >= 500 || response.status === 408 || response.status === 429
          if (isRetryableStatus) {
            break
          }

          const payload = await response.text()
          const contentType = response.headers.get('content-type') || 'application/json'

          return new NextResponse(payload, {
            status: response.status,
            headers: {
              'Cache-Control': 'no-store',
              'Content-Type': contentType,
              'X-Trade-Day-Replay-Proxy': 'next-app',
              'X-Trade-Day-Replay-Upstream': backendBase,
              'X-Trade-Day-Replay-Upstream-Status': String(response.status),
              'X-Trade-Day-Replay-Timeout-Ms': String(TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS),
            },
          })
        } catch (error) {
          lastFailureKind = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network'
          if (hasMoreAuthCandidates) {
            continue
          }
        }
      }
    }

    if (lastResponse) {
      const payload = await lastResponse.text()
      const contentType = lastResponse.headers.get('content-type') || 'application/json'
      return new NextResponse(payload, {
        status: lastResponse.status,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': contentType,
          'X-Trade-Day-Replay-Proxy': 'next-app',
          'X-Trade-Day-Replay-Upstream-Status': String(lastResponse.status),
          'X-Trade-Day-Replay-Timeout-Ms': String(TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS),
          ...(lastUpstreamBase ? { 'X-Trade-Day-Replay-Upstream': lastUpstreamBase } : {}),
        },
      })
    }

    if (lastFailureKind === 'timeout') {
      return jsonError(
        504,
        'Upstream timeout',
        'Trade day replay backend request timed out',
        TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS,
        lastUpstreamBase || undefined,
      )
    }

    return jsonError(
      502,
      'Upstream unavailable',
      'Unable to reach trade-day-replay backend endpoint',
      TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS,
      lastUpstreamBase || undefined,
    )
  } catch {
    return jsonError(
      502,
      'Upstream unavailable',
      'Unable to reach trade-day-replay backend endpoint',
      TRADE_DAY_REPLAY_PROXY_TIMEOUT_MS,
    )
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(request, ctx)
}
