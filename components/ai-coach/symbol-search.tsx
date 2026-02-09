'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  searchSymbols,
  AICoachAPIError,
  type SymbolSearchItem,
} from '@/lib/api/ai-coach'

interface SymbolSearchProps {
  value: string
  onChange: (symbol: string) => void
  className?: string
}

const FAVORITES_KEY = 'ai-coach-symbol-favorites'
const RECENTS_KEY = 'ai-coach-symbol-recents'
const MAX_RECENTS = 10

const POPULAR_SYMBOLS: SymbolSearchItem[] = [
  { symbol: 'SPX', name: 'S&P 500 Index', type: 'index', exchange: null },
  { symbol: 'NDX', name: 'Nasdaq-100 Index', type: 'index', exchange: null },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', type: 'etf', exchange: 'ARCX' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'etf', exchange: 'XNAS' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', type: 'etf', exchange: 'ARCX' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', exchange: 'XNAS' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', exchange: 'XNAS' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', type: 'stock', exchange: 'XNAS' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', type: 'stock', exchange: 'XNAS' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', type: 'stock', exchange: 'XNAS' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', exchange: 'XNAS' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', type: 'stock', exchange: 'XNAS' },
]

function uniqueBySymbol(items: SymbolSearchItem[]): SymbolSearchItem[] {
  const seen = new Set<string>()
  const deduped: SymbolSearchItem[] = []

  for (const item of items) {
    if (seen.has(item.symbol)) continue
    seen.add(item.symbol)
    deduped.push(item)
  }
  return deduped
}

function readStoredSymbols(key: string): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toUpperCase())
      .filter((value) => /^[A-Z0-9._:-]{1,10}$/.test(value))
  } catch {
    return []
  }
}

function writeStoredSymbols(key: string, values: string[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // Ignore storage failures in private/incognito modes.
  }
}

function findPopularSymbol(symbol: string): SymbolSearchItem {
  const existing = POPULAR_SYMBOLS.find((item) => item.symbol === symbol)
  if (existing) return existing
  return { symbol, name: symbol, type: 'stock', exchange: null }
}

export function SymbolSearch({ value, onChange, className }: SymbolSearchProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token

  const [inputValue, setInputValue] = useState(value.toUpperCase())
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [remoteResults, setRemoteResults] = useState<SymbolSearchItem[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [recents, setRecents] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInputValue(value.toUpperCase())
  }, [value])

  useEffect(() => {
    setFavorites(readStoredSymbols(FAVORITES_KEY))
    setRecents(readStoredSymbols(RECENTS_KEY))
  }, [])

  useEffect(() => {
    const query = inputValue.trim()
    if (!query) {
      setRemoteResults([])
      setError(null)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (!token) {
          const fallback = POPULAR_SYMBOLS.filter((item) => (
            item.symbol.includes(query.toUpperCase()) || item.name.toUpperCase().includes(query.toUpperCase())
          ))
          if (!cancelled) setRemoteResults(fallback)
          return
        }

        const response = await searchSymbols(query, token, 20)
        if (!cancelled) {
          setRemoteResults(response.results)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof AICoachAPIError ? err.apiError.message : 'Symbol search unavailable'
          setError(message)
          setRemoteResults([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [inputValue, token])

  const suggestions = useMemo(() => {
    const query = inputValue.trim().toUpperCase()
    const favoriteItems = favorites.map(findPopularSymbol)
    const recentItems = recents.map(findPopularSymbol)

    if (!query) {
      return uniqueBySymbol([...favoriteItems, ...recentItems, ...POPULAR_SYMBOLS]).slice(0, 20)
    }

    const fallbackMatches = POPULAR_SYMBOLS.filter((item) => (
      item.symbol.includes(query) || item.name.toUpperCase().includes(query)
    ))

    return uniqueBySymbol([...remoteResults, ...favoriteItems, ...recentItems, ...fallbackMatches]).slice(0, 20)
  }, [favorites, inputValue, recents, remoteResults])

  const groupedSuggestions = useMemo(() => ({
    index: suggestions.filter((item) => item.type === 'index'),
    etf: suggestions.filter((item) => item.type === 'etf'),
    stock: suggestions.filter((item) => item.type === 'stock'),
  }), [suggestions])

  const addRecent = useCallback((symbol: string) => {
    const updated = [symbol, ...recents.filter((item) => item !== symbol)].slice(0, MAX_RECENTS)
    setRecents(updated)
    writeStoredSymbols(RECENTS_KEY, updated)
  }, [recents])

  const toggleFavorite = useCallback((symbol: string) => {
    const alreadyFavorite = favorites.includes(symbol)
    const updated = alreadyFavorite
      ? favorites.filter((item) => item !== symbol)
      : [symbol, ...favorites].slice(0, MAX_RECENTS)
    setFavorites(updated)
    writeStoredSymbols(FAVORITES_KEY, updated)
  }, [favorites])

  const handleSelect = useCallback((symbol: string) => {
    const normalized = symbol.toUpperCase()
    onChange(normalized)
    setInputValue(normalized)
    addRecent(normalized)
    setIsOpen(false)
  }, [addRecent, onChange])

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
        <input
          value={inputValue}
          onChange={(event) => {
            const normalized = event.target.value.toUpperCase().replace(/[^A-Z0-9._:-]/g, '')
            setInputValue(normalized)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && suggestions.length > 0) {
              event.preventDefault()
              handleSelect(suggestions[0].symbol)
            }
          }}
          placeholder="Search symbol (AAPL, SPX, QQQ...)"
          className="h-8 w-full rounded-md border border-white/10 bg-white/5 pl-8 pr-2.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-500/40 focus:outline-none"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-md border border-white/10 bg-[#0b0f14] p-1 shadow-xl">
          {isLoading && (
            <p className="px-2 py-1.5 text-[11px] text-white/45">Searching symbols...</p>
          )}
          {!isLoading && error && (
            <p className="px-2 py-1.5 text-[11px] text-amber-400">{error}</p>
          )}
          {!isLoading && suggestions.length === 0 && (
            <p className="px-2 py-1.5 text-[11px] text-white/45">No symbols found.</p>
          )}

          {!isLoading && (
            <>
              {(['index', 'etf', 'stock'] as const).map((group) => {
                const items = groupedSuggestions[group]
                if (items.length === 0) return null

                return (
                  <div key={group} className="py-1">
                    <p className="px-2 pb-1 text-[10px] uppercase tracking-wide text-white/30">
                      {group === 'etf' ? 'ETFs' : `${group}s`}
                    </p>
                    {items.map((item) => {
                      const isFavorite = favorites.includes(item.symbol)
                      return (
                        <button
                          key={item.symbol}
                          type="button"
                          onMouseDown={() => handleSelect(item.symbol)}
                          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white">{item.symbol}</p>
                            <p className="truncate text-[10px] text-white/45">{item.name}</p>
                          </div>
                          <span
                            className="ml-2 rounded p-1 text-white/45 hover:text-amber-300"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              toggleFavorite(item.symbol)
                            }}
                          >
                            <Star className={cn('h-3 w-3', isFavorite && 'fill-amber-300 text-amber-300')} />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
