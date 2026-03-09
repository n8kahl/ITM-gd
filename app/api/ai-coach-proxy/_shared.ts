import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_LOCAL_BACKEND = 'http://localhost:3001'
const DEFAULT_REMOTE_BACKEND = 'https://itm-gd-production.up.railway.app'
const DEFAULT_PROXY_TIMEOUT_MS = 20000
const STREAM_PROXY_TIMEOUT_MS = 50000

interface UrlInfo {
  host: string
  hostname: string
}

interface AuthHeaders {
  primary?: string
  fallback?: string
}

function parseUrlInfo(value: string): UrlInfo | null {
  try {
    const parsed = new URL(value)
    return {
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
    }
  } catch {
    return null
  }
}

function ensureProtocol(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const isLocalHost =
    /^localhost(?::\d+)?$/i.test(trimmed)
    || /^127\.0\.0\.1(?::\d+)?$/i.test(trimmed)

  return `${isLocalHost ? 'http' : 'https'}://${trimmed}`
}

function toBackendCandidates(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const rawValue of values) {
    if (!rawValue) continue
    const normalized = ensureProtocol(rawValue).replace(/\/+$/, '')
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
  const forceLocalOnlyInDev =
    process.env.FORCE_LOCAL_AI_COACH_BACKEND === 'true'
    || process.env.NEXT_PUBLIC_FORCE_LOCAL_AI_COACH_BACKEND === 'true'

  const envCandidates = toBackendCandidates([
    process.env.AI_COACH_API_URL,
    process.env.NEXT_PUBLIC_AI_COACH_API_URL,
  ])

  const defaults = isLocalHost && preferLocalInDev
    ? forceLocalOnlyInDev
      ? [DEFAULT_LOCAL_BACKEND]
      : [DEFAULT_LOCAL_BACKEND, DEFAULT_REMOTE_BACKEND]
    : [DEFAULT_REMOTE_BACKEND]

  const candidates = toBackendCandidates([...envCandidates, ...defaults])

  return candidates.filter((candidate) => {
    const candidateInfo = parseUrlInfo(candidate)
    const candidateHost = candidateInfo?.host || ''
    const candidateHostname = candidateInfo?.hostname || ''

    if (!isLocalHost && (candidateHostname === 'localhost' || candidateHostname === '127.0.0.1')) {
      return false
    }
    if (candidateHost && requestHost && candidateHost === requestHost) {
      return false
    }
    return true
  })
}

async function resolveAuthHeaders(request: Request): Promise<AuthHeaders> {
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
    // Keep proxy public if no session is available.
  }

  return {
    primary: incomingAuthHeader || sessionAuthHeader,
    fallback:
      incomingAuthHeader && sessionAuthHeader && incomingAuthHeader !== sessionAuthHeader
        ? sessionAuthHeader
        : undefined,
  }
}

function normalizeUpstreamPath(upstreamPath: string | string[]): string {
  if (Array.isArray(upstreamPath)) {
    const path = upstreamPath.map((segment) => encodeURIComponent(segment)).join('/')
    return `/api/${path}`
  }

  const normalized = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`
  return normalized.startsWith('/api/') ? normalized : `/api${normalized}`
}

function buildUpstreamUrl(candidate: string, normalizedPath: string, request: Request): string {
  // Guard against accidental double-query appending when callers include search
  // in upstreamPath and the current request also has search params.
  if (normalizedPath.includes('?')) {
    return `${candidate}${normalizedPath}`
  }
  return `${candidate}${normalizedPath}${new URL(request.url).search}`
}

function buildForwardHeaders(request: Request, authHeader?: string): Headers {
  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const accept = request.headers.get('accept')

  if (contentType) headers.set('Content-Type', contentType)
  if (accept) headers.set('Accept', accept)
  if (authHeader) headers.set('Authorization', authHeader)

  return headers
}

function shouldTryNextCandidate(status: number): boolean {
  return status === 401 || status === 404 || status === 408 || status === 429 || status >= 500
}

function resolveTimeoutMs(request: Request, upstreamPath: string): number {
  if (request.method === 'POST' && upstreamPath.startsWith('/api/chat/stream')) {
    return STREAM_PROXY_TIMEOUT_MS
  }
  return DEFAULT_PROXY_TIMEOUT_MS
}

function passthroughHeaders(source: Headers): Headers {
  const headers = new Headers()
  const keys = [
    'content-type',
    'cache-control',
    'content-encoding',
    'etag',
    'last-modified',
    'retry-after',
    'x-request-id',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
  ]

  for (const key of keys) {
    const value = source.get(key)
    if (value) headers.set(key, value)
  }

  return headers
}

async function fetchCandidate(
  request: Request,
  upstream: string,
  authHeaders: AuthHeaders,
  requestBody?: ArrayBuffer,
  timeoutMs: number = DEFAULT_PROXY_TIMEOUT_MS,
): Promise<Response> {
  const fetchWithHeader = async (authHeader?: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const abortFromRequest = () => controller.abort()
    request.signal.addEventListener('abort', abortFromRequest, { once: true })

    try {
      return await fetch(upstream, {
        method: request.method,
        headers: buildForwardHeaders(request, authHeader),
        body: requestBody && requestBody.byteLength > 0 ? requestBody : undefined,
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
      request.signal.removeEventListener('abort', abortFromRequest)
    }
  }

  let response = await fetchWithHeader(authHeaders.primary)
  if (response.status === 401 && authHeaders.fallback) {
    response = await fetchWithHeader(authHeaders.fallback)
  }
  return response
}

export async function proxyAICoachRequest(
  request: Request,
  upstreamPath: string | string[],
  fallbackMessage: string,
): Promise<NextResponse> {
  const normalizedPath = normalizeUpstreamPath(upstreamPath)
  const candidates = resolveBackendBaseUrls(request)
  const authHeaders = await resolveAuthHeaders(request)
  const timeoutMs = resolveTimeoutMs(request, normalizedPath)

  const requestBody =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer()

  let lastResponse: Response | null = null

  for (const candidate of candidates) {
    const upstream = buildUpstreamUrl(candidate, normalizedPath, request)
    try {
      const response = await fetchCandidate(request, upstream, authHeaders, requestBody, timeoutMs)
      lastResponse = response
      if (response.ok || !shouldTryNextCandidate(response.status)) {
        break
      }
    } catch {
      continue
    }
  }

  if (!lastResponse) {
    return NextResponse.json(
      { error: 'proxy_error', message: fallbackMessage },
      { status: 502 },
    )
  }

  if (!lastResponse.ok) {
    const payload = await lastResponse.text().catch(() => '')
    return new NextResponse(
      payload || JSON.stringify({ message: fallbackMessage }),
      {
        status: lastResponse.status,
        headers: passthroughHeaders(lastResponse.headers),
      },
    )
  }

  return new NextResponse(lastResponse.body, {
    status: lastResponse.status,
    headers: passthroughHeaders(lastResponse.headers),
  })
}

export async function proxyAICoachGet(request: Request, upstreamPath: string, fallbackMessage: string) {
  if (request.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }
  return proxyAICoachRequest(request, upstreamPath, fallbackMessage)
}
