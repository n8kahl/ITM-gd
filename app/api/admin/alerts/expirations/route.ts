import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const MASSIVE_API_BASE = 'https://api.massive.com'
const MAX_PAGES = 12

const expirationsQuerySchema = z.object({
  symbol: z.string().trim().min(1),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxDaysAhead: z.coerce.number().int().min(0).max(365).default(60),
})

interface MassiveContractsRow {
  expiration_date?: string
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeUnderlying(rawSymbol: string): string {
  const normalized = rawSymbol.trim().toUpperCase()
  return normalized.startsWith('I:') ? normalized.slice(2) : normalized
}

function toEasternDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function addDays(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00.000Z`)
  anchor.setUTCDate(anchor.getUTCDate() + days)
  return anchor.toISOString().slice(0, 10)
}

function withApiKey(url: URL, apiKey: string): URL {
  if (!url.searchParams.has('apiKey')) {
    url.searchParams.set('apiKey', apiKey)
  }
  return url
}

async function fetchMassiveJson(url: URL): Promise<unknown> {
  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Massive request failed (${response.status}) ${url.pathname}: ${text.slice(0, 240)}`)
  }
  return text ? JSON.parse(text) : {}
}

function readNextUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  return toNullableString((payload as { next_url?: unknown }).next_url)
}

function readContractRows(payload: unknown): MassiveContractsRow[] {
  if (!payload || typeof payload !== 'object') return []
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results)) return []
  return results as MassiveContractsRow[]
}

export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = expirationsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query params' },
      { status: 400 },
    )
  }

  const apiKey = process.env.MASSIVE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'MASSIVE_API_KEY is not configured' },
      { status: 500 },
    )
  }

  const symbol = normalizeUnderlying(parsed.data.symbol)
  const asOfDate = parsed.data.asOfDate ?? toEasternDateString()
  const maxDaysAhead = parsed.data.maxDaysAhead
  const expirationUpperBound = addDays(asOfDate, maxDaysAhead)

  try {
    const expirations = new Set<string>()
    let pageCount = 0

    let nextUrl: URL | null = withApiKey(new URL('/v3/reference/options/contracts', MASSIVE_API_BASE), apiKey)
    nextUrl.searchParams.set('underlying_ticker', symbol)
    nextUrl.searchParams.set('sort', 'expiration_date')
    nextUrl.searchParams.set('order', 'asc')
    nextUrl.searchParams.set('expiration_date.gte', asOfDate)
    nextUrl.searchParams.set('expiration_date.lte', expirationUpperBound)
    nextUrl.searchParams.set('limit', '1000')

    while (nextUrl && pageCount < MAX_PAGES) {
      const payload = await fetchMassiveJson(nextUrl)
      const rows = readContractRows(payload)
      for (const row of rows) {
        const expiration = toNullableString(row.expiration_date)
        if (!expiration) continue
        if (expiration < asOfDate || expiration > expirationUpperBound) continue
        expirations.add(expiration)
      }

      const rawNextUrl = readNextUrl(payload)
      nextUrl = rawNextUrl ? withApiKey(new URL(rawNextUrl), apiKey) : null
      pageCount += 1
    }

    const sorted = [...expirations].sort()
    return NextResponse.json({
      success: true,
      symbol,
      asOfDate,
      maxDaysAhead,
      expirations: sorted,
      nearestExpiration: sorted[0] ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load expirations' },
      { status: 502 },
    )
  }
}

