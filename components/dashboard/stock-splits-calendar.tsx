
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUpcomingSplits } from '@/hooks/useMarketData'
import { cn } from '@/lib/utils'
import { CalendarDays, Split } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

export function StockSplitsCalendar() {
    const { splits, isLoading, isError } = useUpcomingSplits()

    return (
        <Card className="glass-card border-none shadow-none h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Split className="w-4 h-4 text-blue-400" />
                    Stock Splits
                </CardTitle>
                <CardDescription>Upcoming corporate actions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px] px-6">
                    <div className="space-y-4 py-2">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-2 p-3 rounded-lg border border-white/5 bg-white/[0.02] animate-pulse">
                                    <div className="flex items-center justify-between">
                                        <div className="h-4 w-12 bg-white/5 rounded" />
                                        <div className="h-4 w-16 bg-white/5 rounded" />
                                    </div>
                                    <div className="h-3 w-24 bg-white/5 rounded" />
                                </div>
                            ))
                        ) : (
                            splits.length > 0 ? (
                                splits.map((split) => (
                                    <div key={`${split.ticker}-${split.exDate}`} className="flex flex-col gap-2 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm group-hover:text-primary transition-colors">{split.ticker}</span>
                                            <Badge variant="secondary" className="text-[10px] h-5">{split.ratio}:1 Split</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <CalendarDays className="w-3 h-3" />
                                            <span>Ex-Date: {new Date(split.exDate).toLocaleDateString()}</span>
                                        </div>
                                        {split.paymentDate && (
                                            <div className="text-[10px] text-muted-foreground/60 pl-5">
                                                Pay Date: {new Date(split.paymentDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-sm text-muted-foreground">
                                  {isError ? 'Stock split feed unavailable' : 'No upcoming splits found'}
                                </div>
                            )
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
