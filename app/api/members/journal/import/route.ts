import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId, getSupabaseAdminClient } from '@/lib/api/member-auth'
import { importTradesSchema } from '@/lib/validation/journal-api'

type ContractType = 'stock' | 'call' | 'put' | 'spread'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDirection(value?: string): 'long' | 'short' {
  const normalized = value?.toLowerCase().trim() || ''
  if (['sell', 'short', 's', 'put'].includes(normalized)) return 'short'
  return 'long'
}

function normalizeContractType(value?: string): ContractType {
  const normalized = value?.toLowerCase().trim() || ''
  if (normalized.includes('spread')) return 'spread'
  if (normalized.includes('put')) return 'put'
  if (normalized.includes('call')) return 'call'
  return 'stock'
}

function normalizeDate(value?: string): string {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function priceWithinTolerance(a: number | null, b: number | null, tolerancePct = 0.01): boolean {
  if (a == null || b == null) return false
  if (a === 0) return Math.abs(b) < 0.0001
  return Math.abs(a - b) / Math.abs(a) <= tolerancePct
}

function brokerRowValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim()) return String(value)
  }
  return undefined
}

function normalizeImportedRow(row: Record<string, unknown>, broker: string) {
  const normalizedBroker = broker.toLowerCase()

  const symbol = (brokerRowValue(row, ['symbol', 'Symbol', 'Ticker']) || '').toUpperCase().trim()
  const tradeDate = normalizeDate(
    brokerRowValue(row, ['trade_date', 'entry_date', 'Date', 'Trade Date', 'Transaction Date', 'entryDate']),
  )
  const direction = normalizeDirection(
    brokerRowValue(row, ['direction', 'Action', 'Side', 'type', 'position_type']),
  )
  const entryPrice = toNumber(row.entry_price ?? row.entryPrice ?? row['Avg Price'] ?? row['Price'])
  const exitPrice = toNumber(row.exit_price ?? row.exitPrice ?? row['Sell Price'])
  const size = toNumber(row.position_size ?? row.quantity ?? row.Qty ?? row.Quantity) ?? 1
  const pnl = toNumber(row.pnl ?? row['P/L'] ?? row['Realized P/L'])
  const pnlPct = toNumber(row.pnl_percentage ?? row.pnl_pct)
  const strategy = brokerRowValue(row, ['strategy', 'Strategy', 'Tag'])

  let contractType: ContractType = normalizeContractType(
    brokerRowValue(row, ['contract_type', 'position_type', 'Type']),
  )

  const strikePrice = toNumber(row.strike_price ?? row.Strike)
  const expirationDate = brokerRowValue(row, ['expiration_date', 'Expiry', 'Expiration'])

  if (normalizedBroker.includes('interactive') || normalizedBroker.includes('ib')) {
    contractType = normalizeContractType(String(row['Asset Class'] ?? row['Type'] ?? 'stock'))
  }
  if (normalizedBroker.includes('robinhood') || normalizedBroker.includes('webull')) {
    contractType = normalizeContractType(String(row['instrument_type'] ?? row['Type'] ?? contractType))
  }
  if (normalizedBroker.includes('schwab') || normalizedBroker.includes('ameritrade')) {
    contractType = normalizeContractType(String(row['Security Type'] ?? row['Type'] ?? contractType))
  }

  return {
    symbol,
    tradeDate,
    direction,
    entryPrice,
    exitPrice,
    size,
    pnl,
    pnlPct,
    strategy,
    contractType,
    strikePrice,
    expirationDate: expirationDate || null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = importTradesSchema.parse(await request.json())
    const supabase = getSupabaseAdminClient()

    const { data: importRecord, error: importCreateError } = await supabase
      .from('import_history')
      .insert({
        user_id: userId,
        broker_name: parsed.broker,
        file_name: parsed.fileName,
        record_count: parsed.rows.length,
        status: 'processing',
      })
      .select('id')
      .single()

    if (importCreateError || !importRecord) {
      return NextResponse.json({ success: false, error: importCreateError?.message || 'Failed to initialize import' }, { status: 500 })
    }

    const normalizedRows = parsed.rows.map((row) => normalizeImportedRow(row as Record<string, unknown>, parsed.broker))
      .filter((row) => row.symbol.length > 0)

    const symbols = Array.from(new Set(normalizedRows.map((row) => row.symbol)))
    const tradeDates = normalizedRows.map((row) => row.tradeDate)
    const earliest = tradeDates.reduce((min, value) => value < min ? value : min, tradeDates[0] || new Date().toISOString())
    const latest = tradeDates.reduce((max, value) => value > max ? value : max, tradeDates[0] || new Date().toISOString())

    const { data: existingRows, error: existingError } = await supabase
      .from('journal_entries')
      .select('id,symbol,trade_date,entry_price')
      .eq('user_id', userId)
      .in('symbol', symbols)
      .gte('trade_date', earliest)
      .lte('trade_date', latest)

    if (existingError) {
      return NextResponse.json({ success: false, error: existingError.message }, { status: 500 })
    }

    const existing = existingRows || []
    const insertPayload: Array<Record<string, unknown>> = []
    let duplicateCount = 0

    for (const row of normalizedRows) {
      const rowDate = row.tradeDate.split('T')[0]
      const duplicate = existing.some((entry) => {
        const sameSymbol = typeof entry.symbol === 'string' && entry.symbol === row.symbol
        const sameDay = typeof entry.trade_date === 'string' && entry.trade_date.split('T')[0] === rowDate
        const samePrice = priceWithinTolerance(toNumber(entry.entry_price), row.entryPrice, 0.01)
        return sameSymbol && sameDay && samePrice
      })

      if (duplicate) {
        duplicateCount += 1
        continue
      }

      const computedPnl = row.pnl ?? (
        row.entryPrice != null && row.exitPrice != null
          ? (row.direction === 'short' ? row.entryPrice - row.exitPrice : row.exitPrice - row.entryPrice) * row.size
          : null
      )
      const computedPnlPct = row.pnlPct ?? (
        row.entryPrice != null && row.entryPrice !== 0 && row.exitPrice != null
          ? ((row.direction === 'short' ? row.entryPrice - row.exitPrice : row.exitPrice - row.entryPrice) / row.entryPrice) * 100
          : null
      )

      insertPayload.push({
        user_id: userId,
        trade_date: row.tradeDate,
        symbol: row.symbol,
        direction: row.direction,
        entry_price: row.entryPrice,
        exit_price: row.exitPrice,
        position_size: row.size,
        pnl: computedPnl,
        pnl_percentage: computedPnlPct,
        is_winner: computedPnl == null ? null : computedPnl > 0 ? true : computedPnl < 0 ? false : null,
        strategy: row.strategy || null,
        contract_type: row.contractType,
        strike_price: row.strikePrice,
        expiration_date: row.expirationDate,
        tags: [],
        is_open: row.exitPrice == null,
      })
    }

    let insertedCount = 0
    let errorCount = 0

    if (insertPayload.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('journal_entries')
        .insert(insertPayload)
        .select('id')

      if (insertError) {
        errorCount = insertPayload.length
      } else {
        insertedCount = inserted?.length || 0
      }
    }

    await supabase
      .from('import_history')
      .update({
        success_count: insertedCount,
        duplicate_count: duplicateCount,
        error_count: errorCount,
        status: errorCount > 0 ? 'failed' : 'completed',
      })
      .eq('id', importRecord.id)

    return NextResponse.json({
      success: true,
      data: {
        importId: importRecord.id,
        inserted: insertedCount,
        duplicates: duplicateCount,
        errors: errorCount,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ success: false, error: 'Invalid import payload' }, { status: 400 })
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
