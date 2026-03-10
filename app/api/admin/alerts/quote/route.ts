import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const MASSIVE_API_BASE = 'https://api.massive.com'
const INDEX_UNDERLYINGS = new Set(['SPX', 'NDX', 'RUT', 'VIX', 'DJX'])

const quoteQuerySchema = z.object({
  symbol: z.string().trim().min(1),
  optionTicker: z.string().trim().optional(),
  expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  strike: z.coerce.number().optional(),
  optionType: z.enum(['call', 'put']).optional(),
}).superRefine((value, context) => {
  if (value.optionTicker) return
  if (!value.expiration) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'expiration is required when optionTicker is not provided' })
  }
  if (value.strike == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'strike is required when optionTicker is not provided' })
  }
  if (!value.optionType) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'optionType is required when optionTicker is not provided' })
  }
})

interface MassiveContractsRow {
  ticker?: string
  strike_price?: number
  contract_type?: 'call' | 'put' | string
  expiration_date?: string
}

interface MassiveSnapshotRow {
  ticker?: string
  details?: {
    ticker?: string
    contract_type?: 'call' | 'put' | string
    expiration_date?: string
    strike_price?: number
  }
  day?: {
    close?: number
  }
  last_quote?: {
    bid?: number
    ask?: number
    last_updated?: number
  }
  greeks?: {
    delta?: number
  }
  implied_volatility?: number
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeUnderlying(rawSymbol: string): string {
  const normalized = rawSymbol.trim().toUpperCase()
  return normalized.startsWith('I:') ? normalized.slice(2) : normalized
}

function toSnapshotCandidates(symbol: string): string[] {
  if (INDEX_UNDERLYINGS.has(symbol)) {
    return [`I:${symbol}`, symbol]
  }
  return [symbol]
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

function normalizeSnapshotRow(payload: unknown): MassiveSnapshotRow | null {
  if (!payload || typeof payload !== 'object') return null
  const raw = (payload as { results?: unknown }).results
  if (Array.isArray(raw)) {
    const first = raw[0]
    return first && typeof first === 'object' ? first as MassiveSnapshotRow : null
  }
  return raw && typeof raw === 'object' ? raw as MassiveSnapshotRow : null
}

async function resolveOptionTicker(input: {
  apiKey: string
  symbol: string
  expiration: string
  strike: number
  optionType: 'call' | 'put'
}): Promise<string> {
  const url = withApiKey(new URL('/v3/reference/options/contracts', MASSIVE_API_BASE), input.apiKey)
  url.searchParams.set('underlying_ticker', input.symbol)
  url.searchParams.set('expiration_date', input.expiration)
  url.searchParams.set('contract_type', input.optionType)
  url.searchParams.set('strike_price', String(input.strike))
  url.searchParams.set('limit', '25')

  const payload = await fetchMassiveJson(url)
  const rows = Array.isArray((payload as { results?: unknown }).results)
    ? (payload as { results: unknown[] }).results
    : []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const contract = row as MassiveContractsRow
    const ticker = toNullableString(contract.ticker)
    const strike = toFiniteNumber(contract.strike_price)
    const optionType = contract.contract_type === 'put' ? 'put' : contract.contract_type === 'call' ? 'call' : null
    const expiration = toNullableString(contract.expiration_date)
    if (!ticker || strike == null || !optionType || !expiration) continue

    if (
      expiration === input.expiration
      && optionType === input.optionType
      && Math.abs(strike - input.strike) < 0.0001
    ) {
      return ticker
    }
  }

  throw new Error('Unable to resolve option ticker for requested contract')
}

async function fetchOptionSnapshot(input: {
  apiKey: string
  symbol: string
  optionTicker: string
}): Promise<MassiveSnapshotRow> {
  const candidates = toSnapshotCandidates(input.symbol)
  let lastError: Error | null = null

  for (const candidate of candidates) {
    try {
      const url = withApiKey(
        new URL(`/v3/snapshot/options/${candidate}/${input.optionTicker}`, MASSIVE_API_BASE),
        input.apiKey,
      )
      const payload = await fetchMassiveJson(url)
      const row = normalizeSnapshotRow(payload)
      if (row) return row
      lastError = new Error('Empty snapshot response')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('Failed to fetch option snapshot')
}

function normalizeIv(iv: number | null): number | null {
  if (iv == null) return null
  if (Math.abs(iv) <= 1) return iv * 100
  return iv
}

function toIsoTimestamp(rawTimestamp: number | null): string | null {
  if (rawTimestamp == null) return null
  if (!Number.isFinite(rawTimestamp)) return null

  let epochMs = rawTimestamp
  if (rawTimestamp > 1e14) {
    epochMs = rawTimestamp / 1e6
  } else if (rawTimestamp > 1e12) {
    epochMs = rawTimestamp
  } else if (rawTimestamp > 1e10) {
    epochMs = rawTimestamp
  } else {
    epochMs = rawTimestamp * 1000
  }

  if (!Number.isFinite(epochMs)) return null
  return new Date(epochMs).toISOString()
}

export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = quoteQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
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

  try {
    const optionTicker = parsed.data.optionTicker
      ? parsed.data.optionTicker
      : await resolveOptionTicker({
          apiKey,
          symbol,
          expiration: parsed.data.expiration!,
          strike: parsed.data.strike!,
          optionType: parsed.data.optionType!,
        })

    const snapshot = await fetchOptionSnapshot({
      apiKey,
      symbol,
      optionTicker,
    })

    const bid = toFiniteNumber(snapshot.last_quote?.bid)
    const ask = toFiniteNumber(snapshot.last_quote?.ask)
    const last = toFiniteNumber(snapshot.day?.close)
    const mark = bid != null && ask != null
      ? (bid + ask) / 2
      : (last ?? bid ?? ask ?? null)

    return NextResponse.json({
      success: true,
      quote: {
        optionTicker: toNullableString(snapshot.details?.ticker) ?? toNullableString(snapshot.ticker) ?? optionTicker,
        bid,
        ask,
        last,
        mark,
        impliedVolatility: normalizeIv(toFiniteNumber(snapshot.implied_volatility)),
        delta: toFiniteNumber(snapshot.greeks?.delta),
        updatedAt: toIsoTimestamp(toFiniteNumber(snapshot.last_quote?.last_updated)),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load option quote' },
      { status: 502 },
    )
  }
}

