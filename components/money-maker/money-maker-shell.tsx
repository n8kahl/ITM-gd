'use client'

import { useMoneyMaker } from './money-maker-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMoneyMakerPolling } from '@/hooks/use-money-maker-polling'
import { WatchlistManager } from './watchlist-manager'
import { ActiveStrategiesClock } from './active-strategies-clock'
import { MoneyMakerWorkspaceDialog } from './money-maker-workspace-dialog'
import { MoneyMakerExecutionAlerts } from './money-maker-execution-alerts'
import { formatMoneyMakerEasternTime, getMoneyMakerFreshnessLabel, getMoneyMakerFreshnessStatus } from '@/lib/money-maker/presentation'

export function MoneyMakerShell({ children }: { children: React.ReactNode }) {
    const { refreshSnapshot } = useMoneyMakerPolling()
    const { state } = useMoneyMaker()
    const isBusy = state.isLoading || state.isRefreshing
    const freshnessStatus = getMoneyMakerFreshnessStatus(state.lastUpdated)
    const freshnessLabel = getMoneyMakerFreshnessLabel(freshnessStatus)
    const freshnessBadgeClass = freshnessStatus === 'live'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
        : freshnessStatus === 'delayed'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-red-500/40 bg-red-500/10 text-red-300'

    const formattedTime = state.lastUpdated
        ? formatMoneyMakerEasternTime(state.lastUpdated, { withSeconds: true })
        : 'Never'

    return (
        <div data-testid="money-maker-shell" className="flex flex-col h-full w-full space-y-4 pt-4">
            <MoneyMakerExecutionAlerts />
            {/* Header Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 pb-2 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white/90">Money Maker</h1>
                    <p className="text-sm text-muted-foreground mt-1">High-Precision KCU Strategy Signals</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <ActiveStrategiesClock />
                    <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground ml-2">
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />}
                        <Badge variant="outline" className={freshnessBadgeClass}>
                            {freshnessLabel}
                        </Badge>
                        <span>Last updated: {formattedTime}</span>
                    </div>
                    <WatchlistManager />
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={isBusy}
                        onClick={() => {
                            void refreshSnapshot()
                        }}
                    >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 px-6 pb-6 overflow-y-auto">
                {state.error ? (
                    <Card className="mb-4 border-destructive bg-destructive/10">
                        <CardHeader>
                            <CardTitle className="text-destructive">Strategy Data Degraded</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {state.error}
                        </CardContent>
                    </Card>
                ) : null}
                {children}
            </div>
            <MoneyMakerWorkspaceDialog />
        </div>
    )
}
