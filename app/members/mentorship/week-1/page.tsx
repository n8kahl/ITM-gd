'use client'

import Link from 'next/link'
import { BookOpen, Calculator, CheckCircle2, AlertTriangle, Target, TrendingDown, ArrowRight } from 'lucide-react'

/* ─── Drawdown Recovery Table ─── */
const DRAWDOWN_DATA = [
  { drawdown: '10%', recovery: '11.1%' },
  { drawdown: '20%', recovery: '25.0%' },
  { drawdown: '30%', recovery: '42.9%' },
  { drawdown: '50%', recovery: '100.0%' },
  { drawdown: '75%', recovery: '300.0%' },
]

/* ─── Gambler vs Sniper comparison ─── */
const COMPARISON = [
  { gambler: 'Trades on impulse and emotion', sniper: 'Trades from a pre-built plan' },
  { gambler: 'Chases every move', sniper: 'Waits for A+ setups only' },
  { gambler: 'No stop-loss, hopes for recovery', sniper: 'Hard stop on every trade' },
  { gambler: 'Measures success by P&L today', sniper: 'Measures by process over 30 days' },
  { gambler: 'Random position sizing', sniper: 'Fixed 1-2% risk per trade' },
  { gambler: 'Blames the market', sniper: 'Reviews and adjusts behavior' },
]

/* ─── R:R Table ─── */
const RR_DATA = [
  { ratio: '1:1', risk: '$100', reward: '$100', note: 'Need >50% win rate' },
  { ratio: '1:2', risk: '$100', reward: '$200', note: 'Profitable at 40%+' },
  { ratio: '1:3', risk: '$100', reward: '$300', note: 'Profitable at 30%+' },
  { ratio: '1:0.5', risk: '$200', reward: '$100', note: 'Need 70%+ to survive' },
]

/* ─── Quiz Questions ─── */
const QUIZ: { q: string; options: string[]; correct: number; explanation: string }[] = [
  {
    q: 'A trader has a 75% win rate with $80 avg win and $350 avg loss. Profitable?',
    options: ['Yes — 75% is excellent', 'No — losses are too large', 'Can\'t tell'],
    correct: 1,
    explanation: 'EV = (0.75 × $80) - (0.25 × $350) = $60 - $87.50 = -$27.50 per trade. Losing money despite 75% wins.',
  },
  {
    q: '$25,000 account. Using 2% rule, max risk per trade?',
    options: ['$2,500', '$500', '$1,250', '$250'],
    correct: 1,
    explanation: '2% of $25,000 = $500. This is max risk, not position size.',
  },
  {
    q: 'Account drops 30%. How much to get back to breakeven?',
    options: ['30%', '42.9%', '50%', '60%'],
    correct: 1,
    explanation: '$10K loses 30% → $7K. Need $3K gain = 42.9% of $7K.',
  },
  {
    q: '5 trades: 3 planned, 1 FOMO, 1 revenge. What % emotional?',
    options: ['20%', '40%', '60%'],
    correct: 1,
    explanation: 'FOMO + Revenge = 2 emotional trades. 2/5 = 40%.',
  },
  {
    q: 'What matters most for long-term profitability?',
    options: ['Highest win rate', 'Positive Expected Value', 'Most trades', 'Never losing'],
    correct: 1,
    explanation: 'Positive EV means your system makes money over time regardless of short-term variance.',
  },
]

export default function Week1Page() {
  return (
    <div className="space-y-8">
      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8 md:p-10">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            Week 1 of 8
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold md:text-3xl">
            The Trader Identity Reset
          </h1>
          <p className="mt-2 text-lg italic text-white/50">
            &ldquo;You are not a gambler. You are a risk manager.&rdquo;
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/members/mentorship/week-1/journal-guide"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              <BookOpen className="h-4 w-4" />
              Open Journal Guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/members/journal"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
            >
              Go to Trade Journal
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Learning Objectives ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">What You&apos;ll Learn</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Target, text: 'The difference between gambling and structured trading' },
            { icon: AlertTriangle, text: 'Why most traders lose: overtrading, revenge trading, no risk plan' },
            { icon: Calculator, text: 'How win rate actually works and expected value (EV)' },
            { icon: TrendingDown, text: 'Risk-to-reward math and drawdown recovery' },
          ].map((item) => (
            <div key={item.text} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-sm text-white/70">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Gambler vs Sniper ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Gambler vs. Sniper Trader</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-red-400">Gambler</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Sniper Trader</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white/50">{row.gambler}</td>
                  <td className="px-4 py-3 text-white/80">{row.sniper}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Win Rate Lesson ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Win Rate Is a Lie (Without Context)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">Scenario A — 80% Win Rate, Still Losing</div>
            <div className="space-y-1 font-mono text-sm text-white/70">
              <p>Win rate: 80% &bull; Avg win: $50 &bull; Avg loss: $300</p>
              <p>10 trades: (8 &times; $50) - (2 &times; $300)</p>
              <p className="text-lg font-bold text-red-400">= -$200</p>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">Scenario B — 50% Win Rate, Profitable</div>
            <div className="space-y-1 font-mono text-sm text-white/70">
              <p>Win rate: 50% &bull; Avg win: $400 &bull; Avg loss: $150</p>
              <p>10 trades: (5 &times; $400) - (5 &times; $150)</p>
              <p className="text-lg font-bold text-emerald-400">= +$1,250</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">The Key Formula</div>
          <div className="mt-2 font-mono text-lg text-emerald-400">
            EV = (Win Rate &times; Avg Win) - (Loss Rate &times; Avg Loss)
          </div>
          <p className="mt-2 text-xs text-white/50">If EV is positive, your system makes money over time.</p>
        </div>
      </section>

      {/* ─── R:R Framework ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Risk-to-Reward Framework</h2>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">R:R</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">You Risk</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">To Make</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-white/40">Min Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {RR_DATA.map((row) => (
                <tr key={row.ratio} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-emerald-400">{row.ratio}</td>
                  <td className="px-4 py-3 font-mono text-red-400">{row.risk}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">{row.reward}</td>
                  <td className="px-4 py-3 text-white/50">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Drawdown Table ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Why Capital Preservation Comes First</h2>
        <p className="text-sm text-white/60">
          A 50% drawdown requires a 100% gain to recover. Small losses are recoverable. Big ones end careers.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-red-400">Drawdown</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Gain to Recover</th>
              </tr>
            </thead>
            <tbody>
              {DRAWDOWN_DATA.map((row) => (
                <tr key={row.drawdown} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono font-semibold text-red-400">-{row.drawdown}</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">+{row.recovery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">The 1-2% Rule</div>
            <p className="mt-1 text-xs text-white/50">Never risk more than 1-2% of your total account on a single trade.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Daily Loss Limit</div>
            <p className="mt-1 text-xs text-white/50">Set 3-5% max daily loss. When you hit it, you&apos;re done for the day.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Selectivity &gt; Volume</div>
            <p className="mt-1 text-xs text-white/50">Our 81% win rate comes from only taking trades that meet strict criteria.</p>
          </div>
        </div>
      </section>

      {/* ─── Knowledge Test ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Knowledge Check</h2>
        <div className="space-y-4">
          {QUIZ.map((item, qi) => (
            <details key={qi} className="group rounded-xl border border-white/10 bg-white/[0.03]">
              <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-white/80 [&::-webkit-details-marker]:hidden">
                <span className="mr-2 font-mono text-xs text-emerald-400">Q{qi + 1}</span>
                {item.q}
              </summary>
              <div className="border-t border-white/5 px-5 py-4">
                <div className="mb-3 space-y-1.5">
                  {item.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        oi === item.correct
                          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border border-white/5 bg-white/[0.02] text-white/40'
                      }`}
                    >
                      {oi === item.correct && <CheckCircle2 className="mr-1.5 inline h-3 w-3" />}
                      {opt}
                    </div>
                  ))}
                </div>
                <p className="text-xs italic text-white/40">{item.explanation}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Assignment ─── */}
      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Your Week 1 Assignment</h2>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 space-y-4">
          {[
            'Set up TradingView with your preferred chart layout',
            'Log into your Trade Journal and enter your last 20 trades',
            'Tag each trade: planned, emotional, fomo, or revenge',
            'Fill in Mood Before, Mood After, and Discipline Score for each trade',
            'Calculate your actual win rate, avg win, avg loss, and R:R',
            'Calculate your Expected Value using the EV formula',
            'Define max risk per trade (1-2% of account)',
            'Define max daily loss limit (3-5% of account)',
            'Review your Analytics dashboard for bias detection insights',
            'Bring your numbers to the Week 1 group call',
          ].map((task, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                {i + 1}
              </div>
              <span className="text-sm text-white/70">{task}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/members/mentorship/week-1/journal-guide"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <BookOpen className="h-4 w-4" />
            Step-by-Step Journal Guide
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/members/journal"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Open Trade Journal
          </Link>
        </div>
      </section>

      {/* ─── Outcome ─── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Week 1 Outcome</h3>
        <p className="mt-3 font-[family-name:var(--font-playfair)] text-lg">
          You become <span className="text-emerald-400">aware of your flaws</span>.
        </p>
        <p className="mt-2 text-sm italic text-white/40">
          &ldquo;You don&apos;t need more trades. You need better filters.&rdquo;
        </p>
      </section>
    </div>
  )
}
