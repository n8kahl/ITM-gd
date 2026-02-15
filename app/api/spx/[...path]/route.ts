import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app'
const DEFAULT_PROXY_TIMEOUT_MS = 12000
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
    : [DEFAULT_REMOTE_BACKEND]

  const candidates = toBackendCandidates([...envCandidates, ...defaults])

  const filtered: string[] = []

  for (const candidate of candidates) {
    const candidateHost = parseHostname(candidate)
    if (!isLocalHost && (candidateHost === 'localhost' || candidateHost === '127.0.0.1')) {
      // Never try localhost fallback from remote environments.
      continue
    }
    if (candidateHost && normalizedHost && normalizeHost(candidateHost) === normalizedHost) {
      // Prevent recursive proxying when server env points back to this same host.
      continue
    }
    filtered.push(candidate)
  }

  if (filtered.length > 0) {
    return filtered
  }

  return isLocalHost && preferLocalInDev
    ? [DEFAULT_LOCAL_BACKEND, DEFAULT_REMOTE_BACKEND]
    : [DEFAULT_REMOTE_BACKEND]
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
            const contentType = response.headers.get('content-type') || 'application/json'
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
          const hasMoreBackends = backendBase !== backendBases[backendBases.length - 1]
          if (isRetryableStatus && hasMoreBackends) {
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
        } catch {
          // Try next auth candidate; if none left, loop advances to next backend.
          if (hasMoreAuthCandidates) {
            continue
          }
        }
      }
    }

    if (lastResponse) {
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

    return NextResponse.json(
      {
        error: 'Proxy error',
        message: 'Unable to reach SPX backend endpoint',
      },
      {
        status: 502,
        headers: {
          'X-SPX-Proxy': 'next-app',
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
