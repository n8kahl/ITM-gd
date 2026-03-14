'use client'

import { type ReactNode, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Clock,
  Crosshair,
  Filter,
  ListChecks,
  Target,
  TrendingUp,
} from 'lucide-react'

import { Analytics } from '@/lib/analytics'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'timing', label: 'Timing' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'finish', label: 'Finish' },
] as const

const OVERVIEW_CARDS = [
  {
    icon: CheckSquare,
    title: 'Copy the 7-point checklist',
    description: 'Nothing gets your capital unless every gate is green before entry.',
  },
  {
    icon: ListChecks,
    title: 'Build a focused watchlist',
    description: 'Use the 3-tier framework so you trade familiar symbols instead of noise.',
  },
  {
    icon: Clock,
    title: 'Respect time-of-day edge',
    description: 'Trade the windows with real volume and sit out the midday chop.',
  },
  {
    icon: BarChart3,
    title: 'Backtest the filter',
    description: 'Run the last 20 trades through the checklist and see what it would have cut.',
  },
] as const

const CHECKLIST_GATES = [
  {
    gate: 'Market Trend',
    description: 'Is SPX or QQQ aligned with your trade direction, or neutral for a range play?',
  },
  {
    gate: 'Key Level',
    description: 'Is price interacting with support, resistance, VWAP, or a moving average level?',
  },
  {
    gate: 'Volume',
    description: 'Is current volume confirming the move instead of leaving it thin and low conviction?',
  },
  {
    gate: 'Time of Day',
    description: 'Is the setup happening during the opening drive or power hour instead of the chop zone?',
  },
  {
    gate: 'R:R Defined',
    description: 'Do you have at least 1:2 reward-to-risk with the stop and target defined before entry?',
  },
  {
    gate: 'Emotional State',
    description: 'Are you calm, focused, and free from revenge, panic, or FOMO pressure?',
  },
  {
    gate: 'Position Size',
    description: 'Is your risk at or below 2% of the account and still inside your daily loss limit?',
  },
] as const

const WATCHLIST_TIERS = [
  {
    tier: 'Tier 1 - Core',
    count: '3-5 symbols',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20 bg-emerald-500/[0.05]',
    bullets: [
      'High liquidity and tight options spreads',
      'Symbols you know well enough to recognize clean behavior quickly',
      'Examples: SPX, SPY, QQQ, AAPL, TSLA, NVDA',
    ],
  },
  {
    tier: 'Tier 2 - Rotation',
    count: '2-3 symbols',
    accent: 'text-champagne',
    border: 'border-champagne/20 bg-champagne/5',
    bullets: [
      'Sector leaders tied to the current market narrative',
      'Rotate these weekly as leadership changes',
      'Examples: MSFT, META, XLE, CVX depending on what is in play',
    ],
  },
  {
    tier: 'Tier 3 - Catalyst',
    count: '1-2 symbols',
    accent: 'text-red-400',
    border: 'border-red-500/20 bg-red-500/[0.05]',
    bullets: [
      'Only add these when a specific event is approaching',
      'Examples: earnings, FOMC, CPI, or other scheduled catalysts',
      'Higher risk and removed as soon as the event passes',
    ],
  },
] as const

const TIME_WINDOWS = [
  {
    time: '9:30-10:00 AM ET',
    label: 'The Opening Drive',
    description: 'Highest volume and volatility. Best for momentum and gap continuation.',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/35',
    background: 'bg-emerald-500/[0.05]',
  },
  {
    time: '10:00-11:30 AM ET',
    label: 'The Reversal Zone',
    description: 'Opening moves often consolidate or fade here. Patience matters.',
    accent: 'text-champagne',
    border: 'border-champagne/35',
    background: 'bg-champagne/5',
  },
  {
    time: '11:30 AM-2:00 PM ET',
    label: 'The Chop Zone',
    description: 'Low volume and directionless noise. Review, do not force trades.',
    accent: 'text-red-400',
    border: 'border-red-500/35',
    background: 'bg-red-500/[0.05]',
  },
  {
    time: '3:00-4:00 PM ET',
    label: 'Power Hour',
    description: 'Second volume surge. Good for trend confirmation and closing range moves.',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/35',
    background: 'bg-emerald-500/[0.05]',
  },
] as const

const BACKTEST_STEPS = [
  'Open the 20 trades you logged in Week 1.',
  'Run each trade through all 7 checklist gates.',
  'Score every trade from 0/7 to 7/7.',
  'Calculate what percentage would have been filtered out.',
  'Compare filtered P&L versus unfiltered P&L and look for the leak.',
] as const

const COMPLETION_ITEMS = [
  'Copy the 7-point checklist into your own notes or print version.',
  'Commit to no trade without 7 out of 7 gates green.',
  'Choose 3-5 Tier 1 core symbols.',
  'Choose 2-3 Tier 2 rotation symbols.',
  'Add 1-2 Tier 3 catalyst symbols only if an event is near.',
  'Write two key levels for every symbol on the list.',
  'Score your last 20 trades against the filter.',
  'Calculate filtered versus unfiltered P&L.',
  'Identify three A+ setups this week, even if paper only.',
  'Bring your checklist, watchlist, and backtest results to the group call.',
] as const

function Callout({
  tone,
  children,
}: {
  tone: 'emerald' | 'champagne' | 'red'
  children: ReactNode
}) {
  const styles = {
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200',
    champagne: 'border-champagne/20 bg-champagne/10 text-champagne',
    red: 'border-red-500/20 bg-red-500/[0.06] text-red-200',
  }

  return <div className={`rounded-xl border p-4 text-sm ${styles[tone]}`}>{children}</div>
}

export default function Week2ChecklistGuidePage() {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  const toggleCheck = (index: number) => {
    setCheckedItems((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    void Analytics.trackAcademyAction('mentorship_week2_checklist_toggle')
  }

  const resetChecks = () => setCheckedItems(new Set())

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8 text-center md:p-10">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            Week 2 - Sniper Mentorship
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold md:text-3xl">
            Your <span className="text-emerald-400">Checklist Guide</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/50">
            Build the actual filter you will use before every trade: the 7 gates, the watchlist tiers,
            the time windows, and the backtest process that proves whether your edge is real.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/members/mentorship/week-2"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.5} />
              Back to Week 2 Lesson
            </Link>
            <Link
              href="/members/journal"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              Open Trade Journal
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>

      <div className="sticky top-[var(--members-topbar-h)] z-40 lg:top-0">
        <div className="rounded-xl border border-white/10 bg-[#0A0A0B]/90 px-3 py-2 backdrop-blur-xl">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="min-h-11 shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <section id="overview" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">01 - OVERVIEW</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">What This Guide Helps You Build</h2>
        <p className="text-sm text-white/50">
          Week 1 exposed the leak. Week 2 installs the gate that stops the bad trades before they
          happen.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OVERVIEW_CARDS.map((card) => (
            <div key={card.title} className="glass-card-heavy rounded-xl border border-white/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <card.icon className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                <h3 className="text-sm font-semibold">{card.title}</h3>
              </div>
              <p className="text-xs text-white/50">{card.description}</p>
            </div>
          ))}
        </div>
        <Callout tone="emerald">
          <strong>The bridge from Week 1:</strong> Audit - Filter - Execution. You already found the
          problem. Now you remove it from your process.
        </Callout>
      </section>

      <section id="checklist" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">02 - CHECKLIST</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">The 7-Gate Pre-Trade Checklist</h2>
        <p className="text-sm text-white/50">
          This is your pre-flight check. Six out of seven is not A+. If one gate is red, the trade
          does not go through.
        </p>

        <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Gate</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">What You Confirm</th>
              </tr>
            </thead>
            <tbody>
              {CHECKLIST_GATES.map((item, index) => (
                <tr key={item.gate} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-white/85">
                    {index + 1}. {item.gate}
                  </td>
                  <td className="px-4 py-3 text-white/55">{item.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:hidden">
          {CHECKLIST_GATES.map((item, index) => (
            <article key={item.gate} className="glass-card-heavy rounded-xl border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                  {index + 1}
                </div>
                <h3 className="text-sm font-semibold">{item.gate}</h3>
              </div>
              <p className="mt-2 text-xs text-white/55">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="glass-card-heavy rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">7 / 7</p>
            <p className="mt-2 text-sm font-semibold text-emerald-200">A+ setup - execute</p>
          </div>
          <div className="glass-card-heavy rounded-xl border border-champagne/20 bg-champagne/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-champagne">5-6 / 7</p>
            <p className="mt-2 text-sm font-semibold text-champagne">B setup - skip or paper trade only</p>
          </div>
          <div className="glass-card-heavy rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Below 5 / 7</p>
            <p className="mt-2 text-sm font-semibold text-red-200">No trade - walk away</p>
          </div>
        </div>

        <Callout tone="champagne">
          <strong>Print this.</strong> Tape it next to your screen, save it as a wallpaper, or keep it
          inside your journal notes. The checklist is only useful if it is visible before entry.
        </Callout>
      </section>

      <section id="watchlist" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">03 - WATCHLIST</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Build a Watchlist You Can Actually Master</h2>
        <p className="text-sm text-white/50">
          You do not need 500 symbols. You need 5-10 names you know well enough to trust when they
          start to set up.
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {WATCHLIST_TIERS.map((tier) => (
            <article key={tier.tier} className={`glass-card-heavy rounded-xl border p-4 ${tier.border}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-semibold ${tier.accent}`}>{tier.tier}</h3>
                <span className="font-mono text-xs text-white/45">{tier.count}</span>
              </div>
              <div className="mt-3 space-y-2 text-xs text-white/60">
                {tier.bullets.map((bullet) => (
                  <p key={bullet}>{bullet}</p>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold">Simple Watchlist Template</h3>
          </div>
          <div className="grid gap-2 text-xs text-white/55">
            {['Symbol', 'Tier', 'Why It Is Here', 'Key Level 1', 'Key Level 2'].map((label, index) => (
              <div key={label} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 md:grid-cols-[48px_1fr_1fr_1fr_1fr]">
                <div className="font-mono text-white/35">{index + 1}</div>
                <div>{label}</div>
                <div className="hidden md:block">{index === 0 ? 'Tier' : '-'}</div>
                <div className="hidden md:block">{index === 0 ? 'Reason' : '-'}</div>
                <div className="hidden md:block">{index === 0 ? 'Support' : '-'}</div>
                <div className="hidden md:block">{index === 0 ? 'Resistance' : '-'}</div>
              </div>
            ))}
          </div>
        </div>

        <Callout tone="emerald">
          <strong>Rule:</strong> If you cannot explain in one sentence why a ticker belongs on the
          list, it does not belong on the list.
        </Callout>
      </section>

      <section id="timing" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">04 - TIMING</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Time of Day Is Part of the Setup</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {TIME_WINDOWS.map((window) => (
            <article
              key={window.time}
              className={`glass-card-heavy rounded-xl border border-white/10 border-l-4 p-4 ${window.border} ${window.background}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0B]/70">
                  <Clock className={`h-4 w-4 ${window.accent}`} strokeWidth={1.5} />
                </div>
                <div>
                  <div className={`font-mono text-xs ${window.accent}`}>{window.time}</div>
                  <h3 className="mt-1 text-sm font-semibold text-white/90">{window.label}</h3>
                  <p className="mt-1 text-xs text-white/55">{window.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Callout tone="red">
          <strong>Hard stop:</strong> If it is lunchtime and you are about to force a setup, step away
          and wait for power hour instead.
        </Callout>
      </section>

      <section id="backtest" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">05 - BACKTEST</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Backtest the Filter Against Week 1</h2>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold">Backtest Process</h3>
            </div>
            <div className="space-y-3">
              {BACKTEST_STEPS.map((step, index) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                    {index + 1}
                  </div>
                  <p className="text-sm text-white/60">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card-heavy rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold">What You Need to Calculate</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-[#0A0A0B]/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Filter Rate</p>
                <p className="mt-1 font-mono text-sm text-champagne">(Filtered Trades / Total Trades) x 100</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0A0A0B]/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Filtered P&amp;L</p>
                <p className="mt-1 font-mono text-sm text-emerald-300">Sum only the 7/7 trades</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0A0A0B]/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Unfiltered P&amp;L</p>
                <p className="mt-1 font-mono text-sm text-red-300">Everything the filter would have blocked</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#0A0A0B]/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">The Insight</p>
                <p className="mt-1 text-sm text-white/60">The filter does not create winners. It removes losers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="finish" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">06 - FINISH</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Week 2 Completion Checklist</h2>
        <p className="text-sm text-white/50">
          Check items off as you finish them. This stays in memory only for the current session.
        </p>

        <div className="glass-card-heavy rounded-xl border border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/55">
                <span className="font-mono text-emerald-400">{checkedItems.size}</span> of {COMPLETION_ITEMS.length} complete
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-300"
                  style={{ width: `${(checkedItems.size / COMPLETION_ITEMS.length) * 100}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetChecks}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 space-y-1">
            {COMPLETION_ITEMS.map((item, index) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleCheck(index)}
                className={`flex min-h-11 w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                  checkedItems.has(index)
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-white/45 line-through'
                    : 'border-white/10 bg-transparent text-white/75 hover:bg-white/[0.02]'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    checkedItems.has(index) ? 'border-emerald-500 bg-emerald-500' : 'border-white/20'
                  }`}
                >
                  {checkedItems.has(index) ? (
                    <CheckCircle2 className="h-3 w-3 text-black" strokeWidth={1.5} />
                  ) : null}
                </div>
                <span>{item}</span>
              </button>
            ))}
          </div>
        </div>

        <Callout tone="champagne">
          <strong>Bring to the call:</strong> your finished checklist, your watchlist with key levels,
          and the numbers that show what the filter would have saved you.
        </Callout>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/members/mentorship/week-2"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Crosshair className="h-4 w-4" strokeWidth={1.5} />
            Back to Week 2 Lesson
          </Link>
          <Link
            href="/members/journal"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Open Trade Journal
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </div>
      </section>
    </div>
  )
}
