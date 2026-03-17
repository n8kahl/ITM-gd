const TOKEN_PATTERN = /\b\$?[A-Za-z]{1,6}\b/g;

const LOWERCASE_KNOWN_SYMBOLS = new Set([
  'spx', 'ndx', 'spy', 'qqq', 'iwm', 'dia', 'vix', 'xlf', 'xle', 'xlk', 'smh', 'tlt', 'gld', 'slv',
  'aapl', 'msft', 'nvda', 'tsla', 'amzn', 'meta', 'googl', 'amd',
]);

const BASE_STOPWORDS = new Set([
  'A', 'AI', 'ALL', 'AM', 'AN', 'AND', 'ARE', 'AS', 'AT', 'BE', 'BEST', 'BULL', 'BEAR', 'BY', 'CAN', 'CLOSE',
  'DAY', 'ET', 'FOR', 'FROM', 'GAME', 'GIVE', 'GO', 'HOUR', 'HOW', 'I', 'IF', 'IN', 'IS', 'IT', 'KEY', 'LEVEL',
  'LEVELS', 'LOOK', 'MARKET', 'ME', 'MY', 'NOW', 'OF', 'ON', 'OR', 'PLAN', 'PRICE', 'RISK', 'SCAN', 'SETUP',
  'SHOW', 'SPOT', 'THAT', 'THE', 'THIS', 'TO', 'TODAY', 'TRADE', 'WHAT', 'WHEN', 'WHERE', 'WITH', 'YOU', 'YOUR',
  'VWAP', 'GEX', 'PDH', 'PDL', 'PDC', 'ATR', 'IV', 'DTE', 'EMA', 'RSI', 'MACD', 'OI',
]);

const SUPPLEMENTAL_CONTEXT_STOPWORDS = new Set([
  ...BASE_STOPWORDS,
  'HERE',
  'THERE',
  'THESE',
  'THOSE',
]);

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

export function normalizeSymbolCandidate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9._:-]{1,10}$/.test(normalized) ? normalized : null;
}

export function extractExplicitSymbols(
  message: string,
  options?: {
    blacklist?: Set<string>;
  },
): string[] {
  const blacklist = options?.blacklist ?? BASE_STOPWORDS;
  const matches = message.match(TOKEN_PATTERN) || [];

  const symbols = matches
    .map((rawToken) => {
      const hasDollarPrefix = rawToken.startsWith('$');
      const token = rawToken.replace(/^\$/, '');
      const lower = token.toLowerCase();
      const isAllUpper = token === token.toUpperCase();

      if (!hasDollarPrefix && !isAllUpper && !LOWERCASE_KNOWN_SYMBOLS.has(lower)) {
        return null;
      }

      const normalized = token.toUpperCase();
      if (!hasDollarPrefix && blacklist.has(normalized)) {
        return null;
      }

      const valid = normalizeSymbolCandidate(normalized);
      return valid;
    })
    .filter((token): token is string => typeof token === 'string');

  return dedupe(symbols);
}

export function extractPromptContextSymbols(
  history: Array<{ role?: string; content?: string }>,
  latestMessage: string,
  activeChartSymbol?: string,
): string[] {
  const recentUserMessages = history
    .filter((message) => message.role === 'user' && typeof message.content === 'string')
    .slice(-5)
    .map((message) => message.content as string);

  const historySymbols = recentUserMessages.flatMap((content) => (
    extractExplicitSymbols(content, { blacklist: SUPPLEMENTAL_CONTEXT_STOPWORDS })
  ));
  const latestSymbols = extractExplicitSymbols(latestMessage, { blacklist: SUPPLEMENTAL_CONTEXT_STOPWORDS });
  const contextSymbol = normalizeSymbolCandidate(activeChartSymbol);

  return dedupe([
    ...(contextSymbol ? [contextSymbol] : []),
    ...historySymbols,
    ...latestSymbols,
  ]).slice(0, 10);
}
