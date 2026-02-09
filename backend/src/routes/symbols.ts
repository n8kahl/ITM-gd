import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { validateQuery } from '../middleware/validate';
import { cacheGet, cacheSet } from '../config/redis';
import { searchReferenceTickers, type MassiveTickerReference } from '../config/massive';
import { POPULAR_SYMBOLS, isValidSymbol, normalizeSymbol } from '../lib/symbols';
import { symbolsSearchQuerySchema } from '../schemas/symbolsValidation';

const router = Router();
const CACHE_TTL_SECONDS = 24 * 60 * 60;

type SymbolKind = 'index' | 'etf' | 'stock';

interface SymbolSearchResult {
  symbol: string;
  name: string;
  type: SymbolKind;
  exchange: string | null;
}

const POPULAR_SYMBOL_METADATA: Record<string, { name: string; type: SymbolKind }> = {
  SPX: { name: 'S&P 500 Index', type: 'index' },
  NDX: { name: 'Nasdaq-100 Index', type: 'index' },
  SPY: { name: 'SPDR S&P 500 ETF Trust', type: 'etf' },
  QQQ: { name: 'Invesco QQQ Trust', type: 'etf' },
  IWM: { name: 'iShares Russell 2000 ETF', type: 'etf' },
  AAPL: { name: 'Apple Inc.', type: 'stock' },
  NVDA: { name: 'NVIDIA Corporation', type: 'stock' },
  TSLA: { name: 'Tesla, Inc.', type: 'stock' },
  AMZN: { name: 'Amazon.com, Inc.', type: 'stock' },
  META: { name: 'Meta Platforms, Inc.', type: 'stock' },
  MSFT: { name: 'Microsoft Corporation', type: 'stock' },
  GOOGL: { name: 'Alphabet Inc. Class A', type: 'stock' },
};

function classifySymbolType(typeRaw: unknown, marketRaw: unknown, symbol: string): SymbolKind {
  const type = typeof typeRaw === 'string' ? typeRaw.toUpperCase() : '';
  const market = typeof marketRaw === 'string' ? marketRaw.toUpperCase() : '';

  if (type.includes('ETF') || type === 'ET') return 'etf';
  if (type.includes('INDEX') || type === 'INDX' || market.includes('INDEX')) return 'index';
  if (symbol === 'SPX' || symbol === 'NDX' || symbol === 'DJX' || symbol === 'RUT') return 'index';
  return 'stock';
}

function mapTickerResult(input: MassiveTickerReference): SymbolSearchResult | null {
  const symbolValue = typeof input.ticker === 'string' ? normalizeSymbol(input.ticker) : '';
  if (!isValidSymbol(symbolValue)) return null;

  const name = typeof input.name === 'string' && input.name.trim().length > 0
    ? input.name.trim()
    : symbolValue;

  return {
    symbol: symbolValue,
    name,
    type: classifySymbolType(input.type, input.market, symbolValue),
    exchange: typeof input.primary_exchange === 'string' ? input.primary_exchange : null,
  };
}

function fallbackPopularResults(query: string, limit: number): SymbolSearchResult[] {
  const needle = query.trim().toUpperCase();
  const items = POPULAR_SYMBOLS
    .filter((symbol) => {
      if (!needle) return true;
      const meta = POPULAR_SYMBOL_METADATA[symbol];
      return symbol.includes(needle) || meta?.name.toUpperCase().includes(needle);
    })
    .slice(0, limit);

  return items.map((symbol) => ({
    symbol,
    name: POPULAR_SYMBOL_METADATA[symbol]?.name || symbol,
    type: POPULAR_SYMBOL_METADATA[symbol]?.type || 'stock',
    exchange: null,
  }));
}

/**
 * GET /api/symbols/search?q=AA&limit=20
 * Search symbol metadata for UI autocomplete.
 */
router.get(
  '/search',
  authenticateToken,
  validateQuery(symbolsSearchQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { q, limit } = (req as any).validatedQuery as { q: string; limit: number };
      const query = q.trim();

      if (!query) {
        return res.json({ results: fallbackPopularResults('', limit) });
      }

      const cacheKey = `symbols:search:${query.toUpperCase()}:${limit}`;
      const cached = await cacheGet<{ results: SymbolSearchResult[] }>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const raw = await searchReferenceTickers(query, Math.min(50, Math.max(limit * 2, 20)));
      const mapped = raw
        .map((item) => mapTickerResult(item))
        .filter((item): item is SymbolSearchResult => item !== null);

      const unique: SymbolSearchResult[] = [];
      const seen = new Set<string>();
      for (const item of mapped) {
        if (seen.has(item.symbol)) continue;
        seen.add(item.symbol);
        unique.push(item);
      }

      unique.sort((a, b) => {
        const qUpper = query.toUpperCase();
        const aStarts = a.symbol.startsWith(qUpper) ? 1 : 0;
        const bStarts = b.symbol.startsWith(qUpper) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return a.symbol.localeCompare(b.symbol);
      });

      const results = unique.slice(0, limit);
      const payload = { results: results.length > 0 ? results : fallbackPopularResults(query, limit) };

      await cacheSet(cacheKey, payload, CACHE_TTL_SECONDS);
      return res.json(payload);
    } catch (error: any) {
      return res.status(503).json({
        error: 'Symbol search unavailable',
        message: error?.message || 'Failed to search symbols',
      });
    }
  },
);

export default router;
