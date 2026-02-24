'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bot,
  ChartColumn,
  CheckCircle2,
  Compass,
  Layers,
  ListChecks,
  NotebookPen,
  Radar,
  Sparkles,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type CoachMode = 'spx' | 'market' | 'portfolio'
type WorkbenchView = 'agenda' | 'analyze' | 'execute'

type CoachAction = {
  id: string
  label: string
  description: string
  owner: string
  opens: string
  view: WorkbenchView
}

type ChatEntry = {
  id: string
  role: 'coach' | 'user'
  text: string
  actions?: CoachAction[]
}

const MODE_META: Record<
  CoachMode,
  {
    label: string
    summary: string
    context: Array<{ key: string; value: string }>
  }
> = {
  spx: {
    label: 'SPX Focus',
    summary: 'Live index structure, options posture, and setup execution in one lane.',
    context: [
      { key: 'Regime', value: 'Compression near 6050 pivot' },
      { key: 'Flow Bias', value: '67% call aggression' },
      { key: 'Risk Gate', value: 'No entry without invalidation + stop' },
      { key: 'Journal Link', value: '2 similar setups this week' },
    ],
  },
  market: {
    label: 'Market Intelligence',
    summary: 'Single narrative across Morning Brief, Macro, and Earnings implications.',
    context: [
      { key: 'Today', value: 'Live calendar and rates data synced from market feeds' },
      { key: 'Macro', value: 'Upcoming releases pulled from real-time economic API' },
      { key: 'Earnings', value: 'Catalysts sourced dynamically per selected symbols' },
      { key: 'Plan', value: 'Adjust playbook based on fresh event risk windows' },
    ],
  },
  portfolio: {
    label: 'Portfolio Coaching',
    summary: 'Trade journal, watchlist, and alerts tied to one assistant plan.',
    context: [
      { key: 'Open Risk', value: '3 active positions, 1 above max risk' },
      { key: 'Watchlist', value: '8 symbols, 2 near trigger zones' },
      { key: 'Journal Pattern', value: 'Late entries lower win rate by 21%' },
      { key: 'Coach Rule', value: 'Pre-plan entries before alerts fire' },
    ],
  },
}

const CHAT_FEED: ChatEntry[] = [
  {
    id: 'c1',
    role: 'coach',
    text: 'Here is the unified game plan: 1) verify market posture, 2) select one setup lane, 3) execute with journal-linked risk controls.',
    actions: [
      {
        id: 'market.show_brief',
        label: 'Open Market Brief',
        description: 'View the canonical morning + macro summary.',
        owner: 'Dashboard Brief',
        opens: '/members',
        view: 'analyze',
      },
      {
        id: 'spx.set_focus_mode',
        label: 'Enter SPX Focus',
        description: 'Switch coach context to SPX execution lane.',
        owner: 'Coach Core',
        opens: '/members/spx-command-center',
        view: 'agenda',
      },
    ],
  },
  {
    id: 'u1',
    role: 'user',
    text: 'Show me the cleanest setup and wire it to alerts + journal follow-through.',
  },
  {
    id: 'c2',
    role: 'coach',
    text: 'I can do that with one action chain. We will avoid duplicate panels and use canonical features for deep workflows.',
    actions: [
      {
        id: 'trade.build_plan',
        label: 'Build Setup Plan',
        description: 'Generate entry, invalidation, and targets.',
        owner: 'Coach Workbench',
        opens: '/members/ai-coach',
        view: 'agenda',
      },
      {
        id: 'alerts.create',
        label: 'Create Alert',
        description: 'Add trigger + invalidation alert pair.',
        owner: 'Alerts',
        opens: '/members/ai-coach',
        view: 'execute',
      },
      {
        id: 'journal.log_trade',
        label: 'Prepare Journal Entry',
        description: 'Pre-fill setup details for post-trade review.',
        owner: 'Trade Journal',
        opens: '/members/journal',
        view: 'execute',
      },
    ],
  },
]

const REGISTRY_ROWS = [
  {
    id: 'market.show_brief',
    owner: 'Morning Brief + Macro',
    contract: 'Returns one merged narrative + key catalysts.',
  },
  {
    id: 'earnings.open_event',
    owner: 'Earnings',
    contract: 'Opens event detail with expected move and scenario tree.',
  },
  {
    id: 'trade.build_plan',
    owner: 'Coach Workbench',
    contract: 'Produces entry, invalidation, targets, and checklist.',
  },
  {
    id: 'alerts.create',
    owner: 'Alerts',
    contract: 'Creates trigger + risk alert pair from one request.',
  },
  {
    id: 'journal.log_trade',
    owner: 'Trade Journal',
    contract: 'Pre-fills a structured journal draft for confirmation.',
  },
]

function ModeChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition-colors',
        active
          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10',
      )}
    >
      {children}
    </button>
  )
}

export default function AICoachRefactorMockupPage() {
  const [mode, setMode] = useState<CoachMode>('market')
  const [activeTab, setActiveTab] = useState<WorkbenchView>('agenda')
  const [selectedAction, setSelectedAction] = useState<string>('trade.build_plan')

  const modeData = MODE_META[mode]

  const currentAction = useMemo(() => {
    for (const message of CHAT_FEED) {
      const match = message.actions?.find((action) => action.id === selectedAction)
      if (match) return match
    }
    return null
  }, [selectedAction])

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-white/6 via-white/2 to-emerald-500/10 backdrop-blur-xl">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge className="w-fit border border-emerald-300/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/20">
                AI Coach Refactor Mockup
              </Badge>
              <CardTitle className="text-2xl text-white lg:text-3xl">
                Unified Coach Experience
              </CardTitle>
              <CardDescription className="max-w-3xl text-white/75">
                One assistant, one action registry, and one context rail. Deep tasks open canonical feature surfaces instead of duplicating full mini-apps.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ModeChip active={mode === 'spx'} onClick={() => setMode('spx')}>SPX Focus</ModeChip>
              <ModeChip active={mode === 'market'} onClick={() => setMode('market')}>Market Intel</ModeChip>
              <ModeChip active={mode === 'portfolio'} onClick={() => setMode('portfolio')}>Portfolio</ModeChip>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/60">
          <Badge variant="outline" className="border-white/20 bg-white/5 text-white/70">Prompt stack: base + mode + context + action policy</Badge>
          <Badge variant="outline" className="border-white/20 bg-white/5 text-white/70">Action taxonomy: typed, canonical, no overlap</Badge>
          <Badge variant="outline" className="border-white/20 bg-white/5 text-white/70">Navigation: coach orchestrates, features own workflows</Badge>
        </CardFooter>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_1.2fr_0.88fr]">
        <Card className="border-white/10 bg-[#0D1216]/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Bot className="size-4 text-emerald-300" />
              Conversation
            </CardTitle>
            <CardDescription className="text-white/60">
              Coach responses always include a concise explanation plus typed next actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {CHAT_FEED.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'rounded-xl border p-3 text-sm',
                    entry.role === 'coach'
                      ? 'border-emerald-400/20 bg-emerald-500/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/85',
                  )}
                >
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-white/50">
                    {entry.role === 'coach' ? 'AI Coach' : 'You'}
                  </div>
                  <p className="leading-relaxed">{entry.text}</p>
                  {entry.actions && entry.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.actions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => {
                            setSelectedAction(action.id)
                            setActiveTab(action.view)
                          }}
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors',
                            selectedAction === action.id
                              ? 'border-emerald-300/70 bg-emerald-500/20 text-emerald-100'
                              : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs text-white/50">Composer (mock)</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                <Badge variant="outline" className="border-white/20 bg-white/5">Show next best setup</Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5">Log this trade + review pattern</Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5">How does earnings change this plan?</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0B1114]/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Compass className="size-4 text-sky-300" />
              Action Workbench
            </CardTitle>
            <CardDescription className="text-white/60">
              Selected action: <span className="font-mono text-white/85">{selectedAction}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkbenchView)}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="agenda" className="gap-1.5">
                  <ListChecks className="size-3.5" /> Agenda
                </TabsTrigger>
                <TabsTrigger value="analyze" className="gap-1.5">
                  <ChartColumn className="size-3.5" /> Analyze
                </TabsTrigger>
                <TabsTrigger value="execute" className="gap-1.5">
                  <Target className="size-3.5" /> Execute
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agenda" className="space-y-3">
                <Card className="border-white/10 bg-white/[0.02] py-4">
                  <CardContent className="space-y-3 px-4">
                    <p className="text-sm text-white/85">{modeData.summary}</p>
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-white/50">Next Best Actions</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white/80">
                          <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" />
                          Run one consolidated context pull before opening execution tools.
                        </div>
                        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white/80">
                          <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" />
                          Keep analysis in coach; open canonical pages only for deep edits.
                        </div>
                        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-2.5 text-white/80">
                          <CheckCircle2 className="mt-0.5 size-4 text-emerald-300" />
                          Auto-attach journal context to every execution recommendation.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analyze" className="space-y-3">
                <Card className="border-white/10 bg-white/[0.02] py-4">
                  <CardContent className="space-y-3 px-4">
                    <p className="text-xs uppercase tracking-wide text-white/50">Context Stack (mode-aware)</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {modeData.context.map((line) => (
                        <div key={line.key} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                          <p className="text-[11px] uppercase tracking-wide text-white/45">{line.key}</p>
                          <p className="text-sm text-white/80">{line.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-white/[0.02] py-4">
                  <CardContent className="space-y-2 px-4">
                    <p className="text-xs uppercase tracking-wide text-white/50">Why this action</p>
                    <p className="text-sm text-white/80">
                      {currentAction?.description ?? 'Select an action from chat to inspect reasoning and execution path.'}
                    </p>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs font-mono text-white/70">
                      owner: {currentAction?.owner ?? 'n/a'}
                      <br />
                      open_surface: {currentAction?.opens ?? 'n/a'}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="execute" className="space-y-3">
                <Card className="border-white/10 bg-white/[0.02] py-4">
                  <CardContent className="space-y-3 px-4">
                    <p className="text-xs uppercase tracking-wide text-white/50">Canonical destination</p>
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-sm text-white">
                        This action executes in <span className="font-mono text-emerald-100">{currentAction?.owner ?? 'Coach Core'}</span>,
                        then returns outcome to conversation.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentAction ? (
                        <Button asChild variant="luxury" size="sm" className="rounded-lg">
                          <Link href={currentAction.opens}>
                            Open Destination <ArrowUpRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" disabled className="rounded-lg">Select an action first</Button>
                      )}
                      <Button variant="outline" size="sm" className="rounded-lg border-white/20 text-white/80 hover:bg-white/5">
                        Simulate Action Result
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-white/10 bg-[#0D1216]/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Layers className="size-4 text-amber-300" />
                Context Rail
              </CardTitle>
              <CardDescription className="text-white/60">
                Unified context for <span className="text-white/80">{modeData.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {modeData.context.map((item) => (
                <div key={item.key} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-white/45">{item.key}</p>
                  <p className="text-white/80">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0D1216]/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Radar className="size-4 text-purple-300" />
                Ownership Map
              </CardTitle>
              <CardDescription className="text-white/60">
                Coach orchestrates. Domain pages stay source-of-truth.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-white/80">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">Morning Brief + Macro to dashboard surfaces</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">Earnings deep-dive to earnings tools</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">Trade edit/review to journal route</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">Setup synthesis to coach workbench</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0B1114]/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="size-4 text-emerald-300" />
              Prompt Assembly Mock
            </CardTitle>
            <CardDescription className="text-white/60">
              Replaces fragmented coach prompts with one composable pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/75">
{`prompt = [
  base_identity,
  mode_module(${mode}),
  context_module(market + macro + portfolio),
  action_policy(typed_registry),
  output_contract(summary, why, next_actions)
]`}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0B1114]/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <NotebookPen className="size-4 text-cyan-300" />
              Action Registry Mock
            </CardTitle>
            <CardDescription className="text-white/60">
              Canonical action IDs mapped to owned feature surfaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {REGISTRY_ROWS.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="font-mono text-xs text-emerald-100">{row.id}</p>
                <p className="text-xs text-white/55">owner: {row.owner}</p>
                <p className="text-sm text-white/75">{row.contract}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
