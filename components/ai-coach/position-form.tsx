'use client'

import { useState, useCallback } from 'react'
import {
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { SymbolSearch } from './symbol-search'
import {
  analyzePosition,
  AICoachAPIError,
  type PositionInput,
  type PositionType,
  type PositionAnalysis,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface PositionFormProps {
  onClose: () => void
  onAnalysisComplete?: (analysis: PositionAnalysis) => void
}

const POSITION_TYPES: { value: PositionType; label: string; requiresStrike: boolean; requiresExpiry: boolean }[] = [
  { value: 'call', label: 'Long Call', requiresStrike: true, requiresExpiry: true },
  { value: 'put', label: 'Long Put', requiresStrike: true, requiresExpiry: true },
  { value: 'stock', label: 'Stock', requiresStrike: false, requiresExpiry: false },
]

// ============================================
// COMPONENT
// ============================================

export function PositionForm({ onClose, onAnalysisComplete }: PositionFormProps) {
  const { session } = useMemberAuth()

  const [form, setForm] = useState<{
    symbol: string
    type: PositionType
    strike: string
    expiry: string
    quantity: string
    entryPrice: string
    entryDate: string
  }>({
    symbol: 'SPY',
    type: 'call',
    strike: '',
    expiry: '',
    quantity: '1',
    entryPrice: '',
    entryDate: new Date().toISOString().split('T')[0],
  })

  const [analysis, setAnalysis] = useState<PositionAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const posType = POSITION_TYPES.find(t => t.value === form.type)!

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setAnalysis(null)
    setError(null)
  }

  const handleAnalyze = useCallback(async () => {
    const token = session?.access_token
    if (!token) return

    // Validate
    if (posType.requiresStrike && !form.strike) {
      setError('Strike price is required')
      return
    }
    if (posType.requiresExpiry && !form.expiry) {
      setError('Expiry date is required')
      return
    }
    if (!form.entryPrice || parseFloat(form.entryPrice) <= 0) {
      setError('Entry price must be greater than 0')
      return
    }
    if (!form.quantity || parseInt(form.quantity) === 0) {
      setError('Quantity cannot be zero')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    const position: PositionInput = {
      symbol: form.symbol,
      type: form.type,
      quantity: parseInt(form.quantity),
      entryPrice: parseFloat(form.entryPrice),
      entryDate: form.entryDate,
      ...(posType.requiresStrike ? { strike: parseFloat(form.strike) } : {}),
      ...(posType.requiresExpiry ? { expiry: form.expiry } : {}),
    }

    try {
      const result = await analyzePosition(position, token)
      setAnalysis(result)
      onAnalysisComplete?.(result)
    } catch (err) {
      const msg = err instanceof AICoachAPIError ? err.apiError.message : 'Failed to analyze position'
      setError(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }, [session?.access_token, form, posType, onAnalysisComplete])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Analyze Position</h2>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Symbol & Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Symbol</label>
            <SymbolSearch
              value={form.symbol}
              onChange={(symbol) => handleChange('symbol', symbol)}
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Type</label>
            <select
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            >
              {POSITION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Strike(s) & Expiry */}
        {posType.requiresStrike && (
          <div className={cn('grid gap-3 grid-cols-2')}>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Strike</label>
              <input
                type="number"
                value={form.strike}
                onChange={(e) => handleChange('strike', e.target.value)}
                placeholder="5900"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            {posType.requiresExpiry && (
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Expiry</label>
                <input
                  type="date"
                  value={form.expiry}
                  onChange={(e) => handleChange('expiry', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            )}
          </div>
        )}

        {/* Quantity, Entry Price, Entry Date */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Qty</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)}
              placeholder="1"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
            />
            <p className="text-[10px] text-white/30 mt-0.5">Negative = short</p>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Entry Price</label>
            <input
              type="number"
              step="0.01"
              value={form.entryPrice}
              onChange={(e) => handleChange('entryPrice', e.target.value)}
              placeholder="25.50"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Entry Date</label>
            <input
              type="date"
              value={form.entryDate}
              onChange={(e) => handleChange('entryDate', e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze Position'
          )}
        </button>

        {/* Analysis Result */}
        {analysis && <AnalysisResult analysis={analysis} />}
      </div>
    </div>
  )
}

// ============================================
// ANALYSIS RESULT
// ============================================

function AnalysisResult({ analysis }: { analysis: PositionAnalysis }) {
  const pnlPositive = analysis.pnl >= 0

  return (
    <div className="glass-card-heavy rounded-xl p-4 space-y-4 border-emerald-500/10">
      {/* P&L Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">Unrealized P&L</p>
          <p className={cn(
            'text-lg font-bold',
            pnlPositive ? 'text-emerald-400' : 'text-red-400'
          )}>
            {pnlPositive ? '+' : ''}{formatDollar(analysis.pnl)}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium',
          pnlPositive
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400'
        )}>
          {pnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {pnlPositive ? '+' : ''}{analysis.pnlPct.toFixed(2)}%
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricRow label="Cost Basis" value={formatDollar(analysis.costBasis)} />
        <MetricRow label="Current Value" value={formatDollar(analysis.currentValue)} />
        <MetricRow label="Days Held" value={String(analysis.daysHeld)} />
        <MetricRow label="Days to Expiry" value={String(analysis.daysToExpiry)} />
        <MetricRow label="Breakeven" value={analysis.breakeven ? `$${analysis.breakeven.toLocaleString()}` : '-'} />
        <MetricRow label="Risk/Reward" value={analysis.riskRewardRatio ? analysis.riskRewardRatio.toFixed(2) : '-'} />
        <MetricRow label="Max Gain" value={typeof analysis.maxGain === 'number' ? formatDollar(analysis.maxGain) : analysis.maxGain} />
        <MetricRow label="Max Loss" value={typeof analysis.maxLoss === 'number' ? formatDollar(analysis.maxLoss) : analysis.maxLoss} />
      </div>

      {/* Greeks */}
      <div>
        <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Greeks</h4>
        <div className="grid grid-cols-4 gap-2">
          <GreekCard label="Delta" value={analysis.greeks.delta} precision={2} />
          <GreekCard label="Gamma" value={analysis.greeks.gamma} precision={4} />
          <GreekCard label="Theta" value={analysis.greeks.theta} precision={2} negative />
          <GreekCard label="Vega" value={analysis.greeks.vega} precision={2} />
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-white/40">{label}</p>
      <p className="text-xs text-white font-medium">{value}</p>
    </div>
  )
}

function GreekCard({ label, value, precision, negative }: {
  label: string; value: number; precision: number; negative?: boolean
}) {
  return (
    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-center">
      <p className="text-[10px] text-white/40">{label}</p>
      <p className={cn(
        'text-xs font-mono font-medium',
        negative ? 'text-red-400' : 'text-white/80'
      )}>
        {value.toFixed(precision)}
      </p>
    </div>
  )
}

function formatDollar(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs >= 1000
    ? `$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${abs.toFixed(2)}`
  return value < 0 ? `-${formatted}` : formatted
}
