import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { importRequestSchema, importTradeRowSchema, sanitizeString } from '@/lib/validation/journal-entry'
import { sanitizeJournalWriteInput } from '@/lib/journal/sanitize-entry'
import { normalizeImportedRow } from '@/lib/journal/import-normalization'

function buildDeterministicUuid(key: string): string {
  const hex = createHash('sha256').update(key).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0]
  return parsed.toISOString().split('T')[0]
}

function toTimestampKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'na'
  return parsed.toISOString().slice(0, 19)
}

function numberBucket(value: number | null, precision = 4): string {
  if (value == null || !Number.isFinite(value)) return 'na'
  return value.toFixed(precision)
}

function normalizeFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toReferenceToken(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value !== 'string') return null
  const next = value.trim()
  if (!next) return null
  return next.replace(/\s+/g, '').slice(0, 80)
}

function extractBrokerReference(row: Record<string, unknown>): string | null {
  const candidateKeys = new Set([
    'orderid',
    'tradeid',
    'executionid',
    'execid',
    'fillid',
    'activityid',
    'transactionid',
    'referencenumber',
    'confirmationnumber',
    'ordernumber',
  ])

  for (const [key, value] of Object.entries(row)) {
    if (!candidateKeys.has(normalizeFieldKey(key))) continue
    const token = toReferenceToken(value)
    if (token) return token
  }

  return null
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

    let importId: string | null = importRecord?.id ?? null

    if (importError || !importRecord) {
      const recoverableImportHistoryCodes = new Set(['42P01', '42501', '42703'])
      const code = typeof importError?.code === 'string' ? importError.code : null
      const isRecoverableHistoryFailure = code != null && recoverableImportHistoryCodes.has(code)

      if (!isRecoverableHistoryFailure) {
        console.error('Failed to create import history:', importError)
        return errorResponse('Failed to initialize import history', 500)
      }

      console.warn('Import history unavailable, continuing without history tracking', {
        code: importError?.code,
        message: importError?.message,
        details: importError?.details,
        hint: importError?.hint,
      })
      importId = null
    }

    let parseErrors = 0
    const rowsToUpsert: Array<Record<string, unknown>> = []

    for (const rawRow of validated.rows) {
      const parsedRow = importTradeRowSchema.safeParse(rawRow)
      if (!parsedRow.success) {
        parseErrors += 1
        continue
      }

      const normalized = normalizeImportedRow(parsedRow.data, validated.broker)

      if (!normalized.symbol || normalized.symbol.length < 1) {
        parseErrors += 1
        continue
      }

      const brokerReference = extractBrokerReference(parsedRow.data)
      const dedupeKey = [
        user.id,
        validated.broker,
        normalized.symbol,
        toDateKey(normalized.tradeDate),
        toTimestampKey(normalized.tradeDate),
        normalized.direction,
        normalized.contractType,
        numberBucket(normalized.entryPrice),
        numberBucket(normalized.exitPrice),
        numberBucket(normalized.positionSize),
        numberBucket(normalized.strikePrice),
        normalized.expirationDate ?? 'na',
        brokerReference ?? 'na',
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
        import_id: importId,
      })

      rowsToUpsert.push({
        ...base,
        id,
        user_id: user.id,
        import_id: importId,
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

    if (importId) {
      await supabase
        .from('import_history')
        .update({
          inserted,
          duplicates,
          errors: parseErrors,
        })
        .eq('id', importId)
    }

    return successResponse({
      importId,
      inserted,
      duplicates,
      errors: parseErrors,
      historyTracked: Boolean(importId),
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('Journal import failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
