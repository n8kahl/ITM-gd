import { useMoneyMaker } from './money-maker-provider'
import { Card, CardContent } from '@/components/ui/card'
import { SetupCard } from './setup-card'

export function SetupGrid() {
    const { state } = useMoneyMaker()
    const { symbols, isLoading, error } = state

    if (error) {
        return null // Shell handles error state
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(idx => (
                    <Card key={idx} className="h-64 border-white/5 bg-white/[0.02] animate-pulse">
                        <CardContent className="h-full flex items-center justify-center">
                            <span className="text-muted-foreground/50">Loading Symbol...</span>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    if (symbols.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.02]">
                <div className="text-center">
                    <p className="text-lg font-medium text-muted-foreground">No Symbols in Watchlist</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Add symbols to monitor setups.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {symbols.map(symbol => (
                <SetupCard key={symbol} symbol={symbol} />
            ))}
        </div>
    )
}
