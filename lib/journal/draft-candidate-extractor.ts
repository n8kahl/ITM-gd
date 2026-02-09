const IGNORE_SYMBOLS = new Set([
  'I', 'A', 'THE', 'AND', 'OR', 'TO', 'FOR', 'WITH', 'THIS', 'THAT',
  'LONG', 'SHORT', 'CALL', 'PUT', 'SPREAD', 'DTE', 'VWAP', 'ATR',
])

export interface DraftSourceMessage {
  content: string | null
}

export interface DraftCandidate {
  symbol: string
  direction: 'long' | 'short'
  notes: string
}

export function detectDirection(text: string): 'long' | 'short' {
  const normalized = text.toLowerCase()
  if (
    normalized.includes('short')
    || normalized.includes('put')
    || normalized.includes('bearish')
    || normalized.includes('sell')
  ) {
    return 'short'
  }
  return 'long'
}

export function extractSymbolCandidates(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,5}\b/g) || []
  return matches
    .map((symbol) => symbol.trim())
    .filter((symbol) => symbol.length > 0 && !IGNORE_SYMBOLS.has(symbol))
}

export function extractDraftCandidates(
  messages: DraftSourceMessage[],
  maxCandidates: number = 10,
): DraftCandidate[] {
  const candidates = new Map<string, DraftCandidate>()

  for (const message of messages) {
    if (!message.content || typeof message.content !== 'string') continue
    const symbols = extractSymbolCandidates(message.content.toUpperCase())
    for (const symbol of symbols) {
      if (candidates.has(symbol)) continue
      candidates.set(symbol, {
        symbol,
        direction: detectDirection(message.content),
        notes: message.content.slice(0, 400),
      })
      if (candidates.size >= maxCandidates) break
    }
    if (candidates.size >= maxCandidates) break
  }

  return Array.from(candidates.values())
}

