'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { useAICoachWorkflow } from '@/contexts/AICoachWorkflowContext'
import {
  getOptionsChain,
  getExpirations,
  getOptionsMatrix,
  getGammaExposure,
  getZeroDTEAnalysis,
  getIVAnalysis,
  AICoachAPIError,
  type OptionsChainResponse,
  type OptionsMatrixResponse,
  type OptionContract,
  type GEXProfileResponse,
  type ZeroDTEAnalysisResponse,
  type IVAnalysisResponse,
} from '@/lib/api/ai-coach'
import { GEXChart } from './gex-chart'
import { SymbolSearch } from './symbol-search'
import { ZeroDTEDashboard } from './zero-dte-dashboard'
import { IVDashboard } from './iv-dashboard'
import { OptionsHeatmap, type HeatmapMode } from './options-heatmap'

// ============================================
// TYPES
// ============================================

interface OptionsChainProps {
  initialSymbol?: string
  initialExpiry?: string
}

type SortField = 'strike' | 'last' | 'volume' | 'openInterest' | 'iv' | 'delta'
type SortDir = 'asc' | 'desc'
type OptionsDataView = 'chain' | 'heatmap'

// ============================================
// COMPONENT
// ============================================

export function OptionsChain({ initialSymbol = 'SPY', initialExpiry }: OptionsChainProps) {
  const { session } = useMemberAuth()
  const {
    activeSymbol,
    activeExpiry,
    activeStrike,
    setSymbol: setWorkflowSymbol,
    setCenterView,
    setStrike: setWorkflowStrike,
    setExpiry: setWorkflowExpiry,
  } = useAICoachWorkflow()

  const [symbol, setSymbol] = useState(initialSymbol)
  const [expiry, setExpiry] = useState(initialExpiry || '')
  const [expirations, setExpirations] = useState<string[]>([])
  const [chain, setChain] = useState<OptionsChainResponse | null>(null)
  const [strikeRange, setStrikeRange] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('strike')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [activeDataView, setActiveDataView] = useState<OptionsDataView>('chain')
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('volume')
  const [matrixExpirations, setMatrixExpirations] = useState(5)
  const [matrixStrikes, setMatrixStrikes] = useState(50)
  const [optionsMatrix, setOptionsMatrix] = useState<OptionsMatrixResponse | null>(null)
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false)
  const [matrixError, setMatrixError] = useState<string | null>(null)
  const [showGex, setShowGex] = useState(true)
  const [showVolAnalytics, setShowVolAnalytics] = useState(true)
  const [gexProfile, setGexProfile] = useState<GEXProfileResponse | null>(null)
  const [isLoadingGex, setIsLoadingGex] = useState(false)
  const [gexError, setGexError] = useState<string | null>(null)
  const [zeroDteAnalysis, setZeroDteAnalysis] = useState<ZeroDTEAnalysisResponse | null>(null)
  const [isLoadingZeroDte, setIsLoadingZeroDte] = useState(false)
  const [zeroDteError, setZeroDteError] = useState<string | null>(null)
  const [ivAnalysis, setIvAnalysis] = useState<IVAnalysisResponse | null>(null)
  const [isLoadingIv, setIsLoadingIv] = useState(false)
  const [ivError, setIvError] = useState<string | null>(null)
  const [pendingSyncSymbol, setPendingSyncSymbol] = useState<string | null>(null)

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

  useEffect(() => {
    const workflowSymbol = activeSymbol
    if (!workflowSymbol || workflowSymbol === symbol) return
    setPendingSyncSymbol(workflowSymbol)
  }, [activeSymbol, symbol])

  useEffect(() => {
    if (!activeExpiry || activeSymbol !== symbol) return
    if (activeExpiry !== expiry) {
      setExpiry(activeExpiry)
    }
  }, [activeExpiry, activeSymbol, symbol, expiry])

  const loadExpirations = useCallback(async (sym: string) => {
    if (!token) return
    try {
      const data = await getExpirations(sym, token)
      setExpirations(data.expirations)
      if (data.expirations.length > 0 && !expiry) {
        setExpiry(data.expirations[0])
        setWorkflowExpiry(data.expirations[0])
      }
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load expirations'
      setError(msg)
    }
  }, [token, expiry, setWorkflowExpiry])

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

  const loadMatrix = useCallback(async () => {
    if (!token) return

    setIsLoadingMatrix(true)
    setMatrixError(null)
    try {
      const data = await getOptionsMatrix(symbol, token, {
        expirations: matrixExpirations,
        strikes: matrixStrikes,
      })
      setOptionsMatrix(data)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load options heatmap'
      setMatrixError(msg)
      setOptionsMatrix(null)
    } finally {
      setIsLoadingMatrix(false)
    }
  }, [token, symbol, matrixExpirations, matrixStrikes])

  useEffect(() => {
    if (!token || activeDataView !== 'heatmap') return
    loadMatrix()
  }, [token, activeDataView, symbol, matrixExpirations, matrixStrikes, loadMatrix])

  const loadGex = useCallback(async (forceRefresh: boolean = false) => {
    if (!token || !showGex) return

    setIsLoadingGex(true)
    setGexError(null)
    try {
      const data = await getGammaExposure(symbol, token, {
        expiry: expiry || undefined,
        strikeRange: Math.max(15, strikeRange),
        maxExpirations: expiry ? 1 : 6,
        forceRefresh,
      })
      setGexProfile(data)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load gamma exposure'
      setGexError(msg)
      setGexProfile(null)
    } finally {
      setIsLoadingGex(false)
    }
  }, [token, showGex, symbol, expiry, strikeRange])

  useEffect(() => {
    if (!token || !showGex) return
    loadGex(false)
  }, [token, showGex, symbol, expiry, strikeRange, loadGex])

  const loadZeroDTE = useCallback(async () => {
    if (!token || !showVolAnalytics) return

    setIsLoadingZeroDte(true)
    setZeroDteError(null)
    try {
      const data = await getZeroDTEAnalysis(symbol, token)
      setZeroDteAnalysis(data)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load 0DTE analytics'
      setZeroDteError(msg)
      setZeroDteAnalysis(null)
    } finally {
      setIsLoadingZeroDte(false)
    }
  }, [token, showVolAnalytics, symbol])

  const loadIV = useCallback(async (forceRefresh: boolean = false) => {
    if (!token || !showVolAnalytics) return

    setIsLoadingIv(true)
    setIvError(null)
    try {
      const data = await getIVAnalysis(symbol, token, {
        expiry: expiry || undefined,
        strikeRange: Math.max(15, strikeRange),
        maxExpirations: expiry ? 1 : 4,
        forceRefresh,
      })
      setIvAnalysis(data)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to load IV analysis'
      setIvError(msg)
      setIvAnalysis(null)
    } finally {
      setIsLoadingIv(false)
    }
  }, [token, showVolAnalytics, symbol, expiry, strikeRange])

  useEffect(() => {
    if (!token || !showVolAnalytics) return
    loadZeroDTE()
    loadIV(false)
  }, [token, showVolAnalytics, symbol, expiry, strikeRange, loadZeroDTE, loadIV])

  const handleShowGexOnChart = useCallback(() => {
    if (!gexProfile || typeof window === 'undefined') return

    window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
      detail: {
        symbol,
        timeframe: '1D',
        gexProfile: {
          symbol: gexProfile.symbol,
          spotPrice: gexProfile.spotPrice,
          flipPoint: gexProfile.flipPoint,
          maxGEXStrike: gexProfile.maxGEXStrike,
          keyLevels: gexProfile.keyLevels,
        },
      },
    }))
  }, [gexProfile, symbol])

  const handleSyncSymbol = useCallback(() => {
    if (!pendingSyncSymbol) return
    setSymbol(pendingSyncSymbol)
    setExpiry('')
    setChain(null)
    setOptionsMatrix(null)
    setMatrixError(null)
    setGexProfile(null)
    setGexError(null)
    setWorkflowSymbol(pendingSyncSymbol)
    setCenterView('options')
    setPendingSyncSymbol(null)
  }, [pendingSyncSymbol, setWorkflowSymbol, setCenterView])

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
        <div className="w-56">
          <SymbolSearch
            value={symbol}
            onChange={(nextSymbol) => {
              setSymbol(nextSymbol)
              setExpiry('')
              setChain(null)
              setOptionsMatrix(null)
              setMatrixError(null)
              setGexProfile(null)
              setGexError(null)
              setZeroDteAnalysis(null)
              setZeroDteError(null)
              setIvAnalysis(null)
              setIvError(null)
              setWorkflowSymbol(nextSymbol)
              setCenterView('options')
              setWorkflowStrike(null)
              setPendingSyncSymbol(null)
            }}
          />
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Expiry selector */}
        <select
          value={expiry}
          onChange={(e) => {
            setExpiry(e.target.value)
            setWorkflowExpiry(e.target.value || null)
          }}
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

        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setActiveDataView('chain')}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              activeDataView === 'chain'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-white/45 hover:text-white/70'
            )}
          >
            Chain
          </button>
          <button
            type="button"
            onClick={() => setActiveDataView('heatmap')}
            className={cn(
              'rounded px-2 py-1 text-[11px] font-medium transition-colors',
              activeDataView === 'heatmap'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-white/45 hover:text-white/70'
            )}
          >
            Heatmap
          </button>
        </div>

        {activeDataView === 'heatmap' && (
          <>
            <select
              value={matrixExpirations}
              onChange={(e) => setMatrixExpirations(parseInt(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              {[3, 5, 7, 10].map((value) => (
                <option key={value} value={value}>{value} expiries</option>
              ))}
            </select>

            <select
              value={matrixStrikes}
              onChange={(e) => setMatrixStrikes(parseInt(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              {[30, 40, 50, 60, 70].map((value) => (
                <option key={value} value={value}>{value} strike range</option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={() => {
            if (activeDataView === 'heatmap') {
              loadMatrix()
              return
            }
            loadChain()
          }}
          disabled={(activeDataView === 'chain' && (isLoading || !expiry)) || (activeDataView === 'heatmap' && isLoadingMatrix)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-emerald-500 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={cn('w-4 h-4', (isLoading || isLoadingMatrix) && 'animate-spin')} />
        </button>

        <button
          onClick={() => setShowGex(prev => !prev)}
          className={cn(
            'px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
            showGex
              ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
              : 'border-white/10 bg-white/5 text-white/50 hover:text-white/70'
          )}
        >
          GEX {showGex ? 'On' : 'Off'}
        </button>

        <button
          onClick={() => setShowVolAnalytics(prev => !prev)}
          className={cn(
            'px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors',
            showVolAnalytics
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-white/10 bg-white/5 text-white/50 hover:text-white/70'
          )}
        >
          0DTE/IV {showVolAnalytics ? 'On' : 'Off'}
        </button>

        {showGex && (
          <button
            onClick={() => loadGex(true)}
            disabled={isLoadingGex}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-violet-300 transition-colors disabled:opacity-30"
            title="Refresh GEX"
          >
            <RefreshCw className={cn('w-4 h-4', isLoadingGex && 'animate-spin')} />
          </button>
        )}

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
            {showGex && gexProfile && (
              <span>
                GEX:
                <span className={cn(
                  'ml-1 font-medium',
                  gexProfile.regime === 'positive_gamma' ? 'text-emerald-300' : 'text-red-300'
                )}>
                  {gexProfile.regime === 'positive_gamma' ? 'Positive' : 'Negative'}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {pendingSyncSymbol && (
        <div className="border-b border-white/5 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
          <p className="text-white/45">
            Workflow symbol is <span className="text-white/70">{pendingSyncSymbol}</span>. Sync options chain?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncSymbol}
              className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
            >
              Yes
            </button>
            <button
              onClick={() => setPendingSyncSymbol(null)}
              className="px-2 py-1 rounded border border-white/10 bg-white/5 text-white/45 hover:text-white/65"
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeDataView === 'heatmap' && (
          <OptionsHeatmap
            matrix={optionsMatrix}
            mode={heatmapMode}
            onModeChange={setHeatmapMode}
            isLoading={isLoadingMatrix}
            error={matrixError}
            onRefresh={loadMatrix}
          />
        )}

        {activeDataView === 'chain' && error && (
          <div className="p-4 text-center">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={loadChain} className="text-xs text-emerald-500 hover:text-emerald-400">Retry</button>
          </div>
        )}

        {activeDataView === 'chain' && isLoading && !chain && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        {activeDataView === 'chain' && !chain && !isLoading && !error && (
          <div className="flex items-center justify-center h-full text-sm text-white/40">
            Select an expiration to view the options chain
          </div>
        )}

        {activeDataView === 'chain' && chain && (
          <>
            {showGex && (
              <div className="border-b border-white/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-violet-300" />
                    <span className="text-xs font-medium text-white">Gamma Exposure (GEX)</span>
                    {gexProfile?.regime && (
                      <span className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        gexProfile.regime === 'positive_gamma'
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'bg-red-500/10 text-red-300'
                      )}>
                        {gexProfile.regime === 'positive_gamma' ? 'Positive' : 'Negative'}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleShowGexOnChart}
                    disabled={!gexProfile}
                    className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-300 hover:bg-violet-500/15 disabled:opacity-40"
                  >
                    Show on Chart
                  </button>
                </div>

                {gexError && (
                  <p className="mb-2 text-[11px] text-amber-400">{gexError}</p>
                )}

                {isLoadingGex && !gexProfile && (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="w-5 h-5 text-violet-300 animate-spin" />
                  </div>
                )}

                {gexProfile && (
                  <>
                    <GEXChart
                      data={gexProfile.gexByStrike}
                      spotPrice={gexProfile.spotPrice}
                      flipPoint={gexProfile.flipPoint}
                      maxGEXStrike={gexProfile.maxGEXStrike}
                      maxRows={18}
                    />
                    {gexProfile.implication && (
                      <p className="mt-2 text-[10px] text-white/45">{gexProfile.implication}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {showVolAnalytics && (
              <div className="border-b border-white/5 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <ZeroDTEDashboard
                    analysis={zeroDteAnalysis}
                    isLoading={isLoadingZeroDte}
                    error={zeroDteError}
                    onRefresh={loadZeroDTE}
                  />
                  <IVDashboard
                    profile={ivAnalysis}
                    isLoading={isLoadingIv}
                    error={ivError}
                    onRefresh={() => loadIV(true)}
                  />
                </div>
              </div>
            )}

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
                  highlightStrike={activeSymbol === symbol ? activeStrike : null}
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
                  highlightStrike={activeSymbol === symbol ? activeStrike : null}
                  side="put"
                  sortField={sortField}
                  sortDir={sortDir}
                  onSort={handleSort}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </>
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
  highlightStrike,
  side,
  sortField,
  sortDir,
  onSort,
  isLoading,
}: {
  contracts: OptionContract[]
  currentPrice: number
  highlightStrike: number | null
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
          const isFocused = highlightStrike != null && Math.round(contract.strike) === Math.round(highlightStrike)

          return (
            <tr
              key={contract.strike}
              className={cn(
                'border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors',
                isITM && (side === 'call' ? 'bg-emerald-500/[0.04]' : 'bg-red-500/[0.04]'),
                isATM && 'border-l-2 border-l-emerald-500',
                isFocused && 'ring-1 ring-violet-500/35 bg-violet-500/[0.08]'
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
