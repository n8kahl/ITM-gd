'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  Activity,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { WidgetActionBar } from './widget-action-bar'
import { WidgetContextMenu } from './widget-context-menu'
import {
  alertAction,
  chatAction,
  copyAction,
  optionsAction,
  type WidgetAction,
} from './widget-actions'
import {
  scanOpportunities as apiScanOpportunities,
  getWatchlists,
  createWatchlist,
  updateWatchlist,
  trackSetup,
  AICoachAPIError,
  type ScanOpportunity,
  type ChartTimeframe,
} from '@/lib/api/ai-coach'
import { SymbolSearch } from './symbol-search'
import { ScannerSkeleton } from './skeleton-loaders'

// ============================================
// TYPES
// ============================================

interface OpportunityScannerProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

type Opportunity = ScanOpportunity
type TrackStatus = 'idle' | 'saving' | 'saved' | 'duplicate' | 'error'

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.+-]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function getOpportunityFocusPrice(opportunity: Opportunity): number {
  const suggested = parseNumeric(opportunity.suggestedTrade?.entry)
  if (suggested != null) return suggested

  const stop = parseNumeric(opportunity.suggestedTrade?.stopLoss)
  if (stop != null) return stop

  const target = parseNumeric(opportunity.suggestedTrade?.target)
  if (target != null) return target

  return opportunity.currentPrice
}

function getOpportunityStrike(opportunity: Opportunity): number | undefined {
  const firstSuggested = opportunity.suggestedTrade?.strikes?.[0]
  if (typeof firstSuggested === 'number' && Number.isFinite(firstSuggested)) {
    return firstSuggested
  }

  const entry = parseNumeric(opportunity.suggestedTrade?.entry)
  return entry != null ? entry : undefined
}

function openOpportunityChart(opportunity: Opportunity, timeframe: ChartTimeframe = '15m') {
  if (typeof window === 'undefined') return

  const support: Array<{ name: string; price: number }> = []
  const resistance: Array<{ name: string; price: number }> = []

  const entry = parseNumeric(opportunity.suggestedTrade?.entry)
  const stopLoss = parseNumeric(opportunity.suggestedTrade?.stopLoss)
  const target = parseNumeric(opportunity.suggestedTrade?.target)
  const spot = parseNumeric(opportunity.currentPrice)
  const isBearish = opportunity.direction === 'bearish'

  if (entry != null) {
    if (isBearish) resistance.push({ name: 'Entry', price: entry })
    else support.push({ name: 'Entry', price: entry })
  }

  if (target != null) {
    if (entry != null) {
      if (target >= entry) resistance.push({ name: 'Target', price: target })
      else support.push({ name: 'Target', price: target })
    } else if (isBearish) {
      support.push({ name: 'Target', price: target })
    } else {
      resistance.push({ name: 'Target', price: target })
    }
  }

  if (stopLoss != null) {
    if (entry != null) {
      if (stopLoss >= entry) resistance.push({ name: 'Stop', price: stopLoss })
      else support.push({ name: 'Stop', price: stopLoss })
    } else if (isBearish) {
      resistance.push({ name: 'Stop', price: stopLoss })
    } else {
      support.push({ name: 'Stop', price: stopLoss })
    }
  }

  if (spot != null) {
    support.push({ name: 'Spot', price: spot })
  }

  window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
    detail: {
      symbol: opportunity.symbol,
      timeframe,
      levels: {
        resistance,
        support,
      },
    },
  }))
}

// ============================================
// COMPONENT
// ============================================

export function OpportunityScanner({ onClose, onSendPrompt }: OpportunityScannerProps) {
  const { session } = useMemberAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<string | null>(null)
  const [filterDirection, setFilterDirection] = useState<'all' | 'bullish' | 'bearish' | 'neutral'>('all')
  const [filterType, setFilterType] = useState<'all' | 'technical' | 'options'>('all')
  const [scanSymbols, setScanSymbols] = useState<string[]>(['SPX', 'NDX'])
  const [defaultWatchlistId, setDefaultWatchlistId] = useState<string | null>(null)
  const [isLoadingWatchlist, setIsLoadingWatchlist] = useState(false)
  const [isSavingWatchlist, setIsSavingWatchlist] = useState(false)
  const [isEditingWatchlist, setIsEditingWatchlist] = useState(false)
  const [watchlistInput, setWatchlistInput] = useState('SPX, NDX')
  const [watchlistSymbolPicker, setWatchlistSymbolPicker] = useState('SPY')
  const [watchlistError, setWatchlistError] = useState<string | null>(null)
  const [trackStatusById, setTrackStatusById] = useState<Record<string, TrackStatus>>({})

  const token = session?.access_token

  useEffect(() => {
    if (!token) return

    let cancelled = false

    const loadWatchlist = async () => {
      setIsLoadingWatchlist(true)
      setWatchlistError(null)

      try {
        const result = await getWatchlists(token)
        const symbols = result.defaultWatchlist?.symbols?.filter(Boolean) || []
        const watchlistId = result.defaultWatchlist?.id || null

        if (!cancelled && symbols.length > 0) {
          setScanSymbols(symbols)
          setDefaultWatchlistId(watchlistId)
          setWatchlistInput(symbols.join(', '))
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof AICoachAPIError
          ? err.apiError.message
          : 'Unable to load your watchlist. Using defaults.'
        setWatchlistError(message)
        setScanSymbols(['SPX', 'NDX'])
      } finally {
        if (!cancelled) {
          setIsLoadingWatchlist(false)
        }
      }
    }

    void loadWatchlist()

    return () => {
      cancelled = true
    }
  }, [token])

  const runScan = useCallback(async () => {
    if (!token) return
    setIsScanning(true)
    setScanError(null)

    try {
      const result = await apiScanOpportunities(token, {
        symbols: scanSymbols,
        includeOptions: true,
      })

      setOpportunities(result.opportunities)
      setLastScanTime(new Date().toLocaleTimeString())
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to scan for opportunities. Please try again.'
      setScanError(message)
    } finally {
      setIsScanning(false)
    }
  }, [scanSymbols, token])

  const handleSaveWatchlist = useCallback(async () => {
    if (!token) return

    const parsedSymbols = watchlistInput
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => /^[A-Z0-9._:-]{1,10}$/.test(symbol))

    const uniqueSymbols = Array.from(new Set(parsedSymbols)).slice(0, 20)
    if (uniqueSymbols.length === 0) {
      setWatchlistError('Enter at least one valid symbol (e.g., SPX, AAPL, NVDA).')
      return
    }

    setIsSavingWatchlist(true)
    setWatchlistError(null)

    try {
      if (defaultWatchlistId) {
        const result = await updateWatchlist(defaultWatchlistId, token, {
          symbols: uniqueSymbols,
          isDefault: true,
        })
        const defaultSymbols = result.defaultWatchlist?.symbols || uniqueSymbols
        setDefaultWatchlistId(result.defaultWatchlist?.id || defaultWatchlistId)
        setScanSymbols(defaultSymbols)
        setWatchlistInput(defaultSymbols.join(', '))
      } else {
        const result = await createWatchlist(token, {
          name: 'Default',
          symbols: uniqueSymbols,
          isDefault: true,
        })
        const defaultSymbols = result.defaultWatchlist?.symbols || uniqueSymbols
        setDefaultWatchlistId(result.defaultWatchlist?.id || result.watchlist.id)
        setScanSymbols(defaultSymbols)
        setWatchlistInput(defaultSymbols.join(', '))
      }

      setIsEditingWatchlist(false)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to save watchlist.'
      setWatchlistError(message)
    } finally {
      setIsSavingWatchlist(false)
    }
  }, [defaultWatchlistId, token, watchlistInput])

  const handleTrackSetup = useCallback(async (opportunity: Opportunity) => {
    if (!token) return

    setTrackStatusById((prev) => ({ ...prev, [opportunity.id]: 'saving' }))

    try {
      const result = await trackSetup(token, {
        source_opportunity_id: opportunity.id,
        symbol: opportunity.symbol,
        setup_type: opportunity.setupType,
        direction: opportunity.direction,
        opportunity_data: opportunity as unknown as Record<string, unknown>,
      })

      setTrackStatusById((prev) => ({
        ...prev,
        [opportunity.id]: result.duplicate ? 'duplicate' : 'saved',
      }))
    } catch {
      setTrackStatusById((prev) => ({ ...prev, [opportunity.id]: 'error' }))
    }
  }, [token])

  const handleAddWatchlistSymbol = useCallback(() => {
    const nextSymbol = watchlistSymbolPicker.trim().toUpperCase()
    if (!/^[A-Z0-9._:-]{1,10}$/.test(nextSymbol)) {
      setWatchlistError('Select a valid symbol before adding.')
      return
    }

    const existing = watchlistInput
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)

    if (existing.includes(nextSymbol)) {
      setWatchlistError(`${nextSymbol} is already in your watchlist.`)
      return
    }

    const updated = [...existing, nextSymbol].slice(0, 20)
    setWatchlistInput(updated.join(', '))
    setWatchlistError(null)
  }, [watchlistInput, watchlistSymbolPicker])

  const filteredOpportunities = opportunities.filter(opp => {
    if (filterDirection !== 'all' && opp.direction !== filterDirection) return false
    if (filterType !== 'all' && opp.type !== filterType) return false
    return true
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Opportunity Scanner</h2>
          {opportunities.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {opportunities.length} found
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={isScanning || isLoadingWatchlist}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
              isScanning || isLoadingWatchlist
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            {isScanning || isLoadingWatchlist ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {isLoadingWatchlist ? 'Loading...' : isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 border-b border-white/5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-white/35">
              Watchlist: <span className="text-white/60">{scanSymbols.join(', ')}</span>
            </p>
            <button
              onClick={() => setIsEditingWatchlist((prev) => !prev)}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {isEditingWatchlist ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {isEditingWatchlist && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  value={watchlistInput}
                  onChange={(e) => setWatchlistInput(e.target.value)}
                  placeholder="SPX, NDX, AAPL"
                  className="flex-1 h-8 rounded-md bg-white/5 border border-white/10 px-2 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-emerald-500/40"
                />
                <button
                  onClick={handleSaveWatchlist}
                  disabled={isSavingWatchlist}
                  className={cn(
                    'h-8 px-3 rounded-md text-xs border transition-all',
                    isSavingWatchlist
                      ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                      : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
                  )}
                >
                  {isSavingWatchlist ? 'Saving...' : 'Save'}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <SymbolSearch
                  value={watchlistSymbolPicker}
                  onChange={setWatchlistSymbolPicker}
                  className="flex-1"
                />
                <button
                  onClick={handleAddWatchlistSymbol}
                  className="h-8 px-3 rounded-md text-xs border text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20 transition-all"
                >
                  Add Symbol
                </button>
              </div>
            </div>
          )}
          {watchlistError && (
            <p className="text-[10px] text-amber-400 mt-1">{watchlistError}</p>
          )}
        </div>

        {/* Filters */}
        <div className="px-4 py-2 flex items-center gap-4 border-b border-white/5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/30 mr-1">Direction:</span>
            {(['all', 'bullish', 'bearish', 'neutral'] as const).map(dir => (
              <button
                key={dir}
                onClick={() => setFilterDirection(dir)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded transition-colors',
                  filterDirection === dir
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/40 hover:text-white/60'
                )}
              >
                {dir.charAt(0).toUpperCase() + dir.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/30 mr-1">Type:</span>
            {(['all', 'technical', 'options'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded transition-colors',
                  filterType === type
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/40 hover:text-white/60'
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Scan prompt when empty */}
        {!isScanning && !scanError && opportunities.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40 mb-2">No scan results yet</p>
            <p className="text-xs text-white/25 mb-6">
              Scan {scanSymbols.join(', ')} for technical setups, options opportunities, and more
            </p>
            <button
              onClick={runScan}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              Run Scanner
            </button>
          </div>
        )}

        {/* Loading */}
        {isScanning && (
          <ScannerSkeleton />
        )}

        {/* Error */}
        {scanError && !isScanning && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{scanError}</p>
            <button onClick={runScan} className="text-xs text-emerald-500 hover:text-emerald-400">
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {!isScanning && !scanError && filteredOpportunities.length > 0 && (
          <div className="p-4 space-y-3">
            {lastScanTime && (
              <p className="text-[10px] text-white/20 text-right">Last scan: {lastScanTime}</p>
            )}
            {filteredOpportunities.map((opp, idx) => (
              <OpportunityCard
                key={opp.id || idx}
                opportunity={opp}
                onAskAI={onSendPrompt}
                onTrackSetup={handleTrackSetup}
                trackStatus={trackStatusById[opp.id] || 'idle'}
              />
            ))}
          </div>
        )}

        {/* No results after filter */}
        {!isScanning && !scanError && opportunities.length > 0 && filteredOpportunities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-white/40">No opportunities match current filters</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// OPPORTUNITY CARD
// ============================================

function OpportunityCard({
  opportunity,
  onAskAI,
  onTrackSetup,
  trackStatus,
}: {
  opportunity: Opportunity
  onAskAI?: (prompt: string) => void
  onTrackSetup?: (opportunity: Opportunity) => void
  trackStatus: TrackStatus
}) {
  const [expanded, setExpanded] = useState(false)

  const DirectionIcon = opportunity.direction === 'bullish' ? TrendingUp
    : opportunity.direction === 'bearish' ? TrendingDown
    : Minus

  const directionColor = opportunity.direction === 'bullish' ? 'text-emerald-400'
    : opportunity.direction === 'bearish' ? 'text-red-400'
    : 'text-amber-400'

  const typeIcon = opportunity.type === 'technical' ? Activity : BarChart3

  const TypeIcon = typeIcon

  const scoreColor = opportunity.score >= 70 ? 'text-emerald-400 bg-emerald-500/10'
    : opportunity.score >= 50 ? 'text-amber-400 bg-amber-500/10'
    : 'text-white/40 bg-white/5'

  const isTrackDisabled = trackStatus === 'saving' || trackStatus === 'saved' || trackStatus === 'duplicate'
  const trackLabel = trackStatus === 'saving'
    ? 'Tracking...'
    : trackStatus === 'saved'
      ? 'Tracked'
      : trackStatus === 'duplicate'
        ? 'Already Tracked'
        : trackStatus === 'error'
          ? 'Retry Track'
          : 'Track This Setup'

  const focusPrice = getOpportunityFocusPrice(opportunity)
  const strike = getOpportunityStrike(opportunity)
  const askPrompt = `Tell me more about this ${opportunity.setupType} setup on ${opportunity.symbol}. What's the risk/reward and how should I trade it?`

  const workflowActions: WidgetAction[] = [
    {
      label: 'Show on Chart',
      icon: Activity,
      variant: 'primary',
      tooltip: `${opportunity.symbol} ${opportunity.setupType} setup`,
      action: () => openOpportunityChart(opportunity, '15m'),
    },
    optionsAction(opportunity.symbol, strike ?? focusPrice, opportunity.suggestedTrade?.expiry),
    alertAction(
      opportunity.symbol,
      focusPrice,
      opportunity.direction === 'bearish' ? 'price_below' : 'price_above',
      `Scanner setup: ${opportunity.setupType}`,
    ),
    onAskAI
      ? {
          label: 'Ask AI',
          icon: Zap,
          variant: 'secondary',
          action: () => onAskAI(askPrompt),
        }
      : chatAction(askPrompt),
  ]

  const contextActions: WidgetAction[] = [
    ...workflowActions,
    copyAction(`${opportunity.symbol} ${opportunity.setupType} ${focusPrice.toFixed(2)}`),
  ]

  return (
    <WidgetContextMenu actions={contextActions}>
      <div
        className={cn(
          'glass-card-heavy rounded-lg p-3 border border-white/5 cursor-pointer transition-all hover:border-emerald-500/20',
          expanded && 'border-emerald-500/20'
        )}
        onClick={() => openOpportunityChart(opportunity, '15m')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            openOpportunityChart(opportunity, '15m')
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${opportunity.symbol} ${opportunity.setupType} setup on chart`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DirectionIcon className={cn('w-4 h-4', directionColor)} />
            <span className="text-sm font-medium text-white">{opportunity.symbol}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', scoreColor)}>
              Score: {opportunity.score}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <TypeIcon className="w-3 h-3" />
              {opportunity.setupType}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((prev) => !prev)
              }}
              className="rounded border border-white/10 bg-white/5 p-1 text-white/35 transition-colors hover:text-white/70 hover:border-emerald-500/30"
              title={expanded ? 'Hide details' : 'Show details'}
              aria-label={expanded ? `Hide ${opportunity.symbol} details` : `Show ${opportunity.symbol} details`}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-white/60 mb-2">{opportunity.description}</p>

        {/* Price */}
        <div className="flex items-center gap-3 text-xs">
          <div>
            <span className="text-white/30">Price:</span>
            <span className="text-white/70 ml-1 font-medium">${opportunity.currentPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-white/30">Direction:</span>
            <span className={cn('ml-1 font-medium', directionColor)}>
              {opportunity.direction}
            </span>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/5 space-y-2" onClick={(event) => event.stopPropagation()}>
            {/* Suggested Trade */}
            {opportunity.suggestedTrade && (
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[10px] text-white/30 mb-1.5">SUGGESTED TRADE</p>
                <p className="text-xs text-white/70 font-medium mb-1">
                  {opportunity.suggestedTrade.strategy}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  {opportunity.suggestedTrade.entry && (
                    <div>
                      <span className="text-white/30">Entry:</span>
                      <span className="text-white/60 ml-1">${opportunity.suggestedTrade.entry.toFixed(2)}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.stopLoss && (
                    <div>
                      <span className="text-white/30">Stop:</span>
                      <span className="text-red-400 ml-1">${opportunity.suggestedTrade.stopLoss.toFixed(2)}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.target && (
                    <div>
                      <span className="text-white/30">Target:</span>
                      <span className="text-emerald-400 ml-1">${opportunity.suggestedTrade.target.toFixed(2)}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.maxProfit && (
                    <div>
                      <span className="text-white/30">Max Profit:</span>
                      <span className="text-emerald-400 ml-1">{opportunity.suggestedTrade.maxProfit}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.maxLoss && (
                    <div>
                      <span className="text-white/30">Max Loss:</span>
                      <span className="text-red-400 ml-1">{opportunity.suggestedTrade.maxLoss}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.probability && (
                    <div>
                      <span className="text-white/30">Probability:</span>
                      <span className="text-white/60 ml-1">{opportunity.suggestedTrade.probability}</span>
                    </div>
                  )}
                  {opportunity.suggestedTrade.strikes && (
                    <div className="col-span-2">
                      <span className="text-white/30">Strikes:</span>
                      <span className="text-white/60 ml-1">
                        {opportunity.suggestedTrade.strikes.join(' / ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            {Object.keys(opportunity.metadata).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(opportunity.metadata).map(([key, value]) => (
                  <span key={key} className="text-[10px] text-white/30 bg-white/5 rounded px-1.5 py-0.5">
                    {key.replace(/_/g, ' ')}: <span className="text-white/50">{String(value)}</span>
                  </span>
                ))}
              </div>
            )}

            <WidgetActionBar actions={workflowActions} />

            {/* Ask AI button */}
            <div className="flex items-center gap-2 pt-1">
              {onTrackSetup && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onTrackSetup(opportunity)
                  }}
                  disabled={isTrackDisabled}
                  className={cn(
                    'flex items-center gap-1.5 text-xs transition-colors',
                    isTrackDisabled
                      ? 'text-white/35 cursor-not-allowed'
                      : 'text-emerald-500 hover:text-emerald-400',
                    trackStatus === 'error' && 'text-red-400 hover:text-red-300'
                  )}
                >
                  {trackStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                  {trackLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </WidgetContextMenu>
  )
}
