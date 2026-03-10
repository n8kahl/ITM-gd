'use client'

import { useMoneyMaker } from './money-maker-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMoneyMakerPolling } from '@/hooks/use-money-maker-polling'
import { WatchlistManager } from './watchlist-manager'
import { ActiveStrategiesClock } from './active-strategies-clock'

export function MoneyMakerShell({ children }: { children: React.ReactNode }) {
    useMoneyMakerPolling()
    const { state } = useMoneyMaker()

    const formattedTime = state.lastUpdated
        ? new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(new Date(state.lastUpdated))
        : 'Never'

    return (
        <div className="flex flex-col h-full w-full space-y-4 pt-4">
            {/* Header Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between px-6 pb-2 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white/90">Money Maker</h1>
                    <p className="text-sm text-muted-foreground mt-1">High-Precision KCU Strategy Signals</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <ActiveStrategiesClock />
                    <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground ml-2">
                        {state.isLoading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />}
                        <span>Last updated: {formattedTime}</span>
                    </div>
                    <WatchlistManager />
                    <Button variant="outline" size="sm" className="gap-2">
                        {state.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 px-6 pb-6 overflow-y-auto">
                {state.error ? (
                    <Card className="border-destructive bg-destructive/10">
                        <CardHeader>
                            <CardTitle className="text-destructive">Error Loading Strategy Data</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {state.error}
                        </CardContent>
                    </Card>
                ) : (
                    children
                )}
            </div>
        </div>
    )
}
