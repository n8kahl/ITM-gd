export const SYMBOL_REGEX = /^[A-Z0-9._:-]{1,10}$/;

export const POPULAR_SYMBOLS = [
  'SPX',
  'NDX',
  'SPY',
  'QQQ',
  'IWM',
  'AAPL',
  'NVDA',
  'TSLA',
  'AMZN',
  'META',
  'MSFT',
  'GOOGL',
] as const;

export const INDEX_SYMBOLS = new Set([
  'SPX',
  'NDX',
  'DJX',
  'DJI',
  'DJIA',
  'RUT',
  'VIX',
  'COMP',
]);

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isValidSymbol(symbol: string): boolean {
  return SYMBOL_REGEX.test(normalizeSymbol(symbol));
}

export function sanitizeSymbols(input: string[], limit: number = 20): string[] {
  const normalized = input
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol) => isValidSymbol(symbol));

  return Array.from(new Set(normalized)).slice(0, limit);
}

export function formatMassiveTicker(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return INDEX_SYMBOLS.has(normalized) ? `I:${normalized}` : normalized;
}
