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
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TYPES
// ============================================

export type WidgetType = 'key_levels' | 'position_summary' | 'pnl_tracker' | 'alert_status' | 'market_overview'

export interface WidgetData {
  type: WidgetType
  data: Record<string, unknown>
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
            <div key={level.name} className="flex justify-between">
              <span className="text-red-400">{level.name}</span>
              <span className="font-mono text-white/60">${level.price.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Support */}
        <div className="space-y-1">
          <p className="text-[10px] text-emerald-400/60 font-medium uppercase">Support</p>
          {support.slice(0, 3).map((level) => (
            <div key={level.name} className="flex justify-between">
              <span className="text-emerald-400">{level.name}</span>
              <span className="font-mono text-white/60">${level.price.toLocaleString()}</span>
            </div>
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
  const pnl = data.pnl as number || 0
  const pnlPct = data.pnlPct as number || 0
  const currentValue = data.currentValue as number || 0
  const greeks = data.greeks as { delta?: number; theta?: number; gamma?: number; vega?: number } | undefined
  const pnlPositive = pnl >= 0

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
    </div>
  )
}

// ============================================
// P&L TRACKER CARD
// ============================================

function PnLTrackerCard({ data }: { data: Record<string, unknown> }) {
  const totalPnl = data.totalPnl as number || 0
  const totalPnlPct = data.totalPnlPct as number || 0
  const totalValue = data.totalValue as number || 0
  const positionCount = data.positionCount as number || 0
  const portfolioGreeks = data.portfolioGreeks as {
    delta?: number; gamma?: number; theta?: number; vega?: number
  } | undefined
  const positive = totalPnl >= 0

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
            <div key={i} className="flex items-center justify-between text-[11px]">
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
            </div>
          ))}
        </div>
      )}
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
    }
  }

  return widgets
}
