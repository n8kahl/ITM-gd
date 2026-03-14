'use client'

import { type Dispatch, type SetStateAction, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock,
  Crosshair,
  Filter,
  ListChecks,
  RefreshCcw,
} from 'lucide-react'

import { Analytics } from '@/lib/analytics'

const LEARN_ITEMS = [
  { icon: Crosshair, text: 'The 7 characteristics of an A+ setup' },
  { icon: CheckSquare, text: 'How to build and use a pre-trade checklist' },
  { icon: ListChecks, text: 'Watchlist construction: 3-tier framework' },
  { icon: Clock, text: 'Time-of-day edge: when to trade and when to sit' },
] as const

const SETUP_CRITERIA = [
  { title: 'Clear Directional Bias', description: 'Market trend supports your direction' },
  { title: 'Key Technical Level', description: 'Price at significant S/R, VWAP, or MA' },
  { title: 'Volume Confirmation', description: 'Above-average volume validates the move' },
  { title: 'Favorable Time of Day', description: 'First 30 min or last hour' },
  { title: 'Defined Risk-to-Reward', description: 'Minimum 1:2 R:R with stop and target set' },
  { title: 'Clean Emotional State', description: 'Calm, focused, following your plan' },
  { title: 'Passes Your Checklist', description: 'All 7 must be true simultaneously' },
] as const

const TIME_ZONES = [
  {
    time: '9:30-10:00 AM',
    label: 'The Opening Drive',
    detail: 'Highest volume, momentum plays',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/35',
    background: 'bg-emerald-500/[0.05]',
  },
  {
    time: '10:00-11:30 AM',
    label: 'The Reversal Zone',
    detail: 'Consolidation, fade setups',
    accent: 'text-champagne',
    border: 'border-champagne/35',
    background: 'bg-champagne/5',
  },
  {
    time: '11:30 AM-2:00 PM',
    label: 'The Chop Zone',
    detail: 'Avoid trading, review instead',
    accent: 'text-red-400',
    border: 'border-red-500/35',
    background: 'bg-red-500/[0.05]',
  },
  {
    time: '3:00-4:00 PM',
    label: 'Power Hour',
    detail: 'Second volume surge, trend confirmation',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/35',
    background: 'bg-emerald-500/[0.05]',
  },
] as const

const BEFORE_AFTER_ROWS = [
  { before: '47 trades/month', after: '12 trades/month' },
  { before: '47% emotional/FOMO/revenge', after: '8% unplanned' },
  { before: '38% win rate', after: '67% win rate' },
  { before: '0.8:1 average R:R', after: '2.1:1 average R:R' },
  { before: '-$1,240 net P&L', after: '+$2,890 net P&L' },
  { before: 'Stressed, inconsistent', after: 'Disciplined, in control' },
] as const

const QUIZ: { q: string; options: string[]; correct: number; explanation: string }[] = [
  {
    q: 'AAPL at key support, above-avg volume, 10:15 AM, SPX trending up, calm emotional state, R:R 1:2.5, defined stop. A+ setup?',
    options: [
      'No - missing volume confirmation',
      'Yes - all 7 criteria met',
      'No - too early in the day',
      'Yes - but only if you size up',
    ],
    correct: 1,
    explanation: 'All 7 checklist gates pass. Market trend, key level, volume, time, R:R, emotional state, and position size all check out.',
  },
  {
    q: '12:45 PM, TSLA setup, 5/7 checklist items green. What do you do?',
    options: [
      'Take it - 5/7 is good enough',
      'Skip - B trade in the chop zone',
      'Size down and take it',
      'Wait and re-check at 3 PM',
    ],
    correct: 1,
    explanation: '5/7 is a B trade, and 12:45 PM sits inside the chop zone. Snipers skip B trades when the session context is already weak.',
  },
  {
    q: 'How many symbols should your Tier 1 (Core) watchlist contain?',
    options: [
      '15-20 for max opportunity',
      '3-5 high-liquidity familiar symbols',
      'Only 1 to master it',
      'Whatever is trending on social media',
    ],
    correct: 1,
    explanation: '3-5 core symbols gives enough opportunity while preserving the deep familiarity needed for fast pattern recognition.',
  },
  {
    q: 'You lost $300, new QQQ setup is 6/7 - only emotional state is red. What do you do?',
    options: [
      'Take it - 6/7 is close enough',
      'Skip - emotional state is non-negotiable',
      'Paper trade it',
      'Size down to half',
    ],
    correct: 1,
    explanation: 'Emotional state is non-negotiable. If you are tilted, angry, or pressing to make money back, you are impaired and should walk away.',
  },
  {
    q: 'Filter backtest: 6 filtered trades = +$1,800, 14 unfiltered = -$2,300. What does this tell you?',
    options: [
      'Only trade 6 times per month',
      'The filter identifies your edge',
      'Find more A+ setups',
      'The filter is too strict',
    ],
    correct: 1,
    explanation: 'The filtered trades produced the profits while the unfiltered trades destroyed them. Your edge lives inside the setups that pass the filter.',
  },
]

const ASSIGNMENT_TASKS = [
  'Copy or customize the 7-point Pre-Trade Checklist',
  'Print it or save as phone wallpaper / desk sticky note',
  'Choose 3-5 Tier 1 (Core) watchlist symbols',
  'Choose 2-3 Tier 2 (Rotation) symbols for this week',
  'Add 1-2 Tier 3 (Catalyst) symbols if events are approaching',
  'Write key levels (support/resistance) for each watchlist symbol',
  'Run your 20 Week 1 trades through the new checklist - score each X/7',
  'Calculate: What % of trades would have been filtered out?',
  'Calculate: What would your P&L be with only 7/7 trades?',
  'Identify 3 A+ setups during live market this week (even if paper trading)',
  'Log each setup in Trade Journal with tag "Filtered Setup" and checklist score',
  'Bring your watchlist, checklist, and backtest results to the Week 2 group call',
] as const

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function toMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatMoneyPerTrade(value: number | null): string {
  return value === null ? 'N/A' : `${toMoney(value)} / trade`
}

function toggleChecklistGate(setter: Dispatch<SetStateAction<boolean>>) {
  setter((previous) => !previous)
  void Analytics.trackAcademyAction('mentorship_week2_checklist_toggle')
}

export default function Week2Page() {
  const [marketTrend, setMarketTrend] = useState(false)
  const [keyLevel, setKeyLevel] = useState(false)
  const [volumeConfirmation, setVolumeConfirmation] = useState(false)
  const [timeOfDay, setTimeOfDay] = useState(false)
  const [riskRewardDefined, setRiskRewardDefined] = useState(false)
  const [emotionalState, setEmotionalState] = useState(false)
  const [positionSize, setPositionSize] = useState(false)
  const [totalTrades, setTotalTrades] = useState(20)
  const [filteredTrades, setFilteredTrades] = useState(6)
  const [filteredPnl, setFilteredPnl] = useState(1800)
  const [unfilteredPnl, setUnfilteredPnl] = useState(-2300)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})

  const checklistCards = [
    {
      title: 'Market Trend',
      prompt: 'SPX/QQQ trending in my trade direction?',
      checked: marketTrend,
      onToggle: () => toggleChecklistGate(setMarketTrend),
    },
    {
      title: 'Key Level',
      prompt: 'Price at significant S/R, VWAP, or MA?',
      checked: keyLevel,
      onToggle: () => toggleChecklistGate(setKeyLevel),
    },
    {
      title: 'Volume',
      prompt: 'Current volume above 20-day average?',
      checked: volumeConfirmation,
      onToggle: () => toggleChecklistGate(setVolumeConfirmation),
    },
    {
      title: 'Time of Day',
      prompt: 'In a high-probability window?',
      checked: timeOfDay,
      onToggle: () => toggleChecklistGate(setTimeOfDay),
    },
    {
      title: 'R:R Defined',
      prompt: 'At least 1:2 with stop-loss and target?',
      checked: riskRewardDefined,
      onToggle: () => toggleChecklistGate(setRiskRewardDefined),
    },
    {
      title: 'Emotional State',
      prompt: 'Calm, focused, not revenge/FOMO?',
      checked: emotionalState,
      onToggle: () => toggleChecklistGate(setEmotionalState),
    },
    {
      title: 'Position Size',
      prompt: 'Risk <= 2% and within daily loss limit?',
      checked: positionSize,
      onToggle: () => toggleChecklistGate(setPositionSize),
    },
  ] as const

  const checklistScore = useMemo(
    () =>
      [
        marketTrend,
        keyLevel,
        volumeConfirmation,
        timeOfDay,
        riskRewardDefined,
        emotionalState,
        positionSize,
      ].filter(Boolean).length,
    [emotionalState, keyLevel, marketTrend, positionSize, riskRewardDefined, timeOfDay, volumeConfirmation]
  )

  const checklistVerdict = useMemo(() => {
    if (checklistScore === 7) {
      return {
        tone: 'border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300',
        label: 'A+ SETUP - Execute with confidence',
      }
    }

    if (checklistScore >= 5) {
      return {
        tone: 'border-champagne/25 bg-champagne/10 text-champagne',
        label: 'B SETUP - Skip or paper trade only',
      }
    }

    return {
      tone: 'border-red-500/25 bg-red-500/[0.08] text-red-300',
      label: 'NO TRADE - Walk away',
    }
  }, [checklistScore])

  const backtest = useMemo(() => {
    const safeTotalTrades = Math.max(totalTrades, 0)
    const safeFilteredTrades = clampNumber(filteredTrades, 0, safeTotalTrades)
    const safeFilteredPnl = Number.isFinite(filteredPnl) ? filteredPnl : 0
    const safeUnfilteredPnl = Number.isFinite(unfilteredPnl) ? unfilteredPnl : 0
    const remainingTrades = Math.max(safeTotalTrades - safeFilteredTrades, 0)

    return {
      totalTrades: safeTotalTrades,
      filteredTrades: safeFilteredTrades,
      unfilteredTrades: remainingTrades,
      filterRate: safeTotalTrades > 0 ? (safeFilteredTrades / safeTotalTrades) * 100 : 0,
      filteredPnlPerTrade: safeFilteredTrades > 0 ? safeFilteredPnl / safeFilteredTrades : null,
      unfilteredPnlPerTrade: remainingTrades > 0 ? safeUnfilteredPnl / remainingTrades : null,
      projectedMonthlyPnl: safeFilteredPnl,
    }
  }, [filteredPnl, filteredTrades, totalTrades, unfilteredPnl])

  const resetChecklist = () => {
    setMarketTrend(false)
    setKeyLevel(false)
    setVolumeConfirmation(false)
    setTimeOfDay(false)
    setRiskRewardDefined(false)
    setEmotionalState(false)
    setPositionSize(false)
  }

  const handleQuizSelect = (questionIndex: number, optionIndex: number) => {
    setQuizAnswers((previous) => ({ ...previous, [questionIndex]: optionIndex }))
    void Analytics.trackAcademyAction(`mentorship_week2_quiz_q${questionIndex + 1}`)
  }

  return (
    <div className="space-y-8">
      <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8 md:p-10">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            Week 2 of 8
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold md:text-3xl">
            The Setup Filter
          </h1>
          <p className="mt-2 text-lg italic text-white/50">
            &ldquo;If it doesn&apos;t pass the checklist, it doesn&apos;t get your capital.&rdquo;
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/members/mentorship/week-2/checklist-guide"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <CheckSquare className="h-4 w-4" strokeWidth={1.5} />
              Open Checklist Guide
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
            <Link
              href="/members/journal"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              Go to Trade Journal
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
            <Filter className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Core Lesson</h2>
            <p className="text-xs text-white/40">Week 2 - The Setup Filter</p>
          </div>
        </div>
        <div className="glass-card-heavy overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <iframe
            src="https://gamma.app/embed/sxabix5y9ovckm9?mode=present"
            className="h-[56vh] min-h-[360px] max-h-[720px] w-full md:h-[72vh] md:min-h-[620px] md:max-h-[900px] lg:h-[78vh]"
            allow="fullscreen; autoplay"
            allowFullScreen
            loading="lazy"
            title="Week 2 - The Setup Filter"
          />
        </div>
        <p className="text-center text-xs text-white/30">
          Use the arrows to navigate slides. Click the expand icon for fullscreen.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">What You&apos;ll Learn</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LEARN_ITEMS.map((item) => (
            <div
              key={item.text}
              className="glass-card-heavy flex items-start gap-3 rounded-xl border border-white/10 p-4"
            >
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={1.5} />
              <span className="text-sm text-white/70">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">A+ Setup Criteria</h2>
        <p className="text-sm text-white/60">
          All seven conditions have to align at the same time. If one gate is red, the setup is not A+.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SETUP_CRITERIA.map((criterion, index) => (
            <article
              key={criterion.title}
              className="glass-card-heavy rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90">{criterion.title}</h3>
                  <p className="mt-1 text-xs text-white/55">{criterion.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Interactive Pre-Trade Checklist Scorer</h2>
        <div className="glass-card-heavy rounded-xl border border-champagne/25 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-champagne">7 Gates Before You Click Buy</p>
              <p className="mt-1 text-sm text-white/55">Toggle each card as the trade earns your capital.</p>
            </div>
            <button
              type="button"
              onClick={resetChecklist}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              Reset
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {checklistCards.map((gate, index) => (
              <button
                key={gate.title}
                type="button"
                aria-pressed={gate.checked}
                onClick={gate.onToggle}
                className={`min-h-11 rounded-xl border p-4 text-left transition-colors ${
                  gate.checked
                    ? 'border-emerald-500/30 bg-emerald-500/[0.08]'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      gate.checked ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/45'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold ${gate.checked ? 'text-emerald-200' : 'text-white/85'}`}>
                        {gate.title}
                      </h3>
                      {gate.checked ? <CheckCircle2 className="h-4 w-4 text-emerald-300" strokeWidth={1.5} /> : null}
                    </div>
                    <p className={`mt-1 text-xs ${gate.checked ? 'text-emerald-100/70' : 'text-white/55'}`}>
                      {gate.prompt}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${checklistVerdict.tone}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest">Checklist Score</p>
                <p className="mt-1 font-mono text-2xl font-bold">
                  {checklistScore}
                  <span className="text-base font-medium text-white/50"> / 7</span>
                </p>
              </div>
              <p className="max-w-sm text-sm font-semibold">{checklistVerdict.label}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Time-of-Day Edge</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {TIME_ZONES.map((zone) => (
            <article
              key={zone.time}
              className={`glass-card-heavy rounded-xl border border-white/10 border-l-4 p-4 ${zone.background} ${zone.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0B]/70">
                  <Clock className={`h-4 w-4 ${zone.accent}`} strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className={`font-mono text-xs ${zone.accent}`}>{zone.time}</div>
                  <h3 className="mt-1 text-sm font-semibold text-white/90">{zone.label}</h3>
                  <p className="mt-1 text-xs text-white/55">{zone.detail}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Before vs. After the Filter</h2>
        <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-red-400">Before the Filter</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-emerald-400">After the Filter</th>
              </tr>
            </thead>
            <tbody>
              {BEFORE_AFTER_ROWS.map((row, index) => (
                <tr key={index} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-white/55">{row.before}</td>
                  <td className="px-4 py-3 font-mono text-white/85">{row.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          {BEFORE_AFTER_ROWS.map((row, index) => (
            <article key={index} className="glass-card-heavy rounded-xl border border-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400">Before the Filter</p>
              <p className="mt-1 font-mono text-sm text-white/55">{row.before}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">After the Filter</p>
              <p className="mt-1 font-mono text-sm text-white/85">{row.after}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Interactive Backtest Calculator</h2>
        <div className="glass-card-heavy rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Run the Filter on Your Own Trade History</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-white/60">
                  Total Trades
                  <input
                    type="number"
                    min={0}
                    value={totalTrades}
                    onChange={(event) => setTotalTrades(Number(event.target.value))}
                    className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0A0A0B]/70 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Trades That Pass Filter
                  <input
                    type="number"
                    min={0}
                    value={filteredTrades}
                    onChange={(event) => setFilteredTrades(Number(event.target.value))}
                    className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0A0A0B]/70 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Filtered P&amp;L ($)
                  <input
                    type="number"
                    value={filteredPnl}
                    onChange={(event) => setFilteredPnl(Number(event.target.value))}
                    className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0A0A0B]/70 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  Unfiltered P&amp;L ($)
                  <input
                    type="number"
                    value={unfilteredPnl}
                    onChange={(event) => setUnfilteredPnl(Number(event.target.value))}
                    className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-[#0A0A0B]/70 px-3 py-2 font-mono text-sm text-white"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-white/45">
                Filtered trades are clamped to your total trade count so the calculator always stays realistic.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-[#0A0A0B]/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/40">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                  Projected Monthly P&amp;L
                </div>
                <p
                  className={`mt-2 font-mono text-3xl font-bold ${
                    backtest.projectedMonthlyPnl >= 0 ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {toMoney(backtest.projectedMonthlyPnl)}
                </p>
                <p className="mt-1 text-xs text-white/45">If you only take the trades that pass your filter.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Filter Rate</p>
                  <p className="mt-1 font-mono text-lg text-champagne">{formatPercent(backtest.filterRate)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Unfiltered Trades</p>
                  <p className="mt-1 font-mono text-lg text-white/80">{backtest.unfilteredTrades}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">P&amp;L / Filtered Trade</p>
                  <p
                    className={`mt-1 font-mono text-sm ${
                      (backtest.filteredPnlPerTrade ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {formatMoneyPerTrade(backtest.filteredPnlPerTrade)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">P&amp;L / Unfiltered Trade</p>
                  <p
                    className={`mt-1 font-mono text-sm ${
                      (backtest.unfilteredPnlPerTrade ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {formatMoneyPerTrade(backtest.unfilteredPnlPerTrade)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Knowledge Check</h2>
        <div className="space-y-4">
          {QUIZ.map((item, questionIndex) => {
            const selectedAnswer = quizAnswers[questionIndex]
            const hasAnswered = Number.isInteger(selectedAnswer)
            const isCorrect = selectedAnswer === item.correct

            return (
              <article key={questionIndex} className="glass-card-heavy rounded-xl border border-white/10 p-5">
                <p className="text-sm font-medium text-white/85">
                  <span className="mr-2 font-mono text-xs text-emerald-400">Q{questionIndex + 1}</span>
                  {item.q}
                </p>
                <div className="mt-3 grid gap-2">
                  {item.options.map((option, optionIndex) => {
                    const selected = selectedAnswer === optionIndex
                    const shouldHighlightCorrect = hasAnswered && optionIndex === item.correct
                    const shouldHighlightIncorrect = selected && !isCorrect

                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        onClick={() => handleQuizSelect(questionIndex, optionIndex)}
                        className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          shouldHighlightCorrect
                            ? 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300'
                            : shouldHighlightIncorrect
                              ? 'border-red-500/35 bg-red-500/12 text-red-300'
                              : selected
                                ? 'border-white/30 bg-white/10 text-white/90'
                                : 'border-white/10 bg-white/[0.02] text-white/60 hover:bg-white/[0.05]'
                        }`}
                      >
                        <CircleDot className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        {option}
                      </button>
                    )
                  })}
                </div>
                {hasAnswered ? (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
                    <p className={`font-semibold ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
                      {isCorrect ? 'Correct.' : 'Not quite.'}
                    </p>
                    <p className="mt-1 text-white/60">{item.explanation}</p>
                    {isCorrect ? <CheckCircle2 className="mt-2 h-4 w-4 text-emerald-300" strokeWidth={1.5} /> : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Your Week 2 Assignment</h2>
        <div className="glass-card-heavy space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">
          {ASSIGNMENT_TASKS.map((task, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                {index + 1}
              </div>
              <span className="text-sm text-white/70">{task}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/members/mentorship/week-2/checklist-guide"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <ListChecks className="h-4 w-4" strokeWidth={1.5} />
            Open Checklist Guide
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
          <Link
            href="/members/journal"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Open Trade Journal
          </Link>
        </div>
      </section>

      <section className="glass-card-heavy rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Week 2 Outcome</h3>
        <p className="mt-3 font-[family-name:var(--font-playfair)] text-lg">
          You become <span className="text-emerald-400">selective with your setups</span>.
        </p>
        <p className="mt-2 text-sm italic text-white/40">
          &ldquo;You don&apos;t need more setups. You need a filter that kills bad ones before they kill your account.&rdquo;
        </p>
      </section>
    </div>
  )
}
