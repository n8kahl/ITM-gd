import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const MASSIVE_API_BASE = 'https://api.massive.com'
const INDEX_UNDERLYINGS = new Set(['SPX', 'NDX', 'RUT', 'VIX', 'DJX'])
const MAX_PAGES = 12

const chainQuerySchema = z.object({
  symbol: z.string().trim().min(1),
  expiration: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  strikesPerSide: z.coerce.number().int().min(1).max(30).default(10),
  offsetAbove: z.coerce.number().int().min(0).max(200).default(0),
  offsetBelow: z.coerce.number().int().min(0).max(200).default(0),
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
    strike_price?: number
    contract_type?: 'call' | 'put' | string
    expiration_date?: string
  }
  day?: {
    close?: number
    volume?: number
    open_interest?: number
  }
  last_quote?: {
    bid?: number
    ask?: number
  }
  greeks?: {
    delta?: number
  }
  implied_volatility?: number
  open_interest?: number
}

interface ChainContract {
  ticker: string
  strike: number
  type: 'call' | 'put'
}

interface ChainSide {
  bid: number | null
  ask: number | null
  last: number | null
  delta: number | null
  iv: number | null
  volume: number | null
  oi: number | null
  ticker: string
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

function toAggregateTicker(symbol: string): string {
  return INDEX_UNDERLYINGS.has(symbol) ? `I:${symbol}` : symbol
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

function normalizeContractsRows(payload: unknown): MassiveContractsRow[] {
  if (!payload || typeof payload !== 'object') return []
  const rows = (payload as { results?: unknown }).results
  if (!Array.isArray(rows)) return []
  return rows as MassiveContractsRow[]
}

function normalizeSnapshotRows(payload: unknown): MassiveSnapshotRow[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = (payload as { results?: unknown }).results
  if (Array.isArray(raw)) return raw as MassiveSnapshotRow[]
  if (raw && typeof raw === 'object') return [raw as MassiveSnapshotRow]
  return []
}

function readNextUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  return toNullableString((payload as { next_url?: unknown }).next_url)
}

async function fetchAllContracts(input: {
  apiKey: string
  symbol: string
  expiration: string
}): Promise<ChainContract[]> {
  const contracts: ChainContract[] = []
  let pageCount = 0

  let nextUrl: URL | null = withApiKey(new URL('/v3/reference/options/contracts', MASSIVE_API_BASE), input.apiKey)
  nextUrl.searchParams.set('underlying_ticker', input.symbol)
  nextUrl.searchParams.set('expiration_date', input.expiration)
  nextUrl.searchParams.set('sort', 'strike_price')
  nextUrl.searchParams.set('order', 'asc')
  nextUrl.searchParams.set('limit', '1000')

  while (nextUrl && pageCount < MAX_PAGES) {
    const payload = await fetchMassiveJson(nextUrl)
    const rows = normalizeContractsRows(payload)
    for (const row of rows) {
      const ticker = toNullableString(row.ticker)
      const strike = toFiniteNumber(row.strike_price)
      const contractType = row.contract_type === 'put' ? 'put' : row.contract_type === 'call' ? 'call' : null
      const expirationDate = toNullableString(row.expiration_date)
      if (!ticker || strike == null || !contractType || expirationDate !== input.expiration) continue

      contracts.push({
        ticker,
        strike,
        type: contractType,
      })
    }

    const rawNextUrl = readNextUrl(payload)
    nextUrl = rawNextUrl ? withApiKey(new URL(rawNextUrl), input.apiKey) : null
    pageCount += 1
  }

  const deduped = new Map<string, ChainContract>()
  for (const row of contracts) {
    deduped.set(`${row.ticker}:${row.type}:${row.strike}`, row)
  }
  return [...deduped.values()].sort((left, right) => left.strike - right.strike)
}

async function fetchUnderlyingPrice(input: { apiKey: string; symbol: string }): Promise<{
  last: number | null
  change: number | null
  changePct: number | null
}> {
  const ticker = toAggregateTicker(input.symbol)
  const url = withApiKey(new URL(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev`, MASSIVE_API_BASE), input.apiKey)
  const payload = await fetchMassiveJson(url)
  const rows = (payload as { results?: unknown }).results
  const first = Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object'
    ? rows[0] as { c?: unknown; o?: unknown }
    : null
  const close = toFiniteNumber(first?.c)
  const open = toFiniteNumber(first?.o)
  const change = close != null && open != null ? close - open : null
  const changePct = close != null && open != null && open !== 0
    ? (change! / Math.abs(open)) * 100
    : null

  return {
    last: close,
    change,
    changePct,
  }
}

async function fetchSnapshotsForExpiration(input: {
  apiKey: string
  symbol: string
  expiration: string
}): Promise<MassiveSnapshotRow[]> {
  let lastError: Error | null = null
  const candidates = toSnapshotCandidates(input.symbol)

  for (const candidate of candidates) {
    try {
      let pageCount = 0
      let nextUrl: URL | null = withApiKey(new URL(`/v3/snapshot/options/${candidate}`, MASSIVE_API_BASE), input.apiKey)
      nextUrl.searchParams.set('expiration_date', input.expiration)
      nextUrl.searchParams.set('limit', '250')

      const snapshots: MassiveSnapshotRow[] = []
      while (nextUrl && pageCount < MAX_PAGES) {
        const payload = await fetchMassiveJson(nextUrl)
        snapshots.push(...normalizeSnapshotRows(payload))
        const rawNextUrl = readNextUrl(payload)
        nextUrl = rawNextUrl ? withApiKey(new URL(rawNextUrl), input.apiKey) : null
        pageCount += 1
      }

      const filtered = snapshots.filter((snapshot) => {
        const expirationDate = toNullableString(snapshot.details?.expiration_date)
        return !expirationDate || expirationDate === input.expiration
      })
      return filtered
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error('Failed to fetch options snapshots')
}

function nearestStrike(strikes: number[], reference: number): number {
  if (strikes.length === 0) return 0
  return strikes.reduce((best, current) =>
    Math.abs(current - reference) < Math.abs(best - reference) ? current : best, strikes[0])
}

function normalizeIv(iv: number | null): number | null {
  if (iv == null) return null
  if (Math.abs(iv) <= 1) {
    return iv * 100
  }
  return iv
}

function mapChainSide(contract: ChainContract | undefined, snapshotByTicker: Map<string, MassiveSnapshotRow>): ChainSide | null {
  if (!contract) return null
  const snapshot = snapshotByTicker.get(contract.ticker.toUpperCase())

  const bid = toFiniteNumber(snapshot?.last_quote?.bid)
  const ask = toFiniteNumber(snapshot?.last_quote?.ask)
  const last = toFiniteNumber(snapshot?.day?.close)
  const delta = toFiniteNumber(snapshot?.greeks?.delta)
  const iv = normalizeIv(toFiniteNumber(snapshot?.implied_volatility))
  const volume = toFiniteNumber(snapshot?.day?.volume)
  const oi = toFiniteNumber(snapshot?.open_interest) ?? toFiniteNumber(snapshot?.day?.open_interest)

  return {
    bid,
    ask,
    last,
    delta,
    iv,
    volume,
    oi,
    ticker: contract.ticker,
  }
}

export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = chainQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
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
  const expiration = parsed.data.expiration
  const strikesPerSide = parsed.data.strikesPerSide
  const offsetAbove = parsed.data.offsetAbove
  const offsetBelow = parsed.data.offsetBelow

  try {
    const [contracts, underlying, snapshots] = await Promise.all([
      fetchAllContracts({ apiKey, symbol, expiration }),
      fetchUnderlyingPrice({ apiKey, symbol }).catch(() => ({ last: null, change: null, changePct: null })),
      fetchSnapshotsForExpiration({ apiKey, symbol, expiration }).catch(() => []),
    ])

    const strikeSet = new Set<number>()
    for (const contract of contracts) {
      strikeSet.add(contract.strike)
    }
    const strikes = [...strikeSet].sort((left, right) => left - right)
    if (strikes.length === 0) {
      return NextResponse.json(
        { error: `No option contracts found for ${symbol} ${expiration}` },
        { status: 404 },
      )
    }

    const fallbackReference = strikes[Math.floor(strikes.length / 2)]
    const reference = underlying.last ?? fallbackReference
    const atmStrike = nearestStrike(strikes, reference)
    const atmIndex = Math.max(0, strikes.findIndex((value) => value === atmStrike))

    const belowDepth = strikesPerSide + offsetBelow
    const aboveDepth = strikesPerSide + offsetAbove
    const rangeStart = Math.max(0, atmIndex - belowDepth)
    const rangeEnd = Math.min(strikes.length - 1, atmIndex + aboveDepth)
    const visibleStrikes = strikes.slice(rangeStart, rangeEnd + 1)
    const visibleStrikeSet = new Set(visibleStrikes)

    const contractsByStrike = new Map<number, { call?: ChainContract; put?: ChainContract }>()
    for (const contract of contracts) {
      if (!visibleStrikeSet.has(contract.strike)) continue
      const existing = contractsByStrike.get(contract.strike) ?? {}
      if (contract.type === 'call' && !existing.call) existing.call = contract
      if (contract.type === 'put' && !existing.put) existing.put = contract
      contractsByStrike.set(contract.strike, existing)
    }

    const snapshotByTicker = new Map<string, MassiveSnapshotRow>()
    for (const snapshot of snapshots) {
      const ticker = toNullableString(snapshot.details?.ticker) ?? toNullableString(snapshot.ticker)
      if (!ticker) continue
      snapshotByTicker.set(ticker.toUpperCase(), snapshot)
    }

    const rows = visibleStrikes.map((strike) => {
      const contractsForStrike = contractsByStrike.get(strike) ?? {}
      return {
        strike,
        call: mapChainSide(contractsForStrike.call, snapshotByTicker),
        put: mapChainSide(contractsForStrike.put, snapshotByTicker),
      }
    })

    return NextResponse.json({
      success: true,
      underlying: {
        symbol,
        last: underlying.last,
        change: underlying.change,
        changePct: underlying.changePct,
      },
      expiration,
      strikes: rows,
      atmStrike,
      hasMoreAbove: rangeEnd < strikes.length - 1,
      hasMoreBelow: rangeStart > 0,
      totalStrikes: strikes.length,
      returnedStrikes: rows.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load options chain' },
      { status: 502 },
    )
  }
}
