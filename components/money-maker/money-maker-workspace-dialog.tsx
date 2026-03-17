'use client'

import { AlertTriangle, Loader2, RefreshCw, ShieldAlert, Target, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMoneyMaker } from './money-maker-provider'
import { useMoneyMakerWorkspace } from '@/hooks/use-money-maker-workspace'
import {
    describeMoneyMakerTimeWarning,
    describeMoneyMakerZone,
    formatMoneyMakerEasternTime,
    getMoneyMakerFreshnessLabel,
    getMoneyMakerFreshnessStatus,
} from '@/lib/money-maker/presentation'

function formatPrice(value: number | null | undefined) {
    return typeof value === 'number' ? `$${value.toFixed(2)}` : '--'
}

function formatPercent(value: number | null | undefined) {
    return typeof value === 'number' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '--'
}

function formatStateLabel(value: string) {
    return value.replace(/_/g, ' ')
}

function stateBadgeClass(state: string) {
    if (state === 'failed' || state === 'closed') return 'border-red-500/40 bg-red-500/10 text-red-300'
    if (state === 'extended') return 'border-amber-500/40 bg-amber-500/10 text-amber-200'
    if (state === 'triggered' || state === 'target1_hit' || state === 'target2_in_play') {
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    }
    return 'border-white/15 bg-white/5 text-white/75'
}

export function MoneyMakerWorkspaceDialog() {
    const { refreshWorkspace } = useMoneyMakerWorkspace()
    const { state, closeWorkspace } = useMoneyMaker()
    const workspace = state.workspace
    const contracts = Array.isArray(workspace?.contracts) ? workspace.contracts : []
    const executionPlan = workspace?.executionPlan ?? null
    const symbolSnapshot = workspace?.symbolSnapshot ?? null
    const zoneSummary = describeMoneyMakerZone(symbolSnapshot?.strongestConfluence ?? null, symbolSnapshot?.price ?? null)
    const freshnessStatus = getMoneyMakerFreshnessStatus(workspace?.generatedAt ?? null)
    const freshnessLabel = getMoneyMakerFreshnessLabel(freshnessStatus)
    const freshnessBadgeClass = freshnessStatus === 'live'
        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
        : freshnessStatus === 'delayed'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-red-500/40 bg-red-500/10 text-red-300'

    return (
        <Dialog open={state.isWorkspaceOpen} onOpenChange={(open) => !open && closeWorkspace()}>
            <DialogContent className="w-[min(1100px,calc(100vw-2rem))] max-w-6xl border-white/10 bg-[#070708]/95 text-white backdrop-blur-xl">
                <DialogHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight">
                                {state.workspaceSymbol ?? 'Money Maker Plan'}
                            </DialogTitle>
                            <DialogDescription className="mt-2 text-white/60">
                                {workspace?.generatedAt
                                    ? `Generated ${formatMoneyMakerEasternTime(workspace.generatedAt, { withSeconds: true })}`
                                    : 'Execution workspace loads on demand from the current Money Maker snapshot.'}
                            </DialogDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {executionPlan ? (
                                <>
                                    <Badge variant="outline" className={stateBadgeClass(executionPlan.executionState)}>
                                        {formatStateLabel(executionPlan.executionState)}
                                    </Badge>
                                    <Badge variant="outline" className="border-white/15 bg-white/5 capitalize text-white/80">
                                        {executionPlan.entryQuality}
                                    </Badge>
                                    <Badge variant="outline" className="border-white/15 bg-white/5 text-white/80">
                                        {executionPlan.timeWarning.replace(/_/g, ' ')}
                                    </Badge>
                                </>
                            ) : null}
                            {workspace ? (
                                <Badge variant="outline" className={freshnessBadgeClass}>
                                    {freshnessLabel}
                                </Badge>
                            ) : null}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={state.isWorkspaceLoading || !state.workspaceSymbol}
                                onClick={() => {
                                    void refreshWorkspace()
                                }}
                            >
                                {state.isWorkspaceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Refresh Plan
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {state.workspaceError ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                        {state.workspaceError}
                    </div>
                ) : null}

                {workspace?.degradedReason ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                        {workspace.degradedReason}
                    </div>
                ) : null}

                {workspace && freshnessStatus !== 'live' ? (
                    <div className={`rounded-xl border p-4 text-sm ${freshnessStatus === 'stale'
                        ? 'border-red-500/30 bg-red-500/10 text-red-100'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                        }`}
                    >
                        {freshnessStatus === 'stale'
                            ? 'Workspace data is stale. Refresh before acting on a new entry or exit.'
                            : 'Workspace data is delayed. Confirm the latest tape before acting on a fresh entry.'}
                    </div>
                ) : null}

                {state.isWorkspaceLoading && !workspace ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center gap-3 text-white/75">
                            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                            <span>Building execution workspace…</span>
                        </div>
                    </div>
                ) : workspace ? (
                    <Tabs defaultValue="setup-map">
                        <TabsList>
                            <TabsTrigger value="setup-map">Setup Map</TabsTrigger>
                            <TabsTrigger value="trade-plan">Trade Plan</TabsTrigger>
                            <TabsTrigger value="contracts">Contracts</TabsTrigger>
                            <TabsTrigger value="exit-playbook">Exit Playbook</TabsTrigger>
                        </TabsList>

                        <TabsContent value="setup-map" forceMount className="space-y-6">
                            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Price Ladder</p>
                                            <h3 className="mt-2 text-lg font-semibold">Execution map for {workspace.symbolSnapshot.symbol}</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-white/45">Current price</p>
                                            <p className="text-2xl font-semibold">{formatPrice(symbolSnapshot?.price)}</p>
                                            <p className="text-xs text-white/50">{formatPercent(symbolSnapshot?.priceChangePercent)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                                        {[
                                            ['Trigger', executionPlan ? formatPrice(executionPlan.entry) : '--'],
                                            ['Ideal zone', executionPlan ? `${formatPrice(executionPlan.idealEntryLow)} - ${formatPrice(executionPlan.idealEntryHigh)}` : '--'],
                                            ['Stop', executionPlan ? formatPrice(executionPlan.stop) : '--'],
                                            ['Target 1', executionPlan ? formatPrice(executionPlan.target1) : '--'],
                                            ['Target 2', executionPlan?.target2 ? formatPrice(executionPlan.target2) : '--'],
                                            ['Chase cutoff', executionPlan ? formatPrice(executionPlan.chaseCutoff) : '--'],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-xl border border-white/10 bg-black/30 p-4">
                                                <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
                                                <p className="mt-2 text-lg font-semibold text-white">{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Confluence</p>
                                        <h3 className="mt-2 text-lg font-semibold">{zoneSummary?.title ?? 'No active confluence zone'}</h3>
                                        <p className="mt-2 text-sm text-white/65">{zoneSummary?.description ?? 'Waiting for stronger underlying structure.'}</p>
                                        {symbolSnapshot?.strongestConfluence?.levels?.length ? (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {symbolSnapshot.strongestConfluence.levels.slice(0, 5).map((level, index) => (
                                                    <span key={`${level.source}-${index}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                                                        {level.source} {level.price.toFixed(2)}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Structure Levels</p>
                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-white/45">VWAP</p>
                                                <p className="mt-1 font-semibold">{formatPrice(symbolSnapshot?.indicators.vwap)}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/45">8 EMA</p>
                                                <p className="mt-1 font-semibold">{formatPrice(symbolSnapshot?.indicators.ema8)}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/45">21 EMA</p>
                                                <p className="mt-1 font-semibold">{formatPrice(symbolSnapshot?.indicators.ema21)}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/45">Regime</p>
                                                <p className="mt-1 font-semibold capitalize">
                                                    {symbolSnapshot?.orbRegime ? symbolSnapshot.orbRegime.replace(/_/g, ' ') : '--'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="trade-plan" forceMount className="space-y-4">
                            {executionPlan ? (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Trigger</p>
                                        <p className="mt-2 text-xl font-semibold">{formatPrice(executionPlan.entry)}</p>
                                        <p className="mt-2 text-sm text-white/60">
                                            Trigger distance {executionPlan.triggerDistance > 0 ? '+' : ''}{executionPlan.triggerDistance.toFixed(2)} ({executionPlan.triggerDistancePct.toFixed(2)}%)
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Ideal Entry Zone</p>
                                        <p className="mt-2 text-xl font-semibold">
                                            {formatPrice(executionPlan.idealEntryLow)} - {formatPrice(executionPlan.idealEntryHigh)}
                                        </p>
                                        <p className="mt-2 text-sm text-white/60 capitalize">{executionPlan.entryQuality} quality right now</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Do Not Chase</p>
                                        <p className="mt-2 text-xl font-semibold">{formatPrice(executionPlan.chaseCutoff)}</p>
                                        <p className="mt-2 text-sm text-white/60">Above this line, fresh entries become poor quality.</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Invalidation</p>
                                        <p className="mt-2 text-xl font-semibold">{formatPrice(executionPlan.stop)}</p>
                                        <p className="mt-2 text-sm text-white/60">{executionPlan.invalidationReason}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Target Ladder</p>
                                        <div className="mt-3 space-y-2 text-sm text-white/75">
                                            <div className="flex items-center justify-between"><span>T1</span><span>{formatPrice(executionPlan.target1)}</span></div>
                                            <div className="flex items-center justify-between"><span>T2</span><span>{formatPrice(executionPlan.target2)}</span></div>
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-white/45">Plan Context</p>
                                        <div className="mt-3 space-y-2 text-sm text-white/75">
                                            <div className="flex items-center justify-between"><span>State</span><span className="capitalize">{formatStateLabel(executionPlan.executionState)}</span></div>
                                            <div className="flex items-center justify-between"><span>R:R</span><span>{executionPlan.riskRewardRatio.toFixed(2)}</span></div>
                                            <div className="flex items-center justify-between"><span>Time</span><span className="capitalize">{formatStateLabel(executionPlan.timeWarning)}</span></div>
                                        </div>
                                        {executionPlan.timeWarning !== 'normal' ? (
                                            <p className="mt-3 text-sm text-amber-100/90">
                                                {describeMoneyMakerTimeWarning(executionPlan.timeWarning)}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/65">
                                    No active execution plan is available for this symbol yet.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="contracts" forceMount className="space-y-4">
                            {contracts.length > 0 ? (
                                <div className="grid gap-4 lg:grid-cols-3">
                                    {contracts.map((contract) => (
                                        <div key={`${contract.label}-${contract.optionSymbol}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">{contract.label.replace('_', ' ')}</p>
                                                    <h3 className="mt-2 text-lg font-semibold">{contract.optionSymbol}</h3>
                                                </div>
                                                <Badge variant="outline" className={contract.quality === 'green' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-200'}>
                                                    {contract.quality}
                                                </Badge>
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-white/45">Bid / Ask</p><p className="mt-1 font-semibold">{contract.bid.toFixed(2)} / {contract.ask.toFixed(2)}</p></div>
                                                <div><p className="text-white/45">Delta</p><p className="mt-1 font-semibold">{contract.delta?.toFixed(2) ?? '--'}</p></div>
                                                <div><p className="text-white/45">DTE</p><p className="mt-1 font-semibold">{contract.dte}</p></div>
                                                <div><p className="text-white/45">Premium</p><p className="mt-1 font-semibold">${contract.premiumPerContract.toFixed(0)}</p></div>
                                            </div>
                                            <p className="mt-4 text-sm text-white/65">{contract.explanation}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/65">
                                    {workspace.degradedReason ?? 'No contract guidance is available for this setup yet.'}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="exit-playbook" forceMount className="space-y-4">
                            {executionPlan ? (
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <div className="flex items-center gap-2 text-emerald-300">
                                            <TrendingUp className="h-4 w-4" />
                                            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Hold While</p>
                                        </div>
                                        <ul className="mt-4 space-y-3 text-sm text-white/70">
                                            {executionPlan.holdWhile.map((item) => (
                                                <li key={item} className="leading-relaxed">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <div className="flex items-center gap-2 text-amber-200">
                                            <Target className="h-4 w-4" />
                                            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Reduce When</p>
                                        </div>
                                        <ul className="mt-4 space-y-3 text-sm text-white/70">
                                            {executionPlan.reduceWhen.map((item) => (
                                                <li key={item} className="leading-relaxed">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                                        <div className="flex items-center gap-2 text-red-300">
                                            <ShieldAlert className="h-4 w-4" />
                                            <p className="text-sm font-semibold uppercase tracking-[0.2em]">Exit Immediately</p>
                                        </div>
                                        <ul className="mt-4 space-y-3 text-sm text-white/70">
                                            {executionPlan.exitImmediatelyWhen.map((item) => (
                                                <li key={item} className="leading-relaxed">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white/65">
                                    Exit playbook will populate when an active execution plan is available.
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-white/60">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-base font-medium">No workspace selected</p>
                        <p className="mt-2 text-sm text-white/50">Open a plan from the Money Maker board to inspect execution detail.</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
