'use client'

import Link from 'next/link'
import {
  BarChart3,
  BookOpen,
  Brain,
  CheckSquare,
  ClipboardList,
  Crosshair,
  PhoneCall,
  Shield,
  Target,
  TestTube2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'

const WEEKS = [
  {
    week: 1,
    title: 'The Trader Identity Reset',
    theme: 'You are not a gambler. You are a risk manager.',
    icon: Target,
    href: '/members/mentorship/week-1',
    active: true,
    topics: ['Gambling vs. Structured Trading', 'Win Rate Math & Expected Value', 'Risk-to-Reward', 'Capital Preservation'],
  },
  {
    week: 2,
    title: 'The Setup Filter',
    theme: 'How to build a checklist that eliminates 80% of bad trades.',
    icon: Crosshair,
    href: '/members/mentorship/week-2',
    active: true,
    topics: ['A+ Setup Criteria', 'Entry Checklists', 'Watchlist Construction', 'Filter Discipline'],
  },
  {
    week: 3,
    title: 'Risk Management Mastery',
    theme: 'Position sizing is the only edge you fully control.',
    icon: Shield,
    href: '/members/mentorship/week-3',
    active: false,
    topics: ['Position Sizing Models', 'Stop-Loss Strategy', 'Portfolio Heat', 'Kelly Criterion'],
  },
  {
    week: 4,
    title: 'Reading the Tape',
    theme: 'Price action tells you everything if you know how to listen.',
    icon: BarChart3,
    href: '/members/mentorship/week-4',
    active: false,
    topics: ['Support & Resistance', 'Volume Analysis', 'Order Flow Basics', 'Key Levels'],
  },
  {
    week: 5,
    title: 'Options Mechanics',
    theme: 'Understand the Greeks or they will eat your premium.',
    icon: Brain,
    href: '/members/mentorship/week-5',
    active: false,
    topics: ['Delta & Gamma', 'Theta Decay', 'IV Crush', 'Spread Construction'],
  },
  {
    week: 6,
    title: 'Execution & Timing',
    theme: 'The right trade at the wrong time is the wrong trade.',
    icon: TrendingUp,
    href: '/members/mentorship/week-6',
    active: false,
    topics: ['Entry Timing', 'Scaling In/Out', 'Partial Profits', 'Time-of-Day Edge'],
  },
  {
    week: 7,
    title: 'Psychology & Discipline',
    theme: 'Your edge means nothing if you can\'t execute it consistently.',
    icon: BookOpen,
    href: '/members/mentorship/week-7',
    active: false,
    topics: ['Emotional Control', 'Tilt Management', 'Process Over Outcome', 'Daily Routine'],
  },
  {
    week: 8,
    title: 'The Sniper System',
    theme: 'Putting it all together into your personal trading playbook.',
    icon: Users,
    href: '/members/mentorship/week-8',
    active: false,
    topics: ['Personal Playbook', 'Trade Plan Template', 'Accountability System', 'Graduation Review'],
  },
]

export default function MentorshipPage() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8 md:p-12">
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <Crosshair className="h-3.5 w-3.5" />
            8-Week Sniper Mentorship
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold md:text-4xl">
            Trade In The Money
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/60">
            Stop emotional losses. Build structured discipline. Develop repeatable high-probability setups.
            Improve your win rate and risk control. Build sniper confidence.
          </p>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      {/* Program Objectives */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Stop Emotional Losses', value: 'Discipline' },
          { label: 'Build Structure', value: 'Process' },
          { label: 'Repeatable Setups', value: 'Edge' },
          { label: 'Sniper Confidence', value: 'Mindset' },
        ].map((obj) => (
            <div
              key={obj.label}
              className="glass-card-heavy rounded-xl border border-white/10 p-4 text-center"
            >
            <div className="font-mono text-lg font-bold text-emerald-400">{obj.value}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/40">{obj.label}</div>
          </div>
        ))}
      </div>

      {/* Week Cards */}
      <div className="space-y-3">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Program Schedule</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {WEEKS.map((w) => {
            const Icon = w.icon
            return (
              <div
                key={w.week}
                className={`group relative rounded-xl border p-5 transition-all ${
                  w.active
                    ? 'border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-500/50'
                    : 'border-white/10 bg-white/[0.03] opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      w.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/30'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/40">WEEK {w.week}</span>
                      {w.active && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          Active
                        </span>
                      )}
                      {!w.active && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                          Locked
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold">{w.title}</h3>
                    <p className="mt-1 text-xs italic text-white/40">&ldquo;{w.theme}&rdquo;</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {w.topics.map((t) => (
                        <span
                          key={t}
                          className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {w.active && (
                      <Link
                        href={w.href}
                        className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
                      >
                        Start Week {w.week}
                        <span aria-hidden="true">&rarr;</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Each Week Includes */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">Each Week Includes</h3>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          {[
            { icon: BookOpen, label: 'Core Lesson' },
            { icon: ClipboardList, label: 'Assignment' },
            { icon: TestTube2, label: 'Knowledge Test' },
            { icon: PhoneCall, label: '1hr Group Call' },
            { icon: Trophy, label: 'Outcome Target' },
          ].map((item) => (
            <div key={item.label} className="glass-card-heavy flex min-h-11 items-center gap-3 rounded-xl border border-white/10 p-3 text-sm text-white/70">
              <item.icon className="h-4 w-4 text-emerald-300" />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
