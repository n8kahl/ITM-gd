'use client'

import {
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  Bell,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  DollarSign,
  Search,
  Calendar,
  Workflow,
} from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { GEXChart } from './gex-chart'
import { WidgetActionBar } from './widget-action-bar'
import { WidgetContextMenu } from './widget-context-menu'
import {
  type WidgetAction,
  alertAction,
  analyzeAction,
  chartAction,
  chatAction,
  copyAction,
  optionsAction,
  viewAction,
} from './widget-actions'
import type { ChartTimeframe, PositionType } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

export type WidgetType =
  | 'key_levels'
  | 'position_summary'
  | 'pnl_tracker'
  | 'alert_status'
  | 'market_overview'
  | 'macro_context'
  | 'options_chain'
  | 'gex_profile'
  | 'scan_results'
  | 'current_price'
  | 'spx_game_plan'
  | 'zero_dte_analysis'
  | 'iv_analysis'
  | 'earnings_calendar'
  | 'earnings_analysis'
  | 'journal_insights'
  | 'trade_history'

export interface WidgetData {
  type: WidgetType
  data: Record<string, unknown>
}

function normalizePositionType(value: string | undefined): PositionType {
  const normalized = value?.toLowerCase()
  if (
    normalized === 'call'
    || normalized === 'put'
    || normalized === 'stock'
  ) {
    return normalized
  }
  return 'call'
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.+-]/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseNullableNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.+-]/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function formatPrice(value: unknown, digits = 2): string {
  const numeric = parseNullableNumeric(value)
  if (numeric == null) return '—'
  return `$${numeric.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function formatTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function premiumCardClass(extra: string): string {
  return cn(
    'glass-card-heavy relative mt-2 overflow-hidden rounded-xl border bg-gradient-to-b from-white/[0.04] to-black/25 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
    'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_42%)]',
    extra,
  )
}

function pillClass(tone: 'neutral' | 'success' | 'danger' | 'warning' | 'info' = 'neutral'): string {
  if (tone === 'success') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
  if (tone === 'danger') return 'border-red-500/25 bg-red-500/10 text-red-300'
  if (tone === 'warning') return 'border-amber-500/25 bg-amber-500/10 text-amber-300'
  if (tone === 'info') return 'border-sky-500/25 bg-sky-500/10 text-sky-300'
  return 'border-white/15 bg-white/5 text-white/55'
}

function normalizeActions(actions: WidgetAction[]): WidgetAction[] {
  const unique = new Map<string, WidgetAction>()
  for (const action of actions) {
    const key = `${action.label}:${action.variant || 'secondary'}`
    if (!unique.has(key)) unique.set(key, action)
  }
  return Array.from(unique.values()).slice(0, 5)
}

function shouldIgnoreCardActivation(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('button, a, input, textarea, select, [role="menuitem"], [data-card-ignore="true"]'))
}

function handleCardClick(event: MouseEvent<HTMLElement>, onActivate: () => void) {
  if (shouldIgnoreCardActivation(event.target)) return
  onActivate()
}

function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, onActivate: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (shouldIgnoreCardActivation(event.target)) return
  event.preventDefault()
  onActivate()
}

type ScannerOpportunityLike = {
  symbol: string
  setupType: string
  direction: string
  currentPrice?: number
  suggestedTrade?: {
    entry?: number
    stopLoss?: number
    target?: number
  }
}

type KeyLevelLike = { name: string; price: number; distance?: string }

function openKeyLevelsChart(args: {
  symbol: string
  resistance: KeyLevelLike[]
  support: KeyLevelLike[]
  vwap?: number
  atr14?: number
  timeframe?: ChartTimeframe
}) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
    detail: {
      symbol: args.symbol,
      timeframe: args.timeframe || '5m',
      levels: {
        resistance: args.resistance,
        support: args.support,
        indicators: {
          vwap: args.vwap,
          atr14: args.atr14,
        },
      },
    },
  }))
}

function openScannerSetupChart(opportunity: ScannerOpportunityLike, timeframe: ChartTimeframe = '15m') {
  if (typeof window === 'undefined') return

  const support: Array<{ name: string; price: number }> = []
  const resistance: Array<{ name: string; price: number }> = []

  const entry = parseNullableNumeric(opportunity.suggestedTrade?.entry)
  const stopLoss = parseNullableNumeric(opportunity.suggestedTrade?.stopLoss)
  const target = parseNullableNumeric(opportunity.suggestedTrade?.target)
  const currentPrice = parseNullableNumeric(opportunity.currentPrice)
  const direction = String(opportunity.direction || '').toLowerCase()

  if (entry != null) {
    if (direction === 'bearish') resistance.push({ name: 'Entry', price: entry })
    else support.push({ name: 'Entry', price: entry })
  }

  if (target != null) {
    if (entry != null) {
      if (target >= entry) resistance.push({ name: 'Target', price: target })
      else support.push({ name: 'Target', price: target })
    } else if (direction === 'bearish') {
      support.push({ name: 'Target', price: target })
    } else {
      resistance.push({ name: 'Target', price: target })
    }
  }

  if (stopLoss != null) {
    if (entry != null) {
      if (stopLoss >= entry) resistance.push({ name: 'Stop', price: stopLoss })
      else support.push({ name: 'Stop', price: stopLoss })
    } else if (direction === 'bearish') {
      resistance.push({ name: 'Stop', price: stopLoss })
    } else {
      support.push({ name: 'Stop', price: stopLoss })
    }
  }

  if (currentPrice != null) {
    support.push({ name: 'Spot', price: currentPrice })
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

function scannerChartAction(opportunity: ScannerOpportunityLike, timeframe: ChartTimeframe = '15m'): WidgetAction {
  return {
    label: 'Show on Chart',
    icon: Activity,
    variant: 'primary',
    tooltip: `${opportunity.symbol} scanner setup (${timeframe})`,
    action: () => {
      openScannerSetupChart(opportunity, timeframe)
    },
  }
}

// ============================================
// WIDGET CARD WRAPPER
// ============================================

export function WidgetCard({ widget }: { widget: WidgetData }) {
  let content: any = null
  switch (widget.type) {
    case 'key_levels':
      content = <KeyLevelsCard data={widget.data} />
      break
    case 'position_summary':
      content = <PositionSummaryCard data={widget.data} />
      break
    case 'pnl_tracker':
      content = <PnLTrackerCard data={widget.data} />
      break
    case 'market_overview':
      content = <MarketOverviewCard data={widget.data} />
      break
    case 'alert_status':
      content = <AlertStatusCard data={widget.data} />
      break
    case 'macro_context':
      content = <MacroContextCard data={widget.data} />
      break
    case 'options_chain':
      content = <OptionsChainCard data={widget.data} />
      break
    case 'gex_profile':
      content = <GEXProfileCard data={widget.data} />
      break
    case 'scan_results':
      content = <ScanResultsCard data={widget.data} />
      break
    case 'current_price':
      content = <CurrentPriceCard data={widget.data} />
      break
    case 'spx_game_plan':
      content = <SPXGamePlanCard data={widget.data} />
      break
    case 'zero_dte_analysis':
      content = <ZeroDTEAnalysisCard data={widget.data} />
      break
    case 'iv_analysis':
      content = <IVAnalysisCard data={widget.data} />
      break
    case 'earnings_calendar':
      content = <EarningsCalendarCard data={widget.data} />
      break
    case 'earnings_analysis':
      content = <EarningsAnalysisCard data={widget.data} />
      break
    case 'journal_insights':
      content = <JournalInsightsCard data={widget.data} />
      break
    case 'trade_history':
      content = <TradeHistoryCard data={widget.data} />
      break
    default:
      return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {content}
    </motion.div>
  )
}

// ============================================
// KEY LEVELS CARD
// ============================================

function KeyLevelsCard({ data }: { data: Record<string, unknown> }) {
  const symbol = data.symbol as string || 'SPX'
  const currentPrice = parseNumeric(data.currentPrice)
  const resistance = (data.resistance as KeyLevelLike[]) || []
  const support = (data.support as KeyLevelLike[]) || []
  const vwap = data.vwap as number | undefined
  const atr = data.atr14 as number | undefined
  const openCardChart = () => {
    openKeyLevelsChart({
      symbol,
      resistance,
      support,
      vwap,
      atr14: atr,
      timeframe: '5m',
    })
  }
  const cardActions: WidgetAction[] = normalizeActions([
    {
      label: 'Show on Chart',
      icon: Target,
      variant: 'primary',
      tooltip: `${symbol} full key levels (5m)`,
      action: openCardChart,
    },
    optionsAction(symbol, currentPrice),
    alertAction(symbol, currentPrice, 'level_approach', `${symbol} key-level sweep`),
    chatAction(`Summarize ${symbol} key levels and likely scenarios around ${currentPrice.toFixed(2)}.`),
    copyAction(`${symbol} key levels | Spot ${currentPrice.toFixed(2)} | R: ${resistance.slice(0, 2).map((level) => `${level.name} ${level.price}`).join(', ')} | S: ${support.slice(0, 2).map((level) => `${level.name} ${level.price}`).join(', ')}`),
  ])

  const levelActions = (level: { name: string; price: number }, side: 'support' | 'resistance'): WidgetAction[] => ([
    chartAction(symbol, level.price, '5m', level.name),
    optionsAction(symbol, level.price),
    alertAction(
      symbol,
      level.price,
      side === 'resistance' ? 'price_above' : 'price_below',
      `${symbol} ${level.name} (${side})`,
    ),
    copyAction(`${symbol} ${level.name} ${level.price}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCardChart)}
      onKeyDown={(event) => handleCardKeyDown(event, openCardChart)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} key levels on chart`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} Key Levels</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass('neutral'))}>
            {resistance.length + support.length} levels
          </span>
          <span className="text-xs font-mono text-white/80">{formatPrice(currentPrice)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Resistance */}
        <div className="space-y-1">
          <p className="text-[9px] text-red-400/70 font-semibold uppercase tracking-[0.12em]">Resistance</p>
          {resistance.slice(0, 3).map((level) => (
            <WidgetContextMenu key={level.name} actions={levelActions(level, 'resistance')}>
              <button
                type="button"
                onClick={() => chartAction(symbol, level.price, '5m', level.name).action()}
                className="w-full flex justify-between rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer text-left"
              >
                <span className="text-red-400">{level.name}</span>
                <span className="font-mono text-white/60">{formatPrice(level.price)}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>

        {/* Support */}
        <div className="space-y-1">
          <p className="text-[9px] text-emerald-400/70 font-semibold uppercase tracking-[0.12em]">Support</p>
          {support.slice(0, 3).map((level) => (
            <WidgetContextMenu key={level.name} actions={levelActions(level, 'support')}>
              <button
                type="button"
                onClick={() => chartAction(symbol, level.price, '5m', level.name).action()}
                className="w-full flex justify-between rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer text-left"
              >
                <span className="text-emerald-400">{level.name}</span>
                <span className="font-mono text-white/60">{formatPrice(level.price)}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      </div>

      {/* Indicators row */}
      {(vwap || atr) && (
        <div className="mt-2 pt-2 border-t border-white/5 flex gap-3 text-[10px] text-white/40">
          {vwap && <span>VWAP: <span className="text-yellow-400 font-mono">{formatPrice(vwap)}</span></span>}
          {atr && <span>ATR14: <span className="text-white/60 font-mono">{atr.toFixed(2)}</span></span>}
        </div>
      )}

      <WidgetActionBar actions={cardActions} />
    </div>
  )
}

// ============================================
// POSITION SUMMARY CARD
// ============================================

function PositionSummaryCard({ data }: { data: Record<string, unknown> }) {
  const symbol = data.symbol as string || '-'
  const type = data.type as string || '-'
  const strike = data.strike as number | undefined
  const expiry = data.expiry as string | undefined
  const pnl = parseNumeric(data.pnl)
  const pnlPct = parseNumeric(data.pnlPct)
  const currentValue = parseNumeric(data.currentValue)
  const greeks = data.greeks as { delta?: number; theta?: number; gamma?: number; vega?: number } | undefined
  const pnlPositive = pnl >= 0
  const riskTone = pnlPct <= -15 ? 'danger' : pnlPct >= 15 ? 'success' : 'neutral'
  const riskLabel = pnlPct <= -15 ? 'Drawdown' : pnlPct >= 15 ? 'In Profit' : 'Active'
  const entryPrice = parseNumeric(data.entryPrice) || undefined
  const openCard = () => {
    chartAction(symbol, strike, '5m', `${symbol} ${type}`).action()
  }
  const actions: WidgetAction[] = normalizeActions([
    chartAction(symbol, strike),
    optionsAction(symbol, strike, expiry),
    analyzeAction({
      symbol,
      type: normalizePositionType(type),
      strike,
      expiry,
      quantity: 1,
      entryPrice: entryPrice || 1,
      entryDate: new Date().toISOString().slice(0, 10),
    }),
    strike != null ? alertAction(symbol, strike, 'level_approach', `${symbol} ${strike} strike watch`) : chatAction(`Create a risk alert plan for this ${symbol} position.`, 'Risk Plan'),
    chatAction(`What is the best management plan for this ${symbol} ${type.toUpperCase()} right now?`, 'Get Advice'),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} position on chart`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} {type.toUpperCase()}</span>
          {strike && <span className="text-[10px] text-white/40">${strike}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {expiry && <span className="text-[10px] text-white/40">{expiry}</span>}
          <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(riskTone))}>
            {riskLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] text-white/40">P&L</p>
          <p className={cn('text-sm font-bold', pnlPositive ? 'text-emerald-400' : 'text-red-400')}>
            {pnlPositive ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium',
          pnlPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {pnlPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
      </div>

      <div className="text-[10px] text-white/40">
        Value: <span className="text-white/60 font-mono">{formatPrice(currentValue)}</span>
      </div>

      {greeks && (
        <div className="mt-2 pt-2 border-t border-white/5 flex gap-3 text-[10px] text-white/40">
          {greeks.delta != null && <span>D: <span className="font-mono text-white/60">{greeks.delta.toFixed(2)}</span></span>}
          {greeks.gamma != null && <span>G: <span className="font-mono text-white/60">{greeks.gamma.toFixed(4)}</span></span>}
          {greeks.theta != null && <span>T: <span className="font-mono text-red-400">{greeks.theta.toFixed(2)}</span></span>}
          {greeks.vega != null && <span>V: <span className="font-mono text-white/60">{greeks.vega.toFixed(2)}</span></span>}
        </div>
      )}

      <WidgetActionBar actions={actions} />
    </div>
  )
}

// ============================================
// P&L TRACKER CARD
// ============================================

function PnLTrackerCard({ data }: { data: Record<string, unknown> }) {
  const totalPnl = parseNumeric(data.totalPnl)
  const totalPnlPct = parseNumeric(data.totalPnlPct)
  const totalValue = parseNumeric(data.totalValue)
  const positionCount = data.positionCount as number || 0
  const portfolioGreeks = data.portfolioGreeks as {
    delta?: number; gamma?: number; theta?: number; vega?: number
  } | undefined
  const positive = totalPnl >= 0
  const openCard = () => {
    viewAction('position', 'Open Analyzer').action()
  }
  const actions: WidgetAction[] = normalizeActions([
    viewAction('position', 'Open Analyzer'),
    viewAction('journal', 'Open Journal'),
    chatAction('Summarize my portfolio risk and what to manage first.'),
    copyAction(`Portfolio PnL ${positive ? '+' : ''}${totalPnl.toFixed(2)} (${totalPnlPct.toFixed(2)}%), Value ${totalValue.toFixed(2)}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open position analyzer"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-white">Portfolio P&L</span>
        <span className={cn('ml-auto rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(positive ? 'success' : 'danger'))}>
          {positionCount} positions
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className={cn('text-lg font-bold', positive ? 'text-emerald-400' : 'text-red-400')}>
            {positive ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-white/40">
            Total: ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-0.5 px-2 py-1 rounded-lg text-sm font-medium',
          positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {positive ? '+' : ''}{totalPnlPct.toFixed(2)}%
        </div>
      </div>

      {portfolioGreeks && (
        <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-4 gap-1 text-[10px]">
          <div className="text-center">
            <p className="text-white/30">Net D</p>
            <p className="font-mono text-white/60">{portfolioGreeks.delta?.toFixed(1)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30">Net G</p>
            <p className="font-mono text-white/60">{portfolioGreeks.gamma?.toFixed(3)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30">Net T</p>
            <p className="font-mono text-red-400">{portfolioGreeks.theta?.toFixed(1)}</p>
          </div>
          <div className="text-center">
            <p className="text-white/30">Net V</p>
            <p className="font-mono text-white/60">{portfolioGreeks.vega?.toFixed(1)}</p>
          </div>
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

// ============================================
// MARKET OVERVIEW CARD
// ============================================

function MarketOverviewCard({ data }: { data: Record<string, unknown> }) {
  const status = data.status as string || 'closed'
  const session = data.session as string || 'none'
  const message = data.message as string || ''
  const timeInfo = data.timeSinceOpen as string || data.timeUntilOpen as string || ''

  const statusColors: Record<string, string> = {
    open: 'text-emerald-400 bg-emerald-500/10',
    'pre-market': 'text-amber-400 bg-amber-500/10',
    'after-hours': 'text-blue-400 bg-blue-500/10',
    closed: 'text-white/40 bg-white/5',
  }
  const actions: WidgetAction[] = normalizeActions([
    chartAction('SPX'),
    viewAction(status === 'pre-market' ? 'brief' : 'macro', status === 'pre-market' ? 'Open Brief' : 'Open Macro', 'SPX'),
    chatAction('Given current market status, what trading approach should I prioritize?'),
  ])
  const openCard = () => {
    chartAction('SPX').action()
  }

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open SPX market chart"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">Market Status</span>
        </div>
        <span className={cn(
          'rounded border px-2 py-0.5 text-[10px] font-medium capitalize',
          statusColors[status] || statusColors.closed
        )}>
          {status}
        </span>
      </div>
      <p className="text-xs text-white/60">{message}</p>
      {session && session !== 'none' && (
        <p className="mt-1 text-[10px] text-white/35 uppercase tracking-[0.1em]">Session: {session}</p>
      )}
      {timeInfo && <p className="text-[10px] text-white/30 mt-1">{timeInfo}</p>}
      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

// ============================================
// ALERT STATUS CARD
// ============================================

function AlertStatusCard({ data }: { data: Record<string, unknown> }) {
  const alerts = (data.alerts as Array<{
    symbol: string
    type: string
    target: number
    status: string
  }>) || []
  const activeCount = alerts.filter(a => a.status === 'active').length
  const openCard = () => {
    if (alerts[0]) {
      chartAction(alerts[0].symbol, alerts[0].target, '5m', `${alerts[0].type}`).action()
      return
    }
    viewAction('alerts', 'Open Alerts').action()
  }
  const actions: WidgetAction[] = normalizeActions(alerts.length > 0
    ? [
        chartAction(alerts[0].symbol, alerts[0].target),
        alertAction(alerts[0].symbol, alerts[0].target, 'level_approach', `Alert from widget (${alerts[0].type})`),
        viewAction('alerts', 'Manage Alerts', alerts[0].symbol),
        chatAction(`Review my active alerts and suggest which ones to keep or remove.`, 'Review Alerts'),
      ]
    : [viewAction('alerts', 'Open Alerts'), chatAction('Show my active alerts and suggest which ones to keep.')])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open alert context"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">Price Alerts</span>
        </div>
        <span className="text-[10px] text-white/40">{activeCount} active</span>
      </div>

      {alerts.length === 0 ? (
        <p className="text-xs text-white/30">No alerts configured</p>
      ) : (
        <div className="space-y-1.5">
          {alerts.slice(0, 4).map((alert, i) => (
            <WidgetContextMenu
              key={i}
              actions={[
                chartAction(alert.symbol, alert.target, '5m', `${alert.type}`),
                optionsAction(alert.symbol, alert.target),
                alertAction(alert.symbol, alert.target, 'level_approach', `Alert: ${alert.type}`),
                chatAction(`What should I do if ${alert.symbol} hits ${alert.target}?`, 'Ask AI'),
                copyAction(`${alert.symbol} ${alert.type} ${alert.target}`),
              ]}
            >
              <button type="button" className="w-full flex items-center justify-between text-[11px] rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer">
                <span className="text-white/60">{alert.symbol} {alert.type}</span>
                <span className="font-mono text-white/40">${alert.target.toLocaleString()}</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium',
                  alert.status === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : alert.status === 'triggered'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-white/5 text-white/30'
                )}>
                  {alert.status}
                </span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

// ============================================
// CURRENT PRICE CARD
// ============================================

function CurrentPriceCard({ data }: { data: Record<string, unknown> }) {
  const symbol = data.symbol as string || '—'
  const price = parseNumeric(data.price)
  const high = data.high as number | undefined
  const low = data.low as number | undefined
  const change = parseNullableNumeric(data.change)
  const changePct = parseNullableNumeric(data.changePct)
  const isDelayed = data.isDelayed as boolean || false
  const priceAsOf = data.priceAsOf as string | undefined
  const openCard = () => {
    chartAction(symbol, price, '5m', 'Current Price').action()
  }
  const actions: WidgetAction[] = normalizeActions([
    chartAction(symbol, price),
    optionsAction(symbol, price),
    alertAction(symbol, price, 'level_approach', `${symbol} price watch`),
    chatAction(`Build an actionable intraday plan for ${symbol} around ${price.toFixed(2)}.`, 'Build Plan'),
    copyAction(`${symbol} ${price.toFixed(2)} | H ${high ?? '—'} | L ${low ?? '—'}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} price on chart`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol}</span>
          {isDelayed && <span className={cn('text-[9px] px-1.5 py-0.5 rounded border', pillClass('warning'))}>Delayed</span>}
        </div>
        <span className="text-base font-bold font-mono text-white">{formatPrice(price)}</span>
      </div>
      <div className="flex gap-4 text-[10px] text-white/40">
        {high != null && <span>H: <span className="font-mono text-white/60">{formatPrice(high)}</span></span>}
        {low != null && <span>L: <span className="font-mono text-white/60">{formatPrice(low)}</span></span>}
        {change != null && (
          <span className={cn(change >= 0 ? 'text-emerald-300' : 'text-red-300')}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}{changePct != null ? ` (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)` : ''}
          </span>
        )}
        {priceAsOf && <span className="ml-auto">{formatTime(priceAsOf)}</span>}
      </div>
      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

// ============================================
// MACRO CONTEXT CARD
// ============================================

function MacroContextCard({ data }: { data: Record<string, unknown> }) {
  const calendar = (data.economicCalendar as Array<{ event: string; date: string; impact: string; actual?: string; forecast?: string }>) || []
  const fedPolicy = data.fedPolicy as { currentRate?: string; nextMeeting?: string; rateOutlook?: string; tone?: string } | undefined
  const symbolImpact = data.symbolImpact as { symbol?: string; outlook?: string; bullishFactors?: string[]; bearishFactors?: string[] } | undefined
  const highImpactCount = calendar.filter((event) => event.impact === 'High' || event.impact === 'high').length
  const openCard = () => {
    if (symbolImpact?.symbol) {
      chartAction(symbolImpact.symbol, undefined, '5m', 'Macro Context').action()
      return
    }
    viewAction('macro', 'Open Macro').action()
  }
  const actions: WidgetAction[] = normalizeActions([
    symbolImpact?.symbol ? chartAction(symbolImpact.symbol) : viewAction('macro', 'Open Macro'),
    symbolImpact?.symbol ? optionsAction(symbolImpact.symbol) : viewAction('brief', 'Open Brief'),
    chatAction(symbolImpact?.symbol
      ? `Give me a macro-aware plan for ${symbolImpact.symbol} this week.`
      : 'Summarize the top macro risks and catalysts this week.'),
    copyAction(`Macro context | Fed: ${fedPolicy?.currentRate || 'N/A'} | Tone: ${fedPolicy?.tone || 'N/A'} | Events: ${calendar.slice(0, 3).map((event) => event.event).join(', ')}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open macro context"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Globe className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-white">Macro Context</span>
        <span className={cn('ml-auto rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(highImpactCount > 0 ? 'warning' : 'neutral'))}>
          {highImpactCount} high impact
        </span>
        {symbolImpact?.outlook && (
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded border font-medium capitalize',
            symbolImpact.outlook === 'bullish' ? pillClass('success') :
            symbolImpact.outlook === 'bearish' ? pillClass('danger') :
            pillClass('neutral')
          )}>
            {symbolImpact.outlook}
          </span>
        )}
      </div>

      {/* Fed policy */}
      {fedPolicy && (
        <div className="mb-2 pb-2 border-b border-white/5 text-[11px]">
          <div className="flex justify-between text-white/50">
            <span>Fed Rate</span>
            <span className="font-mono text-white/70">{fedPolicy.currentRate || '—'}</span>
          </div>
          {fedPolicy.tone && (
            <div className="flex justify-between text-white/50 mt-0.5">
              <span>Tone</span>
              <span className={cn(
                'capitalize',
                fedPolicy.tone === 'hawkish' ? 'text-red-400' :
                fedPolicy.tone === 'dovish' ? 'text-emerald-400' : 'text-white/60'
              )}>{fedPolicy.tone}</span>
            </div>
          )}
        </div>
      )}

      {/* Economic calendar */}
      {calendar.length > 0 && (
        <div className="space-y-1.5">
          {calendar.slice(0, 3).map((event, i) => (
            <WidgetContextMenu
              key={`${event.event}-${event.date}-${i}`}
              actions={normalizeActions([
                symbolImpact?.symbol ? chartAction(symbolImpact.symbol, undefined, '5m', `${event.event}`) : viewAction('macro', 'Open Macro'),
                chatAction(`How should I position around ${event.event} on ${event.date}?`, 'Ask AI'),
                copyAction(`${event.event} | ${event.date} | ${event.impact}`, 'Copy Event'),
              ])}
            >
              <button type="button" className="w-full flex items-center gap-2 text-[11px] rounded px-1.5 py-1 hover:bg-white/10 cursor-pointer text-left">
                <Calendar className="w-3 h-3 text-white/30 shrink-0" />
                <span className="text-white/60 truncate flex-1">{event.event}</span>
                <span className={cn(
                  'px-1 py-0.5 rounded text-[9px] font-medium shrink-0',
                  event.impact === 'High' || event.impact === 'high' ? 'bg-red-500/10 text-red-400' :
                  event.impact === 'Medium' || event.impact === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-white/5 text-white/40'
                )}>
                  {event.impact}
                </span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

// ============================================
// OPTIONS CHAIN CARD (compact summary)
// ============================================

function OptionsChainCard({ data }: { data: Record<string, unknown> }) {
  const symbol = data.symbol as string || '—'
  const currentPrice = data.currentPrice as number || 0
  const expiry = data.expiry as string || '—'
  const daysToExpiry = data.daysToExpiry as number || 0
  const ivRank = data.ivRank as number | undefined
  const calls = (data.calls as Array<{ strike: number; last: number; delta: string; iv: string; volume: number }>) || []
  const puts = (data.puts as Array<{ strike: number; last: number; delta: string; iv: string; volume: number }>) || []
  const openCard = () => {
    optionsAction(symbol, currentPrice, expiry).action()
  }
  const actions: WidgetAction[] = normalizeActions([
    optionsAction(symbol, currentPrice, expiry),
    chartAction(symbol, currentPrice),
    alertAction(symbol, currentPrice, 'level_approach', `${symbol} ATM options focus`),
    chatAction(`Review the ${symbol} ${expiry} options chain and identify the best strikes to monitor.`),
    copyAction(`${symbol} ${expiry} | Spot ${currentPrice} | IV ${ivRank ?? 'N/A'}`),
  ])

  // Show only ATM strikes (3 each)
  const topCalls = calls.slice(0, 3)
  const topPuts = puts.slice(-3)
  const totalContracts = calls.length + puts.length

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-md cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} options chain`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} Options</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span>{expiry} ({daysToExpiry}d)</span>
          <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass('info'))}>
            {totalContracts} contracts
          </span>
          {ivRank != null && <span className="font-mono">IV: {ivRank}%</span>}
        </div>
      </div>

      {/* ATM options table */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="text-[9px] text-emerald-400/60 font-medium uppercase mb-1">Calls</p>
          {topCalls.map((c, i) => (
            <WidgetContextMenu
              key={i}
              actions={[
                chartAction(symbol, c.strike, '5m', `${symbol} ${c.strike}C`),
                optionsAction(symbol, c.strike, expiry),
                alertAction(symbol, c.strike, 'level_approach', `${symbol} call strike ${c.strike}`),
                copyAction(`${symbol} CALL ${c.strike} ${expiry}`),
              ]}
            >
              <button type="button" className="w-full flex justify-between py-0.5 rounded px-1 hover:bg-white/10 cursor-pointer text-left">
                <span className="font-mono text-white/50">{c.strike}</span>
                <span className="font-mono text-white/70">${c.last}</span>
                <span className="text-white/40">{c.delta}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
        <div>
          <p className="text-[9px] text-red-400/60 font-medium uppercase mb-1">Puts</p>
          {topPuts.map((p, i) => (
            <WidgetContextMenu
              key={i}
              actions={[
                chartAction(symbol, p.strike, '5m', `${symbol} ${p.strike}P`),
                optionsAction(symbol, p.strike, expiry),
                alertAction(symbol, p.strike, 'level_approach', `${symbol} put strike ${p.strike}`),
                copyAction(`${symbol} PUT ${p.strike} ${expiry}`),
              ]}
            >
              <button type="button" className="w-full flex justify-between py-0.5 rounded px-1 hover:bg-white/10 cursor-pointer text-left">
                <span className="font-mono text-white/50">{p.strike}</span>
                <span className="font-mono text-white/70">${p.last}</span>
                <span className="text-white/40">{p.delta}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      </div>

      <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[10px] text-white/40 text-center">
        Price: <span className="font-mono text-white/60">${currentPrice.toLocaleString()}</span>
      </div>
      <WidgetActionBar actions={actions} />
    </div>
  )
}

// ============================================
// GEX PROFILE CARD
// ============================================

function GEXProfileCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'SPX'
  const spotPrice = data.spotPrice as number | undefined
  const regime = (data.regime as string) || 'unknown'
  const flipPoint = data.flipPoint as number | null | undefined
  const maxGEXStrike = data.maxGEXStrike as number | null | undefined
  const implication = (data.implication as string) || ''
  const calculatedAt = data.calculatedAt as string | undefined
  const keyLevels = (data.keyLevels as Array<{ strike: number; gexValue: number; type: string }>) || []
  const gexByStrike = (data.gexByStrike as Array<{ strike: number; gexValue: number }>) || []

  const regimeBadgeClass = regime === 'positive_gamma'
    ? 'bg-emerald-500/10 text-emerald-300'
    : regime === 'negative_gamma'
    ? 'bg-red-500/10 text-red-300'
    : 'bg-white/5 text-white/50'

  const handleShowOnChart = () => {
    if (typeof window === 'undefined') return

    window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
      detail: {
        symbol,
        timeframe: '5m',
        gexProfile: {
          symbol,
          spotPrice,
          flipPoint,
          maxGEXStrike,
          keyLevels,
        },
      },
    }))
  }
  const actions: WidgetAction[] = normalizeActions([
    {
      label: 'Show on Chart',
      icon: Workflow,
      variant: 'primary',
      tooltip: `${symbol} gamma levels overlay`,
      action: handleShowOnChart,
    },
    optionsAction(symbol, maxGEXStrike || undefined),
    chatAction(`Interpret ${symbol} gamma profile with flip ${flipPoint ?? 'n/a'} and max GEX ${maxGEXStrike ?? 'n/a'}.`),
    copyAction(`${symbol} GEX | Spot ${spotPrice ?? 'N/A'} | Flip ${flipPoint ?? 'N/A'} | Max ${maxGEXStrike ?? 'N/A'}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-xl cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, handleShowOnChart)}
      onKeyDown={(event) => handleCardKeyDown(event, handleShowOnChart)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} gamma profile on chart`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-white">{symbol} Gamma Exposure</span>
        </div>
        <span className={cn('rounded border px-2 py-0.5 text-[10px] font-medium', regimeBadgeClass)}>
          {regime === 'positive_gamma' ? 'Positive Gamma' : regime === 'negative_gamma' ? 'Negative Gamma' : 'Unknown'}
        </span>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2 text-[10px] text-white/45">
        <div>
          <p>Spot</p>
          <p className="font-mono text-white/75">{spotPrice != null ? spotPrice.toLocaleString() : '—'}</p>
        </div>
        <div>
          <p>Flip</p>
          <p className="font-mono text-yellow-300">{flipPoint != null ? flipPoint.toLocaleString() : '—'}</p>
        </div>
        <div>
          <p>Max GEX</p>
          <p className="font-mono text-violet-300">{maxGEXStrike != null ? maxGEXStrike.toLocaleString() : '—'}</p>
        </div>
      </div>

      <GEXChart
        data={gexByStrike}
        spotPrice={spotPrice}
        flipPoint={flipPoint}
        maxGEXStrike={maxGEXStrike}
        maxRows={14}
      />

      {keyLevels.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1 text-[10px]">
          {keyLevels.slice(0, 6).map((level) => (
            <WidgetContextMenu
              key={`${level.strike}-${level.type}`}
              actions={[
                chartAction(symbol, level.strike, '5m', `GEX ${level.type}`),
                optionsAction(symbol, level.strike),
                alertAction(symbol, level.strike, 'level_approach', `${symbol} GEX ${level.type}`),
                copyAction(`${symbol} GEX ${level.type} ${level.strike}`),
              ]}
            >
              <button type="button" className="w-full flex items-center justify-between rounded bg-white/5 px-2 py-1 hover:bg-white/10 cursor-pointer text-left">
                <span className={cn(
                  'capitalize',
                  level.type === 'support' ? 'text-emerald-300' :
                  level.type === 'resistance' ? 'text-red-300' :
                  'text-violet-300'
                )}>
                  {level.type}
                </span>
                <span className="font-mono text-white/70">{level.strike.toLocaleString()}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      {implication && (
        <p className="mt-2 text-[10px] leading-relaxed text-white/50">{implication}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <WidgetActionBar actions={actions} className="mt-0" />
        <span className="text-[9px] text-white/35">
          {calculatedAt ? `Updated ${new Date(calculatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </span>
      </div>
    </div>
  )
}

// ============================================
// SPX GAME PLAN CARD
// ============================================

function SPXGamePlanCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'SPX'
  const currentPrice = parseNullableNumeric(data.currentPrice)
  const spyPrice = parseNullableNumeric(data.spyPrice)
  const ratio = parseNullableNumeric(data.spxSpyRatio)
  const expectedMove = parseNullableNumeric(data.expectedMove)
  const spyExpectedMove = parseNullableNumeric(data.spyExpectedMove)
  const flipPoint = parseNullableNumeric(data.flipPoint)
  const maxGEXStrike = parseNullableNumeric(data.maxGEXStrike)
  const setupContext = (data.setupContext as string) || ''
  const gammaRegime = (data.gammaRegime as string) || 'neutral'
  const keyLevels = (data.keyLevels as Record<string, unknown> | undefined) || {}

  const resistance = (keyLevels.resistance as Array<{ name?: string; type?: string; price?: number }> | undefined) || []
  const support = (keyLevels.support as Array<{ name?: string; type?: string; price?: number }> | undefined) || []
  const allResistance = resistance
    .map((level) => ({
      name: level.name || level.type || 'Resistance',
      price: parseNullableNumeric(level.price),
    }))
    .filter((level): level is { name: string; price: number } => level.price != null)
  const allSupport = support
    .map((level) => ({
      name: level.name || level.type || 'Support',
      price: parseNullableNumeric(level.price),
    }))
    .filter((level): level is { name: string; price: number } => level.price != null)
  const topResistance = resistance.slice(0, 2).map((level) => ({
    name: level.name || level.type || 'R',
    price: parseNullableNumeric(level.price) ?? 0,
  }))
  const topSupport = support.slice(0, 2).map((level) => ({
    name: level.name || level.type || 'S',
    price: parseNullableNumeric(level.price) ?? 0,
  }))

  const regimeBadgeClass = gammaRegime === 'positive'
    ? 'bg-emerald-500/10 text-emerald-300'
    : gammaRegime === 'negative'
      ? 'bg-red-500/10 text-red-300'
      : 'bg-white/5 text-white/55'

  const moveUsedPct = currentPrice != null && expectedMove != null && flipPoint != null && expectedMove > 0
    ? Math.min(100, Math.abs(((currentPrice - flipPoint) / expectedMove) * 100))
    : null
  const openCard = () => {
    openKeyLevelsChart({
      symbol,
      resistance: allResistance,
      support: allSupport,
      timeframe: '15m',
    })
  }

  const actions: WidgetAction[] = normalizeActions([
    chartAction(symbol, currentPrice ?? undefined, '5m', 'SPX Game Plan'),
    optionsAction(symbol, maxGEXStrike ?? undefined),
    chatAction('Turn this SPX game plan into an actionable intraday checklist with bull and bear triggers.'),
    copyAction(`SPX Plan | Spot ${currentPrice ?? 'N/A'} | Flip ${flipPoint ?? 'N/A'} | Max GEX ${maxGEXStrike ?? 'N/A'} | Exp Move ${expectedMove ?? 'N/A'}`),
  ])
  const alertLevel = flipPoint ?? currentPrice
  if (alertLevel != null) {
    actions.splice(2, 0, alertAction(symbol, alertLevel, 'level_approach', `${symbol} gamma flip`))
  }

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-xl cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} full game plan on chart`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-white">{symbol} Game Plan</span>
        </div>
        <span className={cn('rounded border px-2 py-0.5 text-[10px] font-medium capitalize', regimeBadgeClass)}>
          {gammaRegime} gamma
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] text-white/45 mb-2">
        <div className="rounded bg-white/5 px-2 py-1.5">
          <p>SPX Spot</p>
          <p className="font-mono text-white/75">{currentPrice != null ? currentPrice.toLocaleString() : '—'}</p>
        </div>
        <div className="rounded bg-white/5 px-2 py-1.5">
          <p>SPY Spot</p>
          <p className="font-mono text-white/75">{spyPrice != null ? spyPrice.toLocaleString() : '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px] text-white/45 mb-2">
        <div>
          <p>Flip</p>
          <p className="font-mono text-yellow-300">{flipPoint != null ? flipPoint.toLocaleString() : '—'}</p>
        </div>
        <div>
          <p>Max GEX</p>
          <p className="font-mono text-violet-300">{maxGEXStrike != null ? maxGEXStrike.toLocaleString() : '—'}</p>
        </div>
        <div>
          <p>Ratio</p>
          <p className="font-mono text-white/75">{ratio != null ? ratio.toFixed(2) : '—'}</p>
        </div>
      </div>

      {(expectedMove != null || spyExpectedMove != null) && (
        <div className="mb-2 rounded border border-white/10 bg-white/5 p-2">
          <div className="flex items-center justify-between text-[10px] text-white/45">
            <span>Expected move</span>
            <span className="font-mono text-white/70">
              {expectedMove != null ? `${expectedMove.toFixed(2)} SPX` : '--'}
              {spyExpectedMove != null ? ` / ${spyExpectedMove.toFixed(2)} SPY` : ''}
            </span>
          </div>
          {moveUsedPct != null && (
            <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400/80 rounded-full" style={{ width: `${moveUsedPct}%` }} />
            </div>
          )}
        </div>
      )}

      {(topResistance.length > 0 || topSupport.length > 0) && (
        <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <p className="text-red-300/80 uppercase text-[9px] mb-1">Resistance</p>
            {topResistance.map((level) => (
              <WidgetContextMenu
                key={`r-${level.name}`}
                actions={normalizeActions([
                  chartAction(symbol, level.price, '15m', `${level.name}`),
                  optionsAction(symbol, level.price),
                  alertAction(symbol, level.price, 'price_above', `${symbol} ${level.name}`),
                  copyAction(`${symbol} ${level.name} ${level.price.toFixed(2)}`),
                ])}
              >
                <button type="button" className="w-full text-left font-mono text-white/70 rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer">
                  {level.name}: {level.price.toFixed(2)}
                </button>
              </WidgetContextMenu>
            ))}
          </div>
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <p className="text-emerald-300/80 uppercase text-[9px] mb-1">Support</p>
            {topSupport.map((level) => (
              <WidgetContextMenu
                key={`s-${level.name}`}
                actions={normalizeActions([
                  chartAction(symbol, level.price, '15m', `${level.name}`),
                  optionsAction(symbol, level.price),
                  alertAction(symbol, level.price, 'price_below', `${symbol} ${level.name}`),
                  copyAction(`${symbol} ${level.name} ${level.price.toFixed(2)}`),
                ])}
              >
                <button type="button" className="w-full text-left font-mono text-white/70 rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer">
                  {level.name}: {level.price.toFixed(2)}
                </button>
              </WidgetContextMenu>
            ))}
          </div>
        </div>
      )}

      {setupContext && (
        <p className="text-[10px] leading-relaxed text-white/55 mb-2">{setupContext}</p>
      )}

      <WidgetActionBar actions={actions} />
    </div>
  )
}

// ============================================
// SCAN RESULTS CARD
// ============================================

function ScanResultsCard({ data }: { data: Record<string, unknown> }) {
  const opportunities = (data.opportunities as Array<{
    symbol: string
    setupType: string
    direction: string
    score: number
    description: string
    currentPrice?: number
    suggestedTrade?: {
      entry?: number
      stopLoss?: number
      target?: number
      strikes?: number[]
      expiry?: string
    }
  }>) || []
  const count = data.count as number || 0
  const bestScore = opportunities.length > 0 ? Math.max(...opportunities.map((opp) => opp.score)) : null
  const openCard = () => {
    if (!opportunities[0]) {
      viewAction('scanner', 'Open Scanner').action()
      return
    }
    openScannerSetupChart(opportunities[0], '15m')
  }
  const actions: WidgetAction[] = normalizeActions(opportunities.length > 0
    ? [
        scannerChartAction(opportunities[0], '15m'),
        optionsAction(opportunities[0].symbol, opportunities[0].currentPrice),
        viewAction('tracked', 'Open Tracked', opportunities[0].symbol),
        chatAction(`Review top scanner opportunities and rank by conviction with risk plan.`),
        copyAction(`Top setup: ${opportunities[0].symbol} ${opportunities[0].setupType} (${opportunities[0].direction}) score ${opportunities[0].score}`),
      ]
    : [viewAction('scanner', 'Open Scanner'), chatAction('Run another opportunity scan and summarize strongest setups.')])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open top scanner setup on chart"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">Scan Results</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40">{count} found</span>
          {bestScore != null && (
            <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(bestScore >= 80 ? 'success' : 'neutral'))}>
              Top {Math.round(bestScore)}
            </span>
          )}
        </div>
      </div>

      {opportunities.length === 0 ? (
        <p className="text-xs text-white/30">No opportunities at this time</p>
      ) : (
        <div className="space-y-2">
          {opportunities.slice(0, 3).map((opp, i) => (
            <WidgetContextMenu
              key={i}
              actions={[
                scannerChartAction(opp, '15m'),
                optionsAction(opp.symbol, opp.currentPrice),
                opp.currentPrice != null ? alertAction(opp.symbol, opp.currentPrice, 'level_approach', `${opp.symbol} scanner setup`) : chatAction(`Build alert plan for ${opp.symbol}`, 'Alert Plan'),
                analyzeAction({
                  symbol: opp.symbol,
                  type: opp.direction === 'bearish' ? 'put' : 'call',
                  strike: opp.currentPrice,
                  quantity: 1,
                  entryPrice: 1,
                  entryDate: new Date().toISOString().slice(0, 10),
                }),
                chatAction(`Analyze ${opp.symbol} ${opp.setupType} (${opp.direction}) setup and suggest execution details.`),
              ]}
            >
              <button
                type="button"
                onClick={() => openScannerSetupChart(opp, '15m')}
                className="w-full flex items-start gap-2 text-[11px] rounded px-1.5 py-1 hover:bg-white/10 cursor-pointer text-left"
                aria-label={`Open ${opp.symbol} ${opp.setupType} setup on chart`}
              >
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full mt-1.5 shrink-0',
                  opp.direction === 'bullish' ? 'bg-emerald-400' :
                  opp.direction === 'bearish' ? 'bg-red-400' : 'bg-white/40'
                )} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-white">{opp.symbol}</span>
                    <span className="text-white/40 capitalize">{opp.setupType}</span>
                    <span className="ml-auto text-[9px] font-mono text-emerald-400/70">{opp.score}/100</span>
                  </div>
                  <p className="text-white/40 truncate">{opp.description}</p>
                </div>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

function ZeroDTEAnalysisCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'SPX'
  const expectedMove = (data.expectedMove as Record<string, unknown> | null) || null
  const topContracts = Array.isArray(data.topContracts)
    ? data.topContracts as Array<Record<string, unknown>>
    : []

  const currentPrice = parseNullableNumeric(expectedMove?.currentPrice) ?? 0
  const totalExpectedMove = parseNullableNumeric(expectedMove?.totalExpectedMove)
  const usedPct = parseNullableNumeric(expectedMove?.usedPct)
  const remainingMove = parseNullableNumeric(expectedMove?.remainingMove)
  const minutesLeft = parseNullableNumeric(expectedMove?.minutesLeft)
  const hasZeroDTE = Boolean(data.hasZeroDTE)
  const usedRiskTone = usedPct != null && usedPct >= 80 ? 'danger' : usedPct != null && usedPct >= 60 ? 'warning' : 'success'
  const openCard = () => {
    chartAction(symbol, currentPrice, '5m', '0DTE Context').action()
  }

  const actions: WidgetAction[] = normalizeActions([
    chartAction(symbol, currentPrice, '5m', '0DTE Context'),
    optionsAction(symbol, currentPrice),
    chatAction(`Summarize ${symbol} 0DTE risk using expected move, remaining move, and gamma profile.`),
    copyAction(`${symbol} 0DTE | Expected ${totalExpectedMove ?? 'N/A'} | Used ${usedPct ?? 'N/A'}% | Remaining ${remainingMove ?? 'N/A'}`),
  ])

  return (
    <div
      className={premiumCardClass('border-emerald-500/15 max-w-sm cursor-pointer hover:border-emerald-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} 0DTE context on chart`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Workflow className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-white">{symbol} 0DTE</span>
        </div>
        <div className="flex items-center gap-1.5">
          {usedPct != null && (
            <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(usedRiskTone))}>
              {usedPct.toFixed(0)}% used
            </span>
          )}
          {minutesLeft != null && (
            <span className="text-[10px] text-white/50">{Math.max(0, Math.round(minutesLeft))}m left</span>
          )}
        </div>
      </div>

      {!hasZeroDTE && (
        <p className="text-[11px] text-amber-300/80">{String(data.message || 'No 0DTE expiration detected today.')}</p>
      )}

      {hasZeroDTE && (
        <div className="space-y-2 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
              <p className="text-white/45">Expected Move</p>
              <p className="font-mono text-white">{totalExpectedMove != null ? `${totalExpectedMove.toFixed(2)} pts` : '—'}</p>
            </div>
            <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
              <p className="text-white/45">Move Used</p>
              <p className="font-mono text-white">{usedPct != null ? `${usedPct.toFixed(1)}%` : '—'}</p>
            </div>
          </div>
          <p className="text-white/55">
            Remaining move:
            <span className="ml-1 font-mono text-emerald-300">
              {remainingMove != null ? `${remainingMove.toFixed(2)} pts` : '—'}
            </span>
          </p>

          {topContracts.length > 0 && (
            <div className="pt-1 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1">Most Active</p>
              <div className="space-y-1">
                {topContracts.slice(0, 3).map((contract, idx) => (
                  <WidgetContextMenu
                    key={`${contract.type as string}-${contract.strike as number}-${idx}`}
                    actions={normalizeActions([
                      chartAction(symbol, parseNumeric(contract.strike), '5m', `0DTE ${(contract.type as string || '').toUpperCase()} ${parseNumeric(contract.strike).toFixed(0)}`),
                      optionsAction(symbol, parseNumeric(contract.strike)),
                      alertAction(symbol, parseNumeric(contract.strike), 'level_approach', `${symbol} ${(contract.type as string || '').toUpperCase()} ${parseNumeric(contract.strike).toFixed(0)}`),
                      copyAction(`${symbol} ${(contract.type as string || '').toUpperCase()} ${parseNumeric(contract.strike).toFixed(0)} vol ${Math.round(parseNumeric(contract.volume))}`),
                    ])}
                  >
                    <button type="button" className="w-full flex items-center justify-between rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer text-left text-[10px]">
                      <span className="text-white/70">
                        {(contract.type as string || '').toUpperCase()} {parseNumeric(contract.strike).toFixed(0)}
                      </span>
                      <span className="font-mono text-white/60">Vol {Math.round(parseNumeric(contract.volume))}</span>
                    </button>
                  </WidgetContextMenu>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

function IVAnalysisCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'SPX'
  const currentPrice = parseNullableNumeric(data.currentPrice) ?? 0
  const ivRank = (data.ivRank as Record<string, unknown> | null) || null
  const skew = (data.skew as Record<string, unknown> | null) || null
  const termStructure = (data.termStructure as Record<string, unknown> | null) || null
  const expirations = Array.isArray(termStructure?.expirations)
    ? termStructure?.expirations as Array<Record<string, unknown>>
    : []
  const ivRankValue = parseNullableNumeric(ivRank?.ivRank)
  const ivTone: 'success' | 'warning' | 'danger' | 'neutral' =
    ivRankValue == null ? 'neutral' : ivRankValue >= 70 ? 'danger' : ivRankValue >= 40 ? 'warning' : 'success'
  const openCard = () => {
    optionsAction(symbol, currentPrice).action()
  }

  const actions: WidgetAction[] = normalizeActions([
    optionsAction(symbol, currentPrice),
    chartAction(symbol, currentPrice, '5m', 'IV Regime'),
    chatAction(`Interpret ${symbol} IV rank, skew, and term structure for day-trade risk today.`),
    copyAction(`${symbol} IV | Current ${parseNullableNumeric(ivRank?.currentIV) != null ? `${parseNumeric(ivRank?.currentIV).toFixed(1)}%` : 'N/A'} | IV Rank ${parseNullableNumeric(ivRank?.ivRank) != null ? `${parseNumeric(ivRank?.ivRank).toFixed(1)}%` : 'N/A'} | Skew ${String(skew?.skewDirection || 'unknown')}`),
  ])

  return (
    <div
      className={premiumCardClass('border-sky-500/15 max-w-sm cursor-pointer hover:border-sky-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} volatility context`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-medium text-white">{symbol} IV Profile</span>
        </div>
        <div className="flex items-center gap-1.5">
          {ivRankValue != null && (
            <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass(ivTone))}>
              IVR {ivRankValue.toFixed(0)}
            </span>
          )}
          <span className="text-[10px] text-white/45">{String(data.asOf || '').slice(11, 16)} ET</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">Current IV</p>
          <p className="font-mono text-white">
            {parseNullableNumeric(ivRank?.currentIV) != null ? `${parseNumeric(ivRank?.currentIV).toFixed(1)}%` : '—'}
          </p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">IV Rank</p>
          <p className="font-mono text-white">
            {parseNullableNumeric(ivRank?.ivRank) != null ? `${parseNumeric(ivRank?.ivRank).toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-white/65 space-y-1">
        <p>
          Skew:
          <span className="ml-1 font-mono text-white/80">{String(skew?.skewDirection || 'unknown')}</span>
        </p>
        <p>
          Term Structure:
          <span className="ml-1 font-mono text-white/80">{String(termStructure?.shape || 'unknown')}</span>
        </p>
      </div>

      {expirations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10 space-y-1 text-[10px]">
          {expirations.slice(0, 3).map((row) => (
            <WidgetContextMenu
              key={String(row.date)}
              actions={normalizeActions([
                optionsAction(symbol, currentPrice, String(row.date), 'View Expiry'),
                chatAction(`Compare ${symbol} volatility term structure for ${String(row.date)} versus front week.`, 'Ask AI'),
                copyAction(`${symbol} ${String(row.date)} ATM IV ${parseNumeric(row.atmIV).toFixed(1)}%`, 'Copy Row'),
              ])}
            >
              <button type="button" className="w-full flex items-center justify-between rounded px-1 py-0.5 text-white/60 hover:bg-white/10 cursor-pointer text-left">
                <span>{String(row.date)}</span>
                <span className="font-mono">{parseNumeric(row.atmIV).toFixed(1)}%</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={actions} compact />
    </div>
  )
}

function EarningsCalendarCard({ data }: { data: Record<string, unknown> }) {
  const events = Array.isArray(data.events) ? data.events as Array<Record<string, unknown>> : []
  const watchlist = Array.isArray(data.watchlist) ? data.watchlist as string[] : []
  const daysAhead = parseNumeric(data.daysAhead)
  const openCard = () => {
    viewAction('earnings', 'Open Earnings').action()
  }
  const cardActions: WidgetAction[] = normalizeActions([
    viewAction('earnings', 'Open Earnings'),
    chatAction('Summarize this earnings calendar and highlight the highest-risk names for options day traders.'),
    copyAction(`Earnings watchlist: ${watchlist.join(', ')}`),
  ])

  return (
    <div
      className={premiumCardClass('border-fuchsia-500/15 max-w-sm cursor-pointer hover:border-fuchsia-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open earnings calendar"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-fuchsia-400" />
          <span className="text-xs font-medium text-white">Earnings Calendar</span>
        </div>
        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass('info'))}>{Math.round(daysAhead)}d window</span>
      </div>

      {events.length === 0 && (
        <p className="text-[11px] text-white/55">No earnings events found for the selected watchlist window.</p>
      )}

      {events.length > 0 && (
        <div className="space-y-1 text-[11px]">
          {events.slice(0, 5).map((event, idx) => (
            <WidgetContextMenu
              key={`${String(event.symbol)}-${String(event.date)}-${idx}`}
              actions={normalizeActions([
                chartAction(String(event.symbol), undefined, '5m', 'Earnings Chart'),
                optionsAction(String(event.symbol), undefined, String(event.date)),
                chatAction(`Build an earnings plan for ${String(event.symbol)} into ${String(event.date)}.`, 'Build Plan'),
                copyAction(`${String(event.symbol)} earnings ${String(event.date)} ${String(event.time || event.timing || '')}`, 'Copy Event'),
              ])}
            >
              <button type="button" className="w-full flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1 hover:bg-white/10 cursor-pointer text-left">
                <span className="font-medium text-white/85">{String(event.symbol)}</span>
                <span className="text-white/50">{String(event.date)}</span>
                <span className="text-white/65">{String(event.time || event.timing || '')}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={cardActions} compact />
    </div>
  )
}

function EarningsAnalysisCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'TICKER'
  const expectedMove = (data.expectedMove as Record<string, unknown> | null) || null
  const strategies = Array.isArray(data.suggestedStrategies)
    ? data.suggestedStrategies as Array<Record<string, unknown>>
    : []
  const points = parseNullableNumeric(expectedMove?.points)
  const pct = parseNullableNumeric(expectedMove?.pct)
  const currentPrice = parseNullableNumeric((data as Record<string, unknown>).currentPrice) ?? 0
  const ivCrushRisk = String((data as Record<string, unknown>).ivCrushRisk || '').toLowerCase()
  const openCard = () => {
    optionsAction(symbol, currentPrice).action()
  }
  const cardActions: WidgetAction[] = normalizeActions([
    optionsAction(symbol, currentPrice),
    chartAction(symbol, currentPrice, '5m', 'Earnings Setup'),
    currentPrice > 0 ? alertAction(symbol, currentPrice, 'level_approach', `${symbol} earnings watch`) : viewAction('earnings', 'Open Earnings', symbol),
    chatAction(`Rank the pre-earnings strategies for ${symbol} by risk/reward and IV crush risk.`),
    copyAction(`${symbol} earnings expected move ${points ?? 'N/A'} (${pct ?? 'N/A'}%)`),
  ])

  return (
    <div
      className={premiumCardClass('border-amber-500/15 max-w-sm cursor-pointer hover:border-amber-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} earnings options context`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-white">{symbol} Earnings Setup</span>
        </div>
        <div className="flex items-center gap-1.5">
          {ivCrushRisk && (
            <span className={cn(
              'rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase',
              ivCrushRisk.includes('high') ? pillClass('danger') : ivCrushRisk.includes('medium') ? pillClass('warning') : pillClass('success'),
            )}>
              {ivCrushRisk} crush
            </span>
          )}
          <span className="text-[10px] text-white/45">{String(data.earningsDate || 'TBD')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">Expected Move</p>
          <p className="font-mono text-white">{points != null ? `${points.toFixed(2)} pts` : '—'}</p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">Expected Move %</p>
          <p className="font-mono text-white">{pct != null ? `${pct.toFixed(2)}%` : '—'}</p>
        </div>
      </div>

      {strategies.length > 0 && (
        <div className="mt-2 space-y-1 text-[10px]">
          <p className="uppercase tracking-wide text-white/45">Top Strategies</p>
          {strategies.slice(0, 2).map((strategy, idx) => (
            <WidgetContextMenu
              key={`${String(strategy.name)}-${idx}`}
              actions={normalizeActions([
                analyzeAction({
                  symbol,
                  type: 'call',
                  strike: currentPrice || undefined,
                  quantity: 1,
                  entryPrice: 1,
                  entryDate: new Date().toISOString().slice(0, 10),
                }, 'Simulate'),
                chatAction(`Evaluate the ${String(strategy.name || 'strategy')} plan for ${symbol} including IV crush risk.`, 'Ask AI'),
                copyAction(`${symbol} earnings strategy: ${String(strategy.name || 'Strategy')} - ${String(strategy.description || '')}`, 'Copy Strategy'),
              ])}
            >
              <button type="button" className="w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 hover:bg-white/10 cursor-pointer text-left">
                <p className="text-white/80 font-medium">{String(strategy.name || 'Strategy')}</p>
                <p className="text-white/55 line-clamp-2">{String(strategy.description || '')}</p>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={cardActions} compact />
    </div>
  )
}

function JournalInsightsCard({ data }: { data: Record<string, unknown> }) {
  const tradeCount = parseNumeric(data.tradeCount)
  const summary = String(data.summary || 'No journal summary available.')
  const period = String(data.period || '30d')
  const openCard = () => {
    viewAction('journal', 'Open Journal').action()
  }
  const cardActions: WidgetAction[] = normalizeActions([
    viewAction('journal', 'Open Journal'),
    chatAction('Turn these journal insights into three concrete rules for tomorrow.'),
    chatAction(`Create a weekly execution checklist from this ${period} journal summary.`, 'Build Checklist'),
    copyAction(summary, 'Copy Summary'),
  ])

  return (
    <div
      className={premiumCardClass('border-teal-500/15 max-w-sm cursor-pointer hover:border-teal-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label="Open journal insights"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-xs font-medium text-white">Journal Insights</span>
        </div>
        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass('info'))}>{period}</span>
      </div>

      <p className="text-[11px] text-white/60 mb-2">Trades analyzed: <span className="font-mono text-white/85">{tradeCount}</span></p>
      <p className="text-[11px] leading-relaxed text-white/70 line-clamp-4">{summary}</p>

      <WidgetActionBar actions={cardActions} compact />
    </div>
  )
}

function TradeHistoryCard({ data }: { data: Record<string, unknown> }) {
  const symbol = (data.symbol as string) || 'All Symbols'
  const summary = (data.summary as Record<string, unknown> | null) || null
  const trades = Array.isArray(data.trades) ? data.trades as Array<Record<string, unknown>> : []
  const openCard = () => {
    if (symbol !== 'All Symbols') {
      chartAction(symbol, undefined, '5m', 'Trade Context').action()
      return
    }
    viewAction('journal', 'Open Journal').action()
  }
  const cardActions: WidgetAction[] = normalizeActions([
    viewAction('journal', 'Open Journal', symbol !== 'All Symbols' ? symbol : undefined),
    symbol !== 'All Symbols' ? chartAction(symbol) : viewAction('tracked', 'Open Tracked'),
    chatAction(`Use this ${symbol} trade history to identify the top two recurring mistakes and fixes.`),
    copyAction(`Win rate: ${String(summary?.winRate || 'N/A')} | Total PnL: ${String(summary?.totalPnl || 'N/A')}`),
  ])

  return (
    <div
      className={premiumCardClass('border-violet-500/15 max-w-sm cursor-pointer hover:border-violet-500/30 transition-colors')}
      onClick={(event) => handleCardClick(event, openCard)}
      onKeyDown={(event) => handleCardKeyDown(event, openCard)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${symbol} trade history context`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-white">{symbol} Trade History</span>
        </div>
        <span className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', pillClass('neutral'))}>
          {String(summary?.totalTrades ?? trades.length)} trades
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">Win Rate</p>
          <p className="font-mono text-white">{String(summary?.winRate || 'N/A')}</p>
        </div>
        <div className="rounded border border-white/10 bg-black/20 px-2 py-1.5">
          <p className="text-white/45">Total PnL</p>
          <p className="font-mono text-white">{String(summary?.totalPnl || 'N/A')}</p>
        </div>
      </div>

      {trades.length > 0 && (
        <div className="space-y-1 text-[10px] text-white/60">
          {trades.slice(0, 3).map((trade, idx) => (
            <WidgetContextMenu
              key={`${String(trade.tradeDate)}-${idx}`}
              actions={normalizeActions([
                symbol !== 'All Symbols' ? chartAction(symbol, undefined, '5m', 'Trade Context') : viewAction('journal', 'Open Journal'),
                chatAction(`Review trade on ${String(trade.tradeDate)} (${String(trade.outcome || '')}) and show one improvement.`, 'Ask AI'),
                copyAction(`${symbol} ${String(trade.tradeDate)} ${String(trade.outcome || '')} ${String(trade.pnl || '—')}`, 'Copy Trade'),
              ])}
            >
              <button type="button" className="w-full flex items-center justify-between rounded border border-white/10 bg-black/20 px-2 py-1 hover:bg-white/10 cursor-pointer text-left">
                <span>{String(trade.tradeDate)}</span>
                <span>{String(trade.outcome || '')}</span>
                <span className="font-mono">{String(trade.pnl || '—')}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      )}

      <WidgetActionBar actions={cardActions} compact />
    </div>
  )
}

// ============================================
// UTILITY: Parse widget data from function calls
// ============================================

export function extractWidgets(functionCalls?: Array<{
  function: string
  arguments: Record<string, unknown>
  result: unknown
}>): WidgetData[] {
  if (!functionCalls) return []

  const widgets: WidgetData[] = []

  for (const fc of functionCalls) {
    const result = fc.result as Record<string, unknown> | undefined
    if (!result) continue

    switch (fc.function) {
      case 'get_key_levels': {
        if (result.error) break
        const levels = (result.levels as Record<string, unknown>) || {}
        const resistanceRaw = (levels.resistance as Array<Record<string, unknown>>) || []
        const supportRaw = (levels.support as Array<Record<string, unknown>>) || []
        widgets.push({
          type: 'key_levels',
          data: {
            symbol: result.symbol,
            currentPrice: result.currentPrice,
            resistance: resistanceRaw.map((level) => ({
              ...level,
              name: String(level.name || level.type || 'Resistance'),
            })),
            support: supportRaw.map((level) => ({
              ...level,
              name: String(level.name || level.type || 'Support'),
            })),
            vwap: (levels.indicators as Record<string, unknown>)?.vwap,
            atr14: (levels.indicators as Record<string, unknown>)?.atr14,
          },
        })
        break
      }
      case 'get_market_status': {
        widgets.push({
          type: 'market_overview',
          data: result,
        })
        break
      }
      case 'analyze_position': {
        if (result.error) break
        if (result.portfolio) {
          widgets.push({
            type: 'pnl_tracker',
            data: result.portfolio as Record<string, unknown>,
          })
        } else if (result.position) {
          widgets.push({
            type: 'position_summary',
            data: {
              ...result.position as Record<string, unknown>,
              pnl: result.pnl,
              pnlPct: result.pnlPct,
              currentValue: result.currentValue,
              greeks: result.greeks,
            },
          })
        }
        break
      }
      case 'get_current_price': {
        if (result.error) break
        widgets.push({ type: 'current_price', data: result })
        break
      }
      case 'get_macro_context': {
        if (result.error) break
        widgets.push({ type: 'macro_context', data: result })
        break
      }
      case 'get_options_chain': {
        if (result.error) break
        widgets.push({ type: 'options_chain', data: result })
        break
      }
      case 'get_gamma_exposure': {
        if (result.error) break
        widgets.push({ type: 'gex_profile', data: result })
        break
      }
      case 'get_spx_game_plan': {
        if (result.error) break
        widgets.push({ type: 'spx_game_plan', data: result })
        break
      }
      case 'scan_opportunities': {
        if (result.error) break
        widgets.push({ type: 'scan_results', data: result })
        break
      }
      case 'get_zero_dte_analysis': {
        if (result.error) break
        widgets.push({ type: 'zero_dte_analysis', data: result })
        break
      }
      case 'get_iv_analysis': {
        if (result.error) break
        widgets.push({ type: 'iv_analysis', data: result })
        break
      }
      case 'get_earnings_calendar': {
        if (result.error) break
        widgets.push({ type: 'earnings_calendar', data: result })
        break
      }
      case 'get_earnings_analysis': {
        if (result.error) break
        widgets.push({ type: 'earnings_analysis', data: result })
        break
      }
      case 'get_journal_insights': {
        if (result.error) break
        widgets.push({ type: 'journal_insights', data: result })
        break
      }
      case 'get_trade_history_for_symbol':
      case 'get_trade_history': {
        if (result.error) break
        widgets.push({ type: 'trade_history', data: result })
        break
      }
    }
  }

  return widgets
}
