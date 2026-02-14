import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { importRequestSchema, sanitizeString } from '@/lib/validation/journal-entry'
import { sanitizeJournalWriteInput } from '@/lib/journal/sanitize-entry'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDateString(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return new Date().toISOString()
  return new Date(parsed).toISOString()
}

function normalizeDirection(value: string | undefined): 'long' | 'short' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (['sell', 's', 'short', 'put'].includes(normalized)) return 'short'
  return 'long'
}

function normalizeContractType(value: string | undefined): 'stock' | 'call' | 'put' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.includes('put')) return 'put'
  if (normalized.includes('call')) return 'call'
  return 'stock'
}

function getTextValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return undefined
}

function buildDeterministicUuid(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0]
  return parsed.toISOString().split('T')[0]
}

function numberBucket(value: number | null, precision = 4): string {
  if (value == null || !Number.isFinite(value)) return 'na'
  return value.toFixed(precision)
}

function normalizeImportedRow(row: Record<string, unknown>, broker: string) {
  const symbolRaw = getTextValue(row, ['symbol', 'Symbol', 'Ticker', 'underlying']) ?? ''
  const symbol = sanitizeString(symbolRaw.toUpperCase(), 16)

  const tradeDate = toDateString(
    getTextValue(row, ['trade_date', 'entry_date', 'Date', 'Trade Date', 'Transaction Date', 'date']),
  )

  const direction = normalizeDirection(
    getTextValue(row, ['direction', 'Direction', 'side', 'Side', 'action', 'Action', 'type', 'Type']),
  )

  const contractType = normalizeContractType(
    getTextValue(row, ['contract_type', 'Contract Type', 'position_type', 'instrument_type', 'Type']),
  )

  const entryPrice = toNumber(
    row.entry_price
    ?? row.entryPrice
    ?? row['Entry Price']
    ?? row['Avg Price']
    ?? row.price
    ?? row.Price,
  )

  const exitPrice = toNumber(
    row.exit_price
    ?? row.exitPrice
    ?? row['Exit Price']
    ?? row['Sell Price']
    ?? row['Close Price']
    ?? row.close,
  )

  const positionSize = toNumber(
    row.position_size
    ?? row.positionSize
    ?? row.quantity
    ?? row.Quantity
    ?? row.Qty,
  ) ?? 1

  const pnl = toNumber(row.pnl ?? row['P/L'] ?? row['Realized P/L'])
  const pnlPercentage = toNumber(row.pnl_percentage ?? row['P/L %'] ?? row.pnlPct)

  const strikePrice = toNumber(row.strike_price ?? row.Strike)
  const expirationDateRaw = getTextValue(row, ['expiration_date', 'Expiration', 'Expiry'])
  const expirationDate = expirationDateRaw
    ? toDateKey(toDateString(expirationDateRaw))
    : null

  const strategyRaw = getTextValue(row, ['strategy', 'Strategy', 'Tag'])
  const strategy = strategyRaw ? sanitizeString(strategyRaw, 120) : null

  const brokerLower = broker.toLowerCase()
  const contractTypeFromBroker = brokerLower === 'interactive_brokers'
    ? normalizeContractType(getTextValue(row, ['Asset Class', 'Type']))
    : contractType

  return {
    symbol,
    tradeDate,
    direction,
    contractType: contractTypeFromBroker,
    entryPrice,
    exitPrice,
    positionSize,
    pnl,
    pnlPercentage,
    strikePrice,
    expirationDate,
    strategy,
  }
}

function calculatePnl(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
  positionSize: number,
): number | null {
  if (entryPrice == null || exitPrice == null) return null
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return Math.round(perUnit * positionSize * 100) / 100
}

function calculatePnlPercentage(
  direction: 'long' | 'short',
  entryPrice: number | null,
  exitPrice: number | null,
): number | null {
  if (entryPrice == null || exitPrice == null || entryPrice === 0) return null
  const perUnit = direction === 'short' ? entryPrice - exitPrice : exitPrice - entryPrice
  return Math.round(((perUnit / entryPrice) * 100) * 10_000) / 10_000
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const validated = importRequestSchema.parse(await request.json())

    if (validated.rows.length > 500) {
      return errorResponse('Import limit exceeded (max 500 rows)', 400)
    }

    const { data: importRecord, error: importError } = await supabase
      .from('import_history')
      .insert({
        user_id: user.id,
        broker: validated.broker,
        file_name: sanitizeString(validated.fileName, 255),
        row_count: validated.rows.length,
        inserted: 0,
        duplicates: 0,
        errors: 0,
      })
      .select('id')
      .single()

    if (importError || !importRecord) {
      console.error('Failed to create import history:', importError)
      return errorResponse('Failed to initialize import history', 500)
    }

    let parseErrors = 0
    const rowsToUpsert: Array<Record<string, unknown>> = []

    for (const rawRow of validated.rows) {
      const normalized = normalizeImportedRow(rawRow, validated.broker)

      if (!normalized.symbol || normalized.symbol.length < 1) {
        parseErrors += 1
        continue
      }

      const dedupeKey = [
        user.id,
        normalized.symbol,
        toDateKey(normalized.tradeDate),
        normalized.direction,
        normalized.contractType,
        numberBucket(normalized.entryPrice),
        numberBucket(normalized.exitPrice),
        numberBucket(normalized.positionSize),
        numberBucket(normalized.strikePrice),
        normalized.expirationDate ?? 'na',
      ].join(':')
      const id = buildDeterministicUuid(dedupeKey)

      const computedPnl = normalized.pnl ?? calculatePnl(
        normalized.direction,
        normalized.entryPrice,
        normalized.exitPrice,
        normalized.positionSize,
      )

      const computedPnlPercentage = normalized.pnlPercentage ?? calculatePnlPercentage(
        normalized.direction,
        normalized.entryPrice,
        normalized.exitPrice,
      )

      const base = sanitizeJournalWriteInput({
        id,
        user_id: user.id,
        trade_date: normalized.tradeDate,
        symbol: normalized.symbol,
        direction: normalized.direction,
        contract_type: normalized.contractType,
        entry_price: normalized.entryPrice,
        exit_price: normalized.exitPrice,
        position_size: normalized.positionSize,
        pnl: computedPnl,
        pnl_percentage: computedPnlPercentage,
        strategy: normalized.strategy,
        strike_price: normalized.strikePrice,
        expiration_date: normalized.expirationDate,
        is_open: normalized.exitPrice == null,
        tags: [],
        import_id: importRecord.id,
      })

      rowsToUpsert.push({
        ...base,
        id,
        user_id: user.id,
        import_id: importRecord.id,
      })
    }

    let inserted = 0
    let duplicates = 0

    if (rowsToUpsert.length > 0) {
      const { data: upserted, error: upsertError } = await supabase
        .from('journal_entries')
        .upsert(rowsToUpsert, {
          onConflict: 'id',
          ignoreDuplicates: true,
        })
        .select('id')

      if (upsertError) {
        console.error('Failed to import journal rows:', upsertError)
        parseErrors += rowsToUpsert.length
      } else {
        inserted = upserted?.length ?? 0
        duplicates = Math.max(0, rowsToUpsert.length - inserted)
      }
    }

    await supabase
      .from('import_history')
      .update({
        inserted,
        duplicates,
        errors: parseErrors,
      })
      .eq('id', importRecord.id)

    return successResponse({
      importId: importRecord.id,
      inserted,
      duplicates,
      errors: parseErrors,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('Journal import failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
