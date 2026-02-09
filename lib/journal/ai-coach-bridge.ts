export const AI_COACH_JOURNAL_SOURCE = 'ai-coach'

const SYMBOL_STOP_WORDS = new Set([
  'A',
  'AI',
  'ALL',
  'AND',
  'ATR',
  'AT',
  'CALL',
  'DTE',
  'FOR',
  'GEX',
  'I',
  'IF',
  'IN',
  'LONG',
  'OR',
  'PUT',
  'RISK',
  'SPREAD',
  'STOP',
  'TARGET',
  'THE',
  'THIS',
  'TO',
  'VWAP',
])

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRADE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STRATEGY_KEYWORDS: Array<{ regex: RegExp; value: string }> = [
  { regex: /\borb\b|opening range/i, value: 'Opening Range' },
  { regex: /\bbreakout\b/i, value: 'Breakout' },
  { regex: /\bbreakdown\b/i, value: 'Breakdown' },
  { regex: /\bpullback\b/i, value: 'Pullback' },
  { regex: /\breversal\b/i, value: 'Reversal' },
  { regex: /\bvwap\b/i, value: 'VWAP Play' },
  { regex: /\bsupport\b/i, value: 'Support' },
  { regex: /\bresistance\b/i, value: 'Resistance' },
]

interface SearchParamReader {
  get(key: string): string | null
}

interface FunctionCallLike {
  function: string
  arguments: Record<string, unknown>
  result: unknown
}

export interface AssistantMessageLike {
  role: 'user' | 'assistant'
  content: string
  functionCalls?: FunctionCallLike[]
}

export interface JournalPrefillPayload {
  symbol: string
  direction: 'long' | 'short'
  trade_date?: string
  entry_price?: string
  stop_loss?: string
  initial_target?: string
  strategy?: string
  session_id?: string
}

interface ExtractionScratch {
  symbol: string | null
  direction: 'long' | 'short' | null
  entryPrice: number | null
  stopLoss: number | null
  initialTarget: number | null
  supportLevel: number | null
  resistanceLevel: number | null
  strategy: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseSymbolCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/^\$/, '').trim().toUpperCase()
  if (!/^[A-Z0-9._:-]{1,10}$/.test(normalized)) return null
  if (SYMBOL_STOP_WORDS.has(normalized)) return null
  return normalized
}

function parseNumberCandidate(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[^0-9.+-]/g, '')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDirectionFromText(text: string): 'long' | 'short' | null {
  const normalized = text.toLowerCase()
  if (/\b(short|bearish|put|sell)\b/.test(normalized)) return 'short'
  if (/\b(long|bullish|call|buy)\b/.test(normalized)) return 'long'
  return null
}

function parseDirectionFromType(value: unknown): 'long' | 'short' | null {
  if (typeof value !== 'string') return null
  const normalized = value.toLowerCase()
  if (normalized.includes('put') || normalized.includes('short') || normalized.includes('bear')) return 'short'
  if (normalized.includes('call') || normalized.includes('long') || normalized.includes('bull')) return 'long'
  return null
}

function parseTradeDateCandidate(value: string | null): string | undefined {
  if (!value) return undefined
  return TRADE_DATE_PATTERN.test(value) ? value : undefined
}

function parseLevelFromText(content: string, pattern: RegExp): number | null {
  const match = content.match(pattern)
  if (!match?.[1]) return null
  return parseNumberCandidate(match[1])
}

function parseStrategyFromText(content: string): string | null {
  for (const keyword of STRATEGY_KEYWORDS) {
    if (keyword.regex.test(content)) return keyword.value
  }
  return null
}

function firstPriceFromLevels(levels: unknown): number | null {
  if (!Array.isArray(levels) || levels.length === 0) return null
  const first = levels[0]
  if (!isRecord(first)) return null
  return parseNumberCandidate(first.price)
}

function setIfEmpty<T>(current: T | null, next: T | null): T | null {
  if (current != null) return current
  return next
}

function setSymbolIfEmpty(scratch: ExtractionScratch, candidate: unknown) {
  if (scratch.symbol) return
  scratch.symbol = parseSymbolCandidate(candidate)
}

function setDirectionIfEmpty(scratch: ExtractionScratch, candidate: unknown) {
  if (scratch.direction) return
  scratch.direction = parseDirectionFromType(candidate)
}

function setEntryPriceIfEmpty(scratch: ExtractionScratch, candidate: unknown) {
  scratch.entryPrice = setIfEmpty(scratch.entryPrice, parseNumberCandidate(candidate))
}

function mergeFromFunctionCall(scratch: ExtractionScratch, call: FunctionCallLike) {
  const args = isRecord(call.arguments) ? call.arguments : {}
  const result = isRecord(call.result) ? call.result : {}

  setSymbolIfEmpty(scratch, args.symbol)
  setSymbolIfEmpty(scratch, result.symbol)
  setDirectionIfEmpty(scratch, args.direction)
  setDirectionIfEmpty(scratch, args.type)
  setDirectionIfEmpty(scratch, result.direction)
  setDirectionIfEmpty(scratch, result.type)
  setEntryPriceIfEmpty(scratch, args.entryPrice)
  setEntryPriceIfEmpty(scratch, result.entryPrice)
  setEntryPriceIfEmpty(scratch, result.currentPrice)
  setEntryPriceIfEmpty(scratch, result.price)
  setEntryPriceIfEmpty(scratch, result.spotPrice)

  switch (call.function) {
    case 'get_key_levels':
    case 'get_spx_game_plan': {
      const levels = isRecord(result.levels) ? result.levels : isRecord(result.keyLevels) ? result.keyLevels : null
      if (levels) {
        scratch.supportLevel = setIfEmpty(scratch.supportLevel, firstPriceFromLevels(levels.support))
        scratch.resistanceLevel = setIfEmpty(scratch.resistanceLevel, firstPriceFromLevels(levels.resistance))
      }
      break
    }
    case 'scan_opportunities': {
      if (!Array.isArray(result.opportunities) || result.opportunities.length === 0) break
      const first = result.opportunities[0]
      if (!isRecord(first)) break
      setSymbolIfEmpty(scratch, first.symbol)
      setDirectionIfEmpty(scratch, first.direction)
      setEntryPriceIfEmpty(scratch, first.currentPrice)
      if (!scratch.strategy && typeof first.setupType === 'string') {
        scratch.strategy = first.setupType.trim() || null
      }
      break
    }
    case 'analyze_position': {
      const position = isRecord(args.position)
        ? args.position
        : Array.isArray(args.positions) && args.positions.length > 0 && isRecord(args.positions[0])
        ? args.positions[0]
        : isRecord(result.position)
        ? result.position
        : null

      if (!position) break
      setSymbolIfEmpty(scratch, position.symbol)
      setDirectionIfEmpty(scratch, position.type)
      setEntryPriceIfEmpty(scratch, position.entryPrice)
      break
    }
    default:
      break
  }
}

function formatPrefillPrice(value: number | null): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  if (value <= 0) return undefined
  return value.toFixed(2)
}

function readDirection(value: string | null): 'long' | 'short' | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  if (normalized === 'long' || normalized === 'short') return normalized
  return undefined
}

function readPrice(value: string | null): string | undefined {
  const parsed = parseNumberCandidate(value)
  if (parsed == null || parsed <= 0) return undefined
  return parsed.toFixed(2)
}

function readStrategy(value: string | null): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized.slice(0, 120) : undefined
}

function readSessionId(value: string | null): string | undefined {
  if (!value) return undefined
  return SESSION_ID_PATTERN.test(value) ? value : undefined
}

export function extractJournalPrefillFromAssistantMessage(
  message: AssistantMessageLike,
): JournalPrefillPayload | null {
  if (message.role !== 'assistant') return null

  const scratch: ExtractionScratch = {
    symbol: null,
    direction: null,
    entryPrice: null,
    stopLoss: null,
    initialTarget: null,
    supportLevel: null,
    resistanceLevel: null,
    strategy: null,
  }

  for (const call of message.functionCalls || []) {
    mergeFromFunctionCall(scratch, call)
  }

  const content = message.content || ''
  const contentDirection = parseDirectionFromText(content)
  scratch.direction = scratch.direction || contentDirection

  if (!scratch.symbol) {
    const symbolMatches = content.toUpperCase().match(/\$?[A-Z]{1,5}\b/g) || []
    for (const candidate of symbolMatches) {
      const symbol = parseSymbolCandidate(candidate)
      if (symbol) {
        scratch.symbol = symbol
        break
      }
    }
  }

  scratch.entryPrice = setIfEmpty(
    scratch.entryPrice,
    parseLevelFromText(content, /\b(?:entry|enter(?:ed)?|buy(?:ing)?|sell(?:ing)?)\D{0,18}\$?([0-9]+(?:\.[0-9]{1,2})?)/i),
  )
  scratch.stopLoss = setIfEmpty(
    scratch.stopLoss,
    parseLevelFromText(content, /\b(?:stop|stop[- ]?loss|invalidat(?:e|ion))\D{0,18}\$?([0-9]+(?:\.[0-9]{1,2})?)/i),
  )
  scratch.initialTarget = setIfEmpty(
    scratch.initialTarget,
    parseLevelFromText(content, /\b(?:target|take profit|tp)\D{0,18}\$?([0-9]+(?:\.[0-9]{1,2})?)/i),
  )
  scratch.strategy = scratch.strategy || parseStrategyFromText(content)

  const inferredDirection: 'long' | 'short' = scratch.direction
    || (
      scratch.entryPrice != null
        && scratch.supportLevel != null
        && scratch.resistanceLevel != null
        && scratch.supportLevel > scratch.entryPrice
        && scratch.resistanceLevel < scratch.entryPrice
      ? 'short'
      : 'long'
    )

  if (scratch.stopLoss == null) {
    scratch.stopLoss = inferredDirection === 'short' ? scratch.resistanceLevel : scratch.supportLevel
  }
  if (scratch.initialTarget == null) {
    scratch.initialTarget = inferredDirection === 'short' ? scratch.supportLevel : scratch.resistanceLevel
  }

  if (!scratch.symbol) return null

  return {
    symbol: scratch.symbol,
    direction: inferredDirection,
    entry_price: formatPrefillPrice(scratch.entryPrice),
    stop_loss: formatPrefillPrice(scratch.stopLoss),
    initial_target: formatPrefillPrice(scratch.initialTarget),
    strategy: scratch.strategy || undefined,
  }
}

export function buildJournalPrefillSearchParams(prefill: JournalPrefillPayload): URLSearchParams {
  const params = new URLSearchParams()
  params.set('new', '1')
  params.set('source', AI_COACH_JOURNAL_SOURCE)
  params.set('symbol', prefill.symbol.toUpperCase())
  params.set('direction', prefill.direction)

  if (prefill.trade_date) params.set('trade_date', prefill.trade_date)
  if (prefill.entry_price) params.set('entry_price', prefill.entry_price)
  if (prefill.stop_loss) params.set('stop_loss', prefill.stop_loss)
  if (prefill.initial_target) params.set('initial_target', prefill.initial_target)
  if (prefill.strategy) params.set('strategy', prefill.strategy)
  if (prefill.session_id) params.set('session_id', prefill.session_id)

  return params
}

export function parseJournalPrefillFromSearchParams(
  params: SearchParamReader,
): JournalPrefillPayload | null {
  const hasOpenIntent = params.get('new') === '1' || params.get('source') === AI_COACH_JOURNAL_SOURCE
  if (!hasOpenIntent) return null

  const symbol = parseSymbolCandidate(params.get('symbol'))
  if (!symbol) return null

  return {
    symbol,
    direction: readDirection(params.get('direction')) || 'long',
    trade_date: parseTradeDateCandidate(params.get('trade_date')),
    entry_price: readPrice(params.get('entry_price')),
    stop_loss: readPrice(params.get('stop_loss')),
    initial_target: readPrice(params.get('initial_target')),
    strategy: readStrategy(params.get('strategy')),
    session_id: readSessionId(params.get('session_id')),
  }
}
