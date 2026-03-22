'use client'

import Link from 'next/link'
import {
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TradeDetailPanel } from '@/components/admin/trade-review/trade-detail-panel'
import { cn } from '@/lib/utils'
import {
  type DetailData,
  type TradeBrowseEntry,
  coachStatusClass,
  formatCurrency,
  formatPnl,
  formatTradeDate,
} from './members-access-types'

type TradeSummary = {
  totalTrades: number
  closedTrades: number
  winRate: number | null
  totalPnl: number
}

type MemberTradesPanelProps = {
  detail: DetailData
  trades: TradeBrowseEntry[]
  tradesLoading: boolean
  tradesError: string | null
  selectedTrade: TradeBrowseEntry | null
  tradeSummary: TradeSummary
  onSelectTrade: (tradeId: string) => void
  onRefreshTrades: () => void
}

export function MemberTradesPanel({
  detail,
  trades,
  tradesLoading,
  tradesError,
  selectedTrade,
  tradeSummary,
  onSelectTrade,
  onRefreshTrades,
}: MemberTradesPanelProps) {
  if (!detail.identity.linked_user_id) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="pt-6 text-sm text-white/70">
          This Discord member is not linked to a site account yet, so there is no member journal to inspect.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <p className="text-xs text-white/50">Logged Trades</p>
            <p className="mt-1 text-xl font-semibold text-white">{tradeSummary.totalTrades}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <p className="text-xs text-white/50">Closed Trades</p>
            <p className="mt-1 text-xl font-semibold text-white">{tradeSummary.closedTrades}</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <p className="text-xs text-white/50">Win Rate</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {tradeSummary.winRate == null ? '—' : `${tradeSummary.winRate.toFixed(1)}%`}
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="pt-6">
            <p className="text-xs text-white/50">Net P&L</p>
            <p className={cn(
              'mt-1 text-xl font-semibold',
              tradeSummary.totalPnl >= 0 ? 'text-emerald-300' : 'text-red-300',
            )}
            >
              {formatPnl(tradeSummary.totalPnl)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Linked journal account</p>
          <p className="font-mono text-xs text-white/50">{detail.identity.linked_user_id}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/5"
          onClick={onRefreshTrades}
          disabled={tradesLoading}
        >
          {tradesLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh Trades
        </Button>
      </div>

      {tradesLoading && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-500" />
          Loading member trades...
        </div>
      )}

      {!tradesLoading && tradesError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {tradesError}
        </div>
      )}

      {!tradesLoading && !tradesError && trades.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/60">
          No logged trades were found for this member.
        </div>
      )}

      {!tradesLoading && !tradesError && trades.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[340px,minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
              {trades.map((entry) => {
                const isSelected = entry.id === selectedTrade?.id
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-testid={`member-trade-row-${entry.id}`}
                    onClick={() => onSelectTrade(entry.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition',
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {entry.symbol.toUpperCase()} {entry.direction}
                        </p>
                        <p className="text-xs text-white/50">
                          {formatTradeDate(entry.trade_date)} • {entry.contract_type}
                        </p>
                      </div>
                      <Badge className={cn('border', coachStatusClass(entry.coach_review_status))}>
                        {entry.coach_review_status ?? 'none'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className={cn(
                        'font-mono',
                        entry.pnl != null && entry.pnl < 0 ? 'text-red-300' : 'text-emerald-300',
                      )}
                      >
                        {formatPnl(entry.pnl)}
                      </span>
                      <span className="text-white/50">
                        {entry.entry_price == null ? '—' : formatCurrency(entry.entry_price)}
                        {' → '}
                        {entry.exit_price == null ? '—' : formatCurrency(entry.exit_price)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-white">Trade Detail</p>
                <p className="text-xs text-white/50">
                  {selectedTrade
                    ? `${selectedTrade.symbol.toUpperCase()} ${selectedTrade.direction} on ${formatTradeDate(selectedTrade.trade_date)}`
                    : 'Select a trade to inspect the full journal entry.'}
                </p>
              </div>
              {selectedTrade && (
                <Button asChild type="button" variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  <Link href={`/admin/trade-review/${selectedTrade.id}`} data-testid="member-trade-detail-link">
                    Open In Trade Review
                  </Link>
                </Button>
              )}
            </div>

            <TradeDetailPanel
              entry={selectedTrade}
              memberDisplayName={detail.identity.nickname || detail.identity.global_name || detail.identity.username || 'Unknown member'}
              memberDiscordUsername={detail.identity.username ? `@${detail.identity.username}` : null}
              memberAvatarUrl={detail.identity.avatar_url}
              memberTier={detail.app_access.resolved_tier}
            />
          </div>
        </div>
      )}
    </>
  )
}
