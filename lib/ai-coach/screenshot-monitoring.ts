import {
  trackSetup,
  type ExtractedPosition,
  type PositionInput,
} from '@/lib/api/ai-coach'

export interface MonitorSyncResult {
  attempted: number
  added: number
  duplicate: number
  failed: number
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function resolveDirection(position: ExtractedPosition): 'bullish' | 'bearish' | 'neutral' {
  if (position.type === 'call') return 'bullish'
  if (position.type === 'put') return 'bearish'
  return 'neutral'
}

function buildSetupType(position: ExtractedPosition): string {
  const strike = typeof position.strike === 'number' ? ` ${position.strike}` : ''
  const expiry = position.expiry ? ` ${position.expiry}` : ''
  const base = position.type === 'stock'
    ? 'Screenshot Stock'
    : `Screenshot ${position.type.toUpperCase()}${strike}${expiry}`
  return base.slice(0, 96)
}

function resolveEntryPrice(position: ExtractedPosition): number {
  if (typeof position.entryPrice === 'number' && Number.isFinite(position.entryPrice) && position.entryPrice > 0) {
    return position.entryPrice
  }
  if (typeof position.currentPrice === 'number' && Number.isFinite(position.currentPrice) && position.currentPrice > 0) {
    return position.currentPrice
  }
  return 0
}

export function toPositionInputFromExtracted(
  position: ExtractedPosition,
  defaultEntryDate = new Date().toISOString().slice(0, 10),
): PositionInput {
  return {
    symbol: normalizeSymbol(position.symbol),
    type: position.type,
    strike: position.strike,
    expiry: position.expiry,
    quantity: Number.isFinite(position.quantity) && position.quantity > 0 ? position.quantity : 1,
    entryPrice: resolveEntryPrice(position),
    entryDate: defaultEntryDate,
  }
}

export async function syncExtractedPositionsToMonitor(
  positions: ExtractedPosition[],
  token: string,
): Promise<MonitorSyncResult> {
  const candidates = positions.filter((position) => normalizeSymbol(position.symbol).length > 0)
  if (candidates.length === 0) {
    return { attempted: 0, added: 0, duplicate: 0, failed: 0 }
  }

  const results = await Promise.allSettled(
    candidates.map((position) => {
      const symbol = normalizeSymbol(position.symbol)
      return trackSetup(token, {
        symbol,
        setup_type: buildSetupType(position),
        direction: resolveDirection(position),
        opportunity_data: {
          source: 'screenshot_upload',
          extractedPosition: position,
          importedAt: new Date().toISOString(),
        },
        notes: `Imported from screenshot (${Math.round(position.confidence * 100)}% confidence).`,
      })
    }),
  )

  let added = 0
  let duplicate = 0
  let failed = 0

  for (const result of results) {
    if (result.status === 'rejected') {
      failed += 1
      continue
    }

    if (result.value.duplicate || !result.value.trackedSetup) {
      duplicate += 1
      continue
    }

    added += 1
  }

  return {
    attempted: candidates.length,
    added,
    duplicate,
    failed,
  }
}
