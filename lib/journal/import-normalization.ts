import { parseNumericInput } from '@/lib/journal/number-parsing'

export type ImportBroker =
  | 'generic'
  | 'interactive_brokers'
  | 'schwab'
  | 'robinhood'
  | 'etrade'
  | 'fidelity'
  | 'webull'

export interface NormalizedImportedRow {
  symbol: string
  tradeDate: string
  direction: 'long' | 'short'
  contractType: 'stock' | 'call' | 'put'
  entryPrice: number | null
  exitPrice: number | null
  positionSize: number
  pnl: number | null
  pnlPercentage: number | null
  strikePrice: number | null
  expirationDate: string | null
  strategy: string | null
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const next = value.trim()
  return next.length > 0 ? next : null
}

function getTextValue(row: Record<string, unknown>, keys: string[]): string | undefined {
  const normalizedMap = new Map<string, unknown>()
  for (const [key, value] of Object.entries(row)) {
    normalizedMap.set(normalizeKey(key), value)
  }

  for (const key of keys) {
    const direct = row[key]
    const directString = asString(direct)
    if (directString) return directString

    const normalized = normalizedMap.get(normalizeKey(key))
    const normalizedString = asString(normalized)
    if (normalizedString) return normalizedString
  }

  return undefined
}

function toNumber(value: unknown): number | null {
  const parsed = parseNumericInput(value)
  return parsed.valid ? parsed.value : null
}

function toDateString(value: string | undefined): string {
  if (!value) return new Date().toISOString()
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return new Date().toISOString()
  return new Date(parsed).toISOString()
}

function toDateKey(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0]
  return parsed.toISOString().split('T')[0]
}

function normalizeDirection(value: string | undefined): 'long' | 'short' | null {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return null

  // Collapse whitespace/punctuation so values like "Sell To Open" and
  // "sell_to_open" map to the same token.
  const token = normalized.replace(/[^a-z]/g, '')

  if ([
    'short',
    'sellshort',
    'sto',
    'selltoopen',
    'closeshort',
    'buytoclose',
    'btc',
    'buytocover',
    'cover',
  ].includes(token)) return 'short'

  if ([
    'long',
    'buy',
    'b',
    'bto',
    'buytoopen',
    'selltoclose',
    'stc',
    'closelong',
  ].includes(token)) return 'long'

  return null
}

function normalizeContractType(value: string | undefined): 'stock' | 'call' | 'put' {
  const normalized = (value ?? '').trim().toLowerCase()
  if (normalized.includes('put')) return 'put'
  if (normalized.includes('call')) return 'call'
  return 'stock'
}

function parseOccOptionSymbol(raw: string): {
  root: string
  expiry: string
  optionType: 'call' | 'put'
  strike: number
} | null {
  const compact = raw.replace(/\s+/g, '')
  const match = compact.match(/^([A-Z.]{1,6})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/)
  if (!match) return null

  const yy = Number(match[2])
  const mm = Number(match[3])
  const dd = Number(match[4])
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  const strike = Number(match[6]) / 1000

  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(strike)) return null

  return {
    root: match[1],
    expiry: `${year.toString().padStart(4, '0')}-${mm.toString().padStart(2, '0')}-${dd.toString().padStart(2, '0')}`,
    optionType: match[5] === 'P' ? 'put' : 'call',
    strike,
  }
}

function extractSymbolFromCandidate(raw: string | undefined): string {
  if (!raw) return ''
  const uppercase = raw.trim().toUpperCase()
  if (!uppercase) return ''

  const tokenized = uppercase.split(/\s+/)[0] || uppercase
  const occ = parseOccOptionSymbol(tokenized) ?? parseOccOptionSymbol(uppercase)
  if (occ) return occ.root.slice(0, 16)

  return tokenized.replace(/[^A-Z0-9./]/g, '').slice(0, 16)
}

function deriveOptionMeta(row: Record<string, unknown>): { strike: number | null; expiry: string | null; type: 'call' | 'put' | null } {
  const explicitStrike = toNumber(getTextValue(row, ['strike_price', 'Strike', 'strike']))
  const explicitExpiryRaw = getTextValue(row, ['expiration_date', 'Expiration', 'Expiry', 'expiration', 'exp_date'])
  const explicitExpiry = explicitExpiryRaw ? toDateKey(toDateString(explicitExpiryRaw)) : null

  const name = getTextValue(row, ['Name', 'name', 'description', 'Description'])
  const symbolRaw = getTextValue(row, ['Symbol', 'symbol', 'Ticker'])
  const occFromSymbol = symbolRaw ? parseOccOptionSymbol(symbolRaw.toUpperCase()) : null
  const occFromName = name ? parseOccOptionSymbol(name.toUpperCase().replace(/\s+/g, '')) : null
  const occ = occFromSymbol ?? occFromName

  const nameTypeMatch = name?.toUpperCase().match(/\b([CP])\b/)
  const nameType = nameTypeMatch?.[1] === 'P' ? 'put' : nameTypeMatch?.[1] === 'C' ? 'call' : null
  const nameStrikeMatch = name?.match(/\b(\d+(?:\.\d+)?)\s*[CP]\b/i)
  const nameStrike = nameStrikeMatch ? Number(nameStrikeMatch[1]) : null
  const nameDateMatch = name?.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/)
  const nameExpiry = nameDateMatch ? toDateKey(toDateString(nameDateMatch[1])) : null

  return {
    strike: explicitStrike ?? occ?.strike ?? (Number.isFinite(nameStrike) ? nameStrike : null),
    expiry: explicitExpiry ?? occ?.expiry ?? nameExpiry ?? null,
    type: occ?.optionType ?? nameType,
  }
}

export function normalizeImportedRow(row: Record<string, unknown>, broker: ImportBroker): NormalizedImportedRow {
  const symbolCandidate = getTextValue(row, [
    'symbol',
    'Symbol',
    'Ticker',
    'Ticker Symbol',
    'underlying',
    'Underlying',
    'Underlying Symbol',
    'Instrument',
    'Security Symbol',
    'Name',
  ])
  const symbol = extractSymbolFromCandidate(symbolCandidate)

  const tradeDate = toDateString(
    getTextValue(row, [
      'trade_date',
      'entry_date',
      'Date',
      'Trade Date',
      'Transaction Date',
      'date',
      'Filled Time',
      'Placed Time',
      'Order Time',
      'Execution Time',
      'Execution Date',
      'Executed At',
      'Timestamp',
    ]),
  )

  const directionSignal = getTextValue(row, [
    'direction',
    'Direction',
    'side',
    'Side',
    'action',
    'Action',
    'Buy/Sell',
    'Transaction Type',
  ])

  const optionMeta = deriveOptionMeta(row)

  const explicitContractType = normalizeContractType(
    getTextValue(row, ['contract_type', 'Contract Type', 'position_type', 'instrument_type', 'Type', 'Asset Class']),
  )
  const contractTypeFromHints = optionMeta.type ?? null
  const contractType = contractTypeFromHints ?? explicitContractType

  const entryPrice = toNumber(
    getTextValue(row, [
      'entry_price',
      'entryPrice',
      'Entry Price',
      'Avg Price',
      'Average Price',
      'avg_price',
      'price',
      'Price',
      'Fill Price',
    ]),
  )

  const exitPrice = toNumber(
    getTextValue(row, [
      'exit_price',
      'exitPrice',
      'Exit Price',
      'Sell Price',
      'Close Price',
      'close',
      'Close',
    ]),
  )

  const quantityValue = toNumber(
    getTextValue(row, [
      'position_size',
      'positionSize',
      'quantity',
      'Quantity',
      'Qty',
      'Filled',
      'Filled Qty',
      'Total Qty',
      'total_quantity',
      'Qty.',
      'Shares',
      'Executed Quantity',
    ]),
  )

  const directionFromSignal = normalizeDirection(directionSignal)
  const direction = quantityValue != null && quantityValue !== 0
    ? (quantityValue < 0 ? 'short' : 'long')
    : (directionFromSignal ?? 'long')

  const positionSize = Math.abs(quantityValue ?? 1)

  const pnl = toNumber(getTextValue(row, ['pnl', 'P/L', 'Realized P/L', 'Realized PnL']))
  const pnlPercentage = toNumber(getTextValue(row, ['pnl_percentage', 'P/L %', 'pnlPct', 'Return %']))

  const strategyRaw = getTextValue(row, ['strategy', 'Strategy', 'Tag'])
  const strategy = strategyRaw ? strategyRaw.slice(0, 120) : null

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
    strikePrice: optionMeta.strike,
    expirationDate: optionMeta.expiry,
    strategy,
  }
}
