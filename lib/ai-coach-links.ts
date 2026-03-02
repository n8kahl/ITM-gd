const DEFAULT_SYMBOL = 'SPX'
const SYMBOL_PATTERN = /^[A-Z0-9._:-]{1,10}$/

export function normalizeAICoachSymbol(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_SYMBOL
  const normalized = raw.trim().toUpperCase()
  return SYMBOL_PATTERN.test(normalized) ? normalized : DEFAULT_SYMBOL
}

export function buildAICoachPromptHref(
  prompt: string,
  options?: {
    source?: string
    symbol?: string
  },
): string {
  const params = new URLSearchParams()
  params.set('prompt', prompt)

  if (options?.source) params.set('source', options.source)

  if (options?.symbol) {
    params.set('symbol', normalizeAICoachSymbol(options.symbol))
  }

  return `/members/ai-coach?${params.toString()}`
}

export function buildSymbolAICoachPrompt(symbolRaw: string, context?: string): string {
  const symbol = normalizeAICoachSymbol(symbolRaw)
  const trimmedContext = typeof context === 'string' ? context.trim() : ''

  const basePrompt = `Give me the latest actionable update on ${symbol} for today: trend, key levels, relevant news/catalysts, options volatility context, and one bullish + one bearish setup with invalidation.`
  if (!trimmedContext) return basePrompt

  return `${basePrompt} ${trimmedContext}`
}

export function buildSymbolAICoachHref(
  symbolRaw: string,
  options?: {
    context?: string
    source?: string
  },
): string {
  const symbol = normalizeAICoachSymbol(symbolRaw)
  return buildAICoachPromptHref(
    buildSymbolAICoachPrompt(symbol, options?.context),
    {
      source: options?.source ?? 'dashboard_symbol_link',
      symbol,
    },
  )
}
