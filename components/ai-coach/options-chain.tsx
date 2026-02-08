'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  getOptionsChain,
  getExpirations,
  AICoachAPIError,
  type OptionsChainResponse,
  type OptionContract,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface OptionsChainProps {
  initialSymbol?: string
  initialExpiry?: string
}

type SortField = 'strike' | 'last' | 'volume' | 'openInterest' | 'iv' | 'delta'
type SortDir = 'asc' | 'desc'

// ============================================
// COMPONENT
// ============================================

export function OptionsChain({ initialSymbol = 'SPX', initialExpiry }: OptionsChainProps) {
  const { session } = useMemberAuth()

  const [symbol, setSymbol] = useState(initialSymbol)
  const [expiry, setExpiry] = useState(initialExpiry || '')
  const [expirations, setExpirations] = useState<string[]>([])
  const [chain, setChain] = useState<OptionsChainResponse | null>(null)
  const [strikeRange, setStrikeRange] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('strike')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const token = session?.access_token

  // Load expirations on mount or symbol change
  useEffect(() => {
    if (!token) return
    loadExpirations(symbol)
  }, [symbol, token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load chain when expiry changes
  useEffect(() => {
    if (!token || !expiry) return
    loadChain()
  }, [expiry, strikeRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadExpirations = useCallback(async (sym: string) => {
    if (!token) return
    try {
      const data = await getExpirations(sym, token)
      setExpirations(data.expirations)
      if (data.expirations.length > 0 && !expiry) {
        setExpiry(data.expirations[0])
      }
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load expirations'
      setError(msg)
    }
  }, [token, expiry])

  const loadChain = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getOptionsChain(symbol, token, expiry || undefined, strikeRange)
      setChain(data)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load options chain'
      setError(msg)
      setChain(null)
    } finally {
      setIsLoading(false)
    }
  }, [token, symbol, expiry, strikeRange])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortContracts = (contracts: OptionContract[]): OptionContract[] => {
    return [...contracts].sort((a, b) => {
      let aVal: number
      let bVal: number

      switch (sortField) {
        case 'strike': aVal = a.strike; bVal = b.strike; break
        case 'last': aVal = a.last; bVal = b.last; break
        case 'volume': aVal = a.volume; bVal = b.volume; break
        case 'openInterest': aVal = a.openInterest; bVal = b.openInterest; break
        case 'iv': aVal = a.impliedVolatility; bVal = b.impliedVolatility; break
        case 'delta': aVal = Math.abs(a.delta || 0); bVal = Math.abs(b.delta || 0); break
        default: aVal = a.strike; bVal = b.strike;
      }

      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-white/5 p-3 flex flex-wrap items-center gap-3">
        {/* Symbol */}
        <div className="flex items-center gap-1">
          {['SPX', 'NDX'].map(s => (
            <button
              key={s}
              onClick={() => { setSymbol(s); setExpiry(''); setChain(null); }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                symbol === s
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/40 hover:text-white/70 border border-transparent'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Expiry selector */}
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
        >
          <option value="">Select expiry</option>
          {expirations.map(exp => (
            <option key={exp} value={exp}>{exp}</option>
          ))}
        </select>

        {/* Strike range */}
        <select
          value={strikeRange}
          onChange={(e) => setStrikeRange(parseInt(e.target.value))}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
        >
          {[5, 10, 15, 20, 30].map(r => (
            <option key={r} value={r}>{r} strikes</option>
          ))}
        </select>

        <button
          onClick={loadChain}
          disabled={isLoading || !expiry}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-emerald-500 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>

        {chain && (
          <div className="ml-auto flex items-center gap-3 text-xs text-white/40">
            <span>Price: <span className="text-white font-medium">${chain.currentPrice.toLocaleString()}</span></span>
            <span>DTE: <span className="text-white font-medium">{chain.daysToExpiry}</span></span>
            {chain.ivRank > 0 && (
              <span>IV Rank: <span className={cn(
                'font-medium',
                chain.ivRank > 50 ? 'text-red-400' : 'text-emerald-400'
              )}>{chain.ivRank}%</span></span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4 text-center">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={loadChain} className="text-xs text-emerald-500 hover:text-emerald-400">Retry</button>
          </div>
        )}

        {isLoading && !chain && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        {!chain && !isLoading && !error && (
          <div className="flex items-center justify-center h-full text-sm text-white/40">
            Select an expiration to view the options chain
          </div>
        )}

        {chain && (
          <div className="flex gap-0">
            {/* CALLS */}
            <div className="flex-1 min-w-0">
              <div className="sticky top-0 bg-[#0F0F10] border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                  CALLS
                </div>
              </div>
              <OptionsTable
                contracts={sortContracts(chain.options.calls)}
                currentPrice={chain.currentPrice}
                side="call"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                isLoading={isLoading}
              />
            </div>

            {/* Strike Column (shared center) */}
            <div className="w-px bg-emerald-500/20" />

            {/* PUTS */}
            <div className="flex-1 min-w-0">
              <div className="sticky top-0 bg-[#0F0F10] border-b border-white/5 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <TrendingDown className="w-3.5 h-3.5" />
                  PUTS
                </div>
              </div>
              <OptionsTable
                contracts={sortContracts(chain.options.puts)}
                currentPrice={chain.currentPrice}
                side="put"
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
                isLoading={isLoading}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// OPTIONS TABLE
// ============================================

function OptionsTable({
  contracts,
  currentPrice,
  side,
  sortField,
  sortDir,
  onSort,
  isLoading,
}: {
  contracts: OptionContract[]
  currentPrice: number
  side: 'call' | 'put'
  sortField: SortField
  sortDir: SortDir
  onSort: (field: SortField) => void
  isLoading: boolean
}) {
  const columns: { key: SortField; label: string; width: string }[] = [
    { key: 'strike', label: 'Strike', width: 'w-16' },
    { key: 'last', label: 'Last', width: 'w-14' },
    { key: 'delta', label: 'Delta', width: 'w-14' },
    { key: 'iv', label: 'IV', width: 'w-14' },
    { key: 'volume', label: 'Vol', width: 'w-14' },
    { key: 'openInterest', label: 'OI', width: 'w-14' },
  ]

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-white/5">
          {columns.map(col => (
            <th
              key={col.key}
              className={cn(
                'px-2 py-2 text-left font-medium text-white/50 cursor-pointer hover:text-white/80 transition-colors',
                col.width
              )}
              onClick={() => onSort(col.key)}
            >
              <span className="flex items-center gap-1">
                {col.label}
                {sortField === col.key && (
                  <ArrowUpDown className="w-3 h-3 text-emerald-500" />
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={cn(isLoading && 'opacity-50')}>
        {contracts.map((contract) => {
          const isITM = contract.inTheMoney
          const isATM = Math.abs(contract.strike - currentPrice) < (currentPrice * 0.002)

          return (
            <tr
              key={contract.strike}
              className={cn(
                'border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors',
                isITM && (side === 'call' ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]'),
                isATM && 'border-l-2 border-l-emerald-500'
              )}
            >
              <td className={cn(
                'px-2 py-1.5 font-mono font-medium',
                isATM ? 'text-emerald-400' : 'text-white/80'
              )}>
                {contract.strike.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 font-mono text-white/70">
                {contract.last.toFixed(2)}
              </td>
              <td className={cn(
                'px-2 py-1.5 font-mono',
                side === 'call'
                  ? (contract.delta && contract.delta > 0 ? 'text-emerald-400' : 'text-white/50')
                  : (contract.delta && contract.delta < 0 ? 'text-red-400' : 'text-white/50')
              )}>
                {contract.delta?.toFixed(2) || '-'}
              </td>
              <td className={cn(
                'px-2 py-1.5 font-mono',
                contract.impliedVolatility > 0.3 ? 'text-amber-400' : 'text-white/50'
              )}>
                {(contract.impliedVolatility * 100).toFixed(1)}%
              </td>
              <td className="px-2 py-1.5 font-mono text-white/50">
                {contract.volume > 0 ? contract.volume.toLocaleString() : '-'}
              </td>
              <td className="px-2 py-1.5 font-mono text-white/50">
                {contract.openInterest > 0 ? contract.openInterest.toLocaleString() : '-'}
              </td>
            </tr>
          )
        })}
        {contracts.length === 0 && (
          <tr>
            <td colSpan={6} className="px-2 py-8 text-center text-white/30">
              No contracts available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
