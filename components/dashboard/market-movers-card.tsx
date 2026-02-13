
'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMarketMovers } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MarketMoverRowProps {
    ticker: string
    price: number
    change: number
    changePercent: number
    type: 'gainer' | 'loser'
}

function MarketMoverRow({ ticker, price, change, changePercent, type }: MarketMoverRowProps) {
    const isGainer = type === 'gainer'
    const isUp = change >= 0

    return (
        <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors px-2 rounded-sm group">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    isGainer ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                )}>
                    {isGainer ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div>
                    <div className="font-semibold text-sm group-hover:text-primary transition-colors">{ticker}</div>
                    <div className="text-xs text-muted-foreground">${price.toFixed(2)}</div>
                </div>
            </div>
            <div className="text-right">
                <div className={cn(
                    "font-mono text-sm font-medium tabular-nums",
                    isUp ? "text-emerald-500" : "text-red-500"
                )}>
                    {isUp ? '+' : ''}{changePercent.toFixed(2)}%
                </div>
                <div className={cn(
                    "text-xs tabular-nums text-muted-foreground",
                    // Optional: color numeric change too? usually percent is enough focus
                )}>
                    {change > 0 ? '+' : ''}{change.toFixed(2)}
                </div>
            </div>
        </div>
    )
}

export function MarketMoversCard() {
    const { gainers, losers, isLoading } = useMarketMovers(5)

    return (
        <Card className="glass-card border-none shadow-none h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Market Movers
                </CardTitle>
                <CardDescription>Top daily price movements</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="gainers" className="w-full">
                    <div className="px-6">
                        <TabsList className="w-full grid grid-cols-2 bg-muted/20">
                            <TabsTrigger value="gainers" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-xs">Gainers</TabsTrigger>
                            <TabsTrigger value="losers" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500 text-xs">Losers</TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="h-[280px] px-6 mt-2">
                        <TabsContent value="gainers" className="mt-0 space-y-1">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-white/5" />
                                        <div className="space-y-1">
                                            <div className="h-3 w-12 bg-white/5 rounded" />
                                            <div className="h-2 w-8 bg-white/5 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                gainers.length > 0 ? (
                                    gainers.map((mover) => (
                                        <MarketMoverRow
                                            key={mover.ticker}
                                            {...mover}
                                            type="gainer"
                                        />
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-sm text-muted-foreground">No data available</div>
                                )
                            )}
                        </TabsContent>
                        <TabsContent value="losers" className="mt-0 space-y-1">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
                                        <div className="w-8 h-8 rounded-full bg-white/5" />
                                        <div className="space-y-1">
                                            <div className="h-3 w-12 bg-white/5 rounded" />
                                            <div className="h-2 w-8 bg-white/5 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                losers.length > 0 ? (
                                    losers.map((mover) => (
                                        <MarketMoverRow
                                            key={mover.ticker}
                                            {...mover}
                                            type="loser"
                                        />
                                    ))
                                ) : (
                                    <div className="py-8 text-center text-sm text-muted-foreground">No data available</div>
                                )
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
            </CardContent>
        </Card>
    )
}
