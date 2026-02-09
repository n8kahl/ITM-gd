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
} from './widget-actions'
import type { PositionType } from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

export type WidgetType = 'key_levels' | 'position_summary' | 'pnl_tracker' | 'alert_status' | 'market_overview' | 'macro_context' | 'options_chain' | 'gex_profile' | 'scan_results' | 'current_price'

export interface WidgetData {
  type: WidgetType
  data: Record<string, unknown>
}

function normalizePositionType(value: string | undefined): PositionType {
  const normalized = value?.toLowerCase()
  if (
    normalized === 'call'
    || normalized === 'put'
    || normalized === 'call_spread'
    || normalized === 'put_spread'
    || normalized === 'iron_condor'
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

// ============================================
// WIDGET CARD WRAPPER
// ============================================

export function WidgetCard({ widget }: { widget: WidgetData }) {
  switch (widget.type) {
    case 'key_levels':
      return <KeyLevelsCard data={widget.data} />
    case 'position_summary':
      return <PositionSummaryCard data={widget.data} />
    case 'pnl_tracker':
      return <PnLTrackerCard data={widget.data} />
    case 'market_overview':
      return <MarketOverviewCard data={widget.data} />
    case 'alert_status':
      return <AlertStatusCard data={widget.data} />
    case 'macro_context':
      return <MacroContextCard data={widget.data} />
    case 'options_chain':
      return <OptionsChainCard data={widget.data} />
    case 'gex_profile':
      return <GEXProfileCard data={widget.data} />
    case 'scan_results':
      return <ScanResultsCard data={widget.data} />
    case 'current_price':
      return <CurrentPriceCard data={widget.data} />
    default:
      return null
  }
}

// ============================================
// KEY LEVELS CARD
// ============================================

function KeyLevelsCard({ data }: { data: Record<string, unknown> }) {
  const symbol = data.symbol as string || 'SPX'
  const currentPrice = data.currentPrice as number || 0
  const resistance = (data.resistance as Array<{ name: string; price: number; distance?: string }>) || []
  const support = (data.support as Array<{ name: string; price: number; distance?: string }>) || []
  const vwap = data.vwap as number | undefined
  const atr = data.atr14 as number | undefined
  const cardActions: WidgetAction[] = [
    chartAction(symbol, currentPrice, '1D', 'Current Price'),
    optionsAction(symbol, currentPrice),
    chatAction(`Summarize ${symbol} key levels and likely scenarios around ${currentPrice.toFixed(2)}.`),
  ]

  const levelActions = (level: { name: string; price: number }, side: 'support' | 'resistance'): WidgetAction[] => ([
    chartAction(symbol, level.price, '1D', level.name),
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
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} Key Levels</span>
        </div>
        <span className="text-xs font-mono text-white/80">${currentPrice.toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Resistance */}
        <div className="space-y-1">
          <p className="text-[10px] text-red-400/60 font-medium uppercase">Resistance</p>
          {resistance.slice(0, 3).map((level) => (
            <WidgetContextMenu key={level.name} actions={levelActions(level, 'resistance')}>
              <button
                type="button"
                onClick={() => chartAction(symbol, level.price, '1D', level.name).action()}
                className="w-full flex justify-between rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer text-left"
              >
                <span className="text-red-400">{level.name}</span>
                <span className="font-mono text-white/60">${level.price.toLocaleString()}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>

        {/* Support */}
        <div className="space-y-1">
          <p className="text-[10px] text-emerald-400/60 font-medium uppercase">Support</p>
          {support.slice(0, 3).map((level) => (
            <WidgetContextMenu key={level.name} actions={levelActions(level, 'support')}>
              <button
                type="button"
                onClick={() => chartAction(symbol, level.price, '1D', level.name).action()}
                className="w-full flex justify-between rounded px-1 py-0.5 hover:bg-white/10 cursor-pointer text-left"
              >
                <span className="text-emerald-400">{level.name}</span>
                <span className="font-mono text-white/60">${level.price.toLocaleString()}</span>
              </button>
            </WidgetContextMenu>
          ))}
        </div>
      </div>

      {/* Indicators row */}
      {(vwap || atr) && (
        <div className="mt-2 pt-2 border-t border-white/5 flex gap-3 text-[10px] text-white/40">
          {vwap && <span>VWAP: <span className="text-yellow-400 font-mono">${vwap.toLocaleString()}</span></span>}
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
  const entryPrice = parseNumeric(data.entryPrice) || undefined
  const actions: WidgetAction[] = [
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
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} {type.toUpperCase()}</span>
          {strike && <span className="text-[10px] text-white/40">${strike}</span>}
        </div>
        {expiry && <span className="text-[10px] text-white/40">{expiry}</span>}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[10px] text-white/40">P&L</p>
          <p className={cn('text-sm font-bold', pnlPositive ? 'text-emerald-400' : 'text-red-400')}>
            {pnlPositive ? '+' : ''}${pnl.toFixed(2)}
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
        Value: <span className="text-white/60 font-mono">${currentValue.toFixed(2)}</span>
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
  const actions: WidgetAction[] = [
    chatAction('Summarize my portfolio risk and what to manage first.'),
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-white">Portfolio P&L</span>
        <span className="text-[10px] text-white/30 ml-auto">{positionCount} positions</span>
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
  const actions: WidgetAction[] = [
    chartAction('SPX'),
    chatAction('Given current market status, what trading approach should I prioritize?'),
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">Market Status</span>
        </div>
        <span className={cn(
          'px-2 py-0.5 rounded text-[10px] font-medium capitalize',
          statusColors[status] || statusColors.closed
        )}>
          {status}
        </span>
      </div>
      <p className="text-xs text-white/60">{message}</p>
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
  const actions: WidgetAction[] = alerts.length > 0
    ? [
        chartAction(alerts[0].symbol, alerts[0].target),
        alertAction(alerts[0].symbol, alerts[0].target, 'level_approach', `Alert from widget (${alerts[0].type})`),
      ]
    : [chatAction('Show my active alerts and suggest which ones to keep.')]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
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
                chartAction(alert.symbol, alert.target, '1D', `${alert.type}`),
                optionsAction(alert.symbol, alert.target),
                alertAction(alert.symbol, alert.target, 'level_approach', `Alert: ${alert.type}`),
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
  const price = data.price as number || 0
  const high = data.high as number | undefined
  const low = data.low as number | undefined
  const isDelayed = data.isDelayed as boolean || false
  const priceAsOf = data.priceAsOf as string | undefined
  const actions: WidgetAction[] = [
    chartAction(symbol, price),
    optionsAction(symbol, price),
    alertAction(symbol, price, 'level_approach', `${symbol} price watch`),
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol}</span>
          {isDelayed && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Delayed</span>}
        </div>
        <span className="text-base font-bold font-mono text-white">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="flex gap-4 text-[10px] text-white/40">
        {high != null && <span>H: <span className="font-mono text-white/60">${high.toLocaleString()}</span></span>}
        {low != null && <span>L: <span className="font-mono text-white/60">${low.toLocaleString()}</span></span>}
        {priceAsOf && <span className="ml-auto">{priceAsOf}</span>}
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
  const actions: WidgetAction[] = [
    chatAction(symbolImpact?.symbol
      ? `Give me a macro-aware plan for ${symbolImpact.symbol} this week.`
      : 'Summarize the top macro risks and catalysts this week.'),
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center gap-1.5 mb-3">
        <Globe className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-medium text-white">Macro Context</span>
        {symbolImpact?.outlook && (
          <span className={cn(
            'ml-auto text-[9px] px-1.5 py-0.5 rounded font-medium capitalize',
            symbolImpact.outlook === 'bullish' ? 'bg-emerald-500/10 text-emerald-400' :
            symbolImpact.outlook === 'bearish' ? 'bg-red-500/10 text-red-400' :
            'bg-white/5 text-white/40'
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
            <div key={i} className="flex items-center gap-2 text-[11px]">
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
            </div>
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
  const actions: WidgetAction[] = [
    optionsAction(symbol, currentPrice, expiry),
    chartAction(symbol, currentPrice),
    chatAction(`Review the ${symbol} ${expiry} options chain and identify the best strikes to monitor.`),
  ]

  // Show only ATM strikes (3 each)
  const topCalls = calls.slice(0, 3)
  const topPuts = puts.slice(-3)

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">{symbol} Options</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span>{expiry} ({daysToExpiry}d)</span>
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
                chartAction(symbol, c.strike, '1D', `${symbol} ${c.strike}C`),
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
                chartAction(symbol, p.strike, '1D', `${symbol} ${p.strike}P`),
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
        timeframe: '1D',
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
  const actions: WidgetAction[] = [
    {
      label: 'Show on Chart',
      icon: Workflow,
      variant: 'primary',
      action: handleShowOnChart,
    },
    optionsAction(symbol, maxGEXStrike || undefined),
    chatAction(`Interpret ${symbol} gamma profile with flip ${flipPoint ?? 'n/a'} and max GEX ${maxGEXStrike ?? 'n/a'}.`),
  ]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-white">{symbol} Gamma Exposure</span>
        </div>
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', regimeBadgeClass)}>
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
                chartAction(symbol, level.strike, '1D', `GEX ${level.type}`),
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
// SCAN RESULTS CARD
// ============================================

function ScanResultsCard({ data }: { data: Record<string, unknown> }) {
  const opportunities = (data.opportunities as Array<{
    symbol: string; setupType: string; direction: string; score: number; description: string; currentPrice?: number
  }>) || []
  const count = data.count as number || 0
  const actions: WidgetAction[] = opportunities.length > 0
    ? [
        chartAction(opportunities[0].symbol, opportunities[0].currentPrice),
        optionsAction(opportunities[0].symbol, opportunities[0].currentPrice),
        chatAction(`Review top scanner opportunities and rank by conviction with risk plan.`),
      ]
    : [chatAction('Run another opportunity scan and summarize strongest setups.')]

  return (
    <div className="glass-card-heavy rounded-xl p-3 border-emerald-500/10 mt-2 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-white">Scan Results</span>
        </div>
        <span className="text-[10px] text-white/40">{count} found</span>
      </div>

      {opportunities.length === 0 ? (
        <p className="text-xs text-white/30">No opportunities at this time</p>
      ) : (
        <div className="space-y-2">
          {opportunities.slice(0, 3).map((opp, i) => (
            <WidgetContextMenu
              key={i}
              actions={[
                chartAction(opp.symbol, opp.currentPrice, '15m', `${opp.setupType}`),
                optionsAction(opp.symbol, opp.currentPrice),
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
              <button type="button" className="w-full flex items-start gap-2 text-[11px] rounded px-1.5 py-1 hover:bg-white/10 cursor-pointer text-left">
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
        widgets.push({
          type: 'key_levels',
          data: {
            symbol: result.symbol,
            currentPrice: result.currentPrice,
            resistance: (result.levels as Record<string, unknown>)?.resistance,
            support: (result.levels as Record<string, unknown>)?.support,
            vwap: ((result.levels as Record<string, unknown>)?.indicators as Record<string, unknown>)?.vwap,
            atr14: ((result.levels as Record<string, unknown>)?.indicators as Record<string, unknown>)?.atr14,
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
      case 'scan_opportunities': {
        if (result.error) break
        widgets.push({ type: 'scan_results', data: result })
        break
      }
    }
  }

  return widgets
}
