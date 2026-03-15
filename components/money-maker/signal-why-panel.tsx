import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MoneyMakerSignal } from '@/lib/money-maker/types'
import { describeMoneyMakerZone, formatMoneyMakerEasternTime, normalizeMoneyMakerLevelSource } from '@/lib/money-maker/presentation'

interface SignalWhyPanelProps {
    signal: MoneyMakerSignal | null
    isOpen: boolean
    onClose: () => void
}

export function SignalWhyPanel({ signal, isOpen, onClose }: SignalWhyPanelProps) {
    if (!signal) return null

    const isLong = signal.direction === 'long'
    const colorClass = isLong ? 'text-emerald-400' : 'text-red-400'
    const bgClass = isLong ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'
    const zoneSummary = describeMoneyMakerZone(signal.confluenceZone, signal.entry)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] border-white/10 bg-[#0A0A0B]/95 backdrop-blur-xl text-white">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl font-bold tracking-tight">
                            {signal.symbol} <span className={`uppercase font-mono ml-2 ${colorClass}`}>{signal.strategyType}</span>
                        </DialogTitle>
                        <Badge variant="outline" className={`capitalize ${isLong ? 'border-emerald-500/50 text-emerald-400' : 'border-red-500/50 text-red-400'}`}>
                            {signal.direction}
                        </Badge>
                    </div>
                    <DialogDescription className="text-muted-foreground mt-2">
                        Generated at {formatMoneyMakerEasternTime(signal.timestamp, { withSeconds: true })}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 my-4">
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trade Execution</h4>
                            <div className={`rounded-xl border p-4 ${bgClass}`}>
                                <div className="grid grid-cols-2 gap-y-4 text-sm">
                                    <div>
                                        <span className="block text-muted-foreground mb-1 text-xs">Entry</span>
                                        <span className="font-mono font-bold">${signal.entry.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground mb-1 text-xs">R:R Ratio</span>
                                        <span className="font-mono font-bold">{signal.riskRewardRatio} R</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground mb-1 text-xs">Target</span>
                                        <span className="font-mono font-bold">${signal.target.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="block text-muted-foreground mb-1 text-xs">Stop Loss</span>
                                        <span className="font-mono font-bold text-red-400">${signal.stop.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Context</h4>
                            <ul className="space-y-2 text-sm text-ivory/80">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Regime: <span className="capitalize">{signal.orbRegime.replace(/_/g, ' ')}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Zone: {zoneSummary?.title ?? 'Confluence cluster'} ({signal.confluenceZone.score.toFixed(1)} pts)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    Quality Rank: #{signal.signalRank}
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Patience Candle</h4>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
                                <p className="mb-2"><span className="text-muted-foreground">Pattern:</span> <span className="capitalize">{signal.patienceCandle.pattern.replace('_', ' ')}</span></p>
                                <div className="grid grid-cols-2 gap-2 font-mono text-xs opacity-80">
                                    <div>O: {signal.patienceCandle.bar.open.toFixed(2)}</div>
                                    <div>H: {signal.patienceCandle.bar.high.toFixed(2)}</div>
                                    <div>L: {signal.patienceCandle.bar.low.toFixed(2)}</div>
                                    <div>C: {signal.patienceCandle.bar.close.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confluence Stack</h4>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm">
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/5">
                                    <span className="text-muted-foreground">Zone Range</span>
                                    <span className="font-mono text-xs">${signal.confluenceZone.priceLow.toFixed(2)} - ${signal.confluenceZone.priceHigh.toFixed(2)}</span>
                                </div>
                                {zoneSummary ? (
                                    <p className="mb-2 text-xs text-muted-foreground/80">{zoneSummary.description}</p>
                                ) : null}
                                <ul className="space-y-1 mt-2">
                                    {signal.confluenceZone.levels.map((lvl, idx) => (
                                        <li key={idx} className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground/80">{normalizeMoneyMakerLevelSource(lvl.source)}</span>
                                            <span className="font-mono text-white/90">{lvl.price.toFixed(2)}</span>
                                        </li>
                                    ))}
                                    {signal.confluenceZone.levels.length === 0 && (
                                        <li className="text-xs text-muted-foreground italic">No nearby levels</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    )
}
