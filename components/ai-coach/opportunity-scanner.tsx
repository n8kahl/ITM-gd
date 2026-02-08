'use client'

import { useState, useCallback } from 'react'
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
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { sendChatMessage, type ChatMessageResponse } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface OpportunityScannerProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

interface Opportunity {
  type: 'technical' | 'options'
  setupType: string
  symbol: string
  direction: 'bullish' | 'bearish' | 'neutral'
  score: number
  currentPrice: number
  description: string
  suggestedTrade?: {
    strategy: string
    strikes?: number[]
    expiry?: string
    entry?: number
    stopLoss?: number
    target?: number
    estimatedCredit?: number
    maxProfit?: string
    maxLoss?: string
    probability?: string
  }
  metadata: Record<string, any>
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

  const token = session?.access_token

  const runScan = useCallback(async () => {
    if (!token) return
    setIsScanning(true)
    setScanError(null)

    try {
      // Use the chat API to trigger scan_opportunities function
      const response: ChatMessageResponse = await sendChatMessage(
        'Scan for trading opportunities across SPX and NDX. Include options analysis.',
        token
      )

      // Parse opportunities from the AI response function calls
      const scanResult = response.functionCalls?.find(
        fc => fc.function === 'scan_opportunities'
      )

      if (scanResult?.result) {
        const result = scanResult.result as any
        if (result.opportunities) {
          setOpportunities(result.opportunities)
        } else {
          setOpportunities([])
        }
      } else {
        setOpportunities([])
      }

      setLastScanTime(new Date().toLocaleTimeString())
    } catch (err) {
      setScanError('Failed to scan for opportunities. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }, [token])

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
            disabled={isScanning}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
              isScanning
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20'
            )}
          >
            {isScanning ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
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
              Scan SPX &amp; NDX for technical setups, options opportunities, and more
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
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-white/50">Scanning markets...</p>
            <p className="text-xs text-white/25">Analyzing technical setups and options flow</p>
          </div>
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
                key={idx}
                opportunity={opp}
                onAskAI={onSendPrompt}
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
}: {
  opportunity: Opportunity
  onAskAI?: (prompt: string) => void
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

  return (
    <div
      className={cn(
        'glass-card-heavy rounded-lg p-3 border border-white/5 cursor-pointer transition-all hover:border-emerald-500/20',
        expanded && 'border-emerald-500/20'
      )}
      onClick={() => setExpanded(!expanded)}
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
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
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

          {/* Ask AI button */}
          {onAskAI && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAskAI(`Tell me more about this ${opportunity.setupType} setup on ${opportunity.symbol}. What's the risk/reward and how should I trade it?`)
              }}
              className="flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 mt-1 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Ask AI for analysis
            </button>
          )}
        </div>
      )}
    </div>
  )
}
