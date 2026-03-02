'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronRight, ArrowRight,
  Upload, Camera, Plus, Filter, BarChart3, Target, Brain,
  AlertTriangle, TrendingDown, Eye,
} from 'lucide-react'

import { Analytics } from '@/lib/analytics'

/* ─── Section data ─── */
const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'navigate', label: 'Navigate' },
  { id: 'new-entry', label: 'New Entry' },
  { id: 'full-form', label: 'Full Form' },
  { id: 'categorize', label: 'Categorize' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'calculate', label: 'Calculate' },
  { id: 'checklist', label: 'Checklist' },
]

const MOODS = ['Confident', 'Neutral', 'Anxious', 'Frustrated', 'Excited', 'Fearful'] as const
const MOOD_EMOJI: Record<string, string> = {
  Confident: '\uD83D\uDCAA',
  Neutral: '\uD83D\uDE10',
  Anxious: '\uD83D\uDE30',
  Frustrated: '\uD83D\uDE24',
  Excited: '\uD83E\uDD29',
  Fearful: '\uD83D\uDE28',
}

const TRADE_CATEGORIES = [
  { tag: 'planned', label: 'Planned', color: 'emerald', icon: Target, desc: 'Identified on watchlist. Entry criteria met. Stop-loss set before entry.' },
  { tag: 'emotional', label: 'Emotional', color: 'red', icon: Brain, desc: 'Entered based on fear, anxiety, or excitement. No pre-defined setup.' },
  { tag: 'fomo', label: 'FOMO', color: 'amber', icon: Eye, desc: 'Chased a move already in progress. Entered late to avoid missing out.' },
  { tag: 'revenge', label: 'Revenge', color: 'red', icon: AlertTriangle, desc: 'Entered immediately after a loss to recover. Sized up. Broke rules.' },
]

const SAMPLE_TRADES = [
  { date: 'Feb 28', symbol: 'SPY', dir: 'Long', entry: '$3.45', exit: '$2.10', pnl: '-$675', pnlColor: 'text-red-400', tag: 'emotional', tagColor: 'bg-red-500/10 text-red-400 border-red-500/20', winner: false },
  { date: 'Feb 27', symbol: 'QQQ', dir: 'Short', entry: '$5.20', exit: '$7.80', pnl: '+$520', pnlColor: 'text-emerald-400', tag: 'planned', tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', winner: true },
  { date: 'Feb 27', symbol: 'NVDA', dir: 'Long', entry: '$12.30', exit: '$9.45', pnl: '-$570', pnlColor: 'text-red-400', tag: 'fomo', tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20', winner: false },
  { date: 'Feb 27', symbol: 'TSLA', dir: 'Long', entry: '$8.90', exit: '$4.20', pnl: '-$940', pnlColor: 'text-red-400', tag: 'revenge', tagColor: 'bg-red-500/10 text-red-400 border-red-500/20', winner: false },
  { date: 'Feb 26', symbol: 'SPX', dir: 'Long', entry: '$4.50', exit: '$8.10', pnl: '+$720', pnlColor: 'text-emerald-400', tag: 'planned', tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', winner: true },
]

const CHECKLIST_ITEMS = [
  'Log into the Trade Journal at /members/journal',
  'Click + New Entry and log all 20 of your most recent trades',
  'For each trade, fill in: symbol, direction, entry price, exit price, P&L',
  'Switch to Full Form and fill in Behavioral & Psychology for every trade',
  'Tag each trade: planned, emotional, fomo, or revenge',
  'Record mood before and after each trade',
  'Rate your discipline (1-5) and whether you followed your plan',
  'Click the Analytics tab and review Win Rate, P&L, and Expectancy',
  'Calculate your R:R ratio (avg win / avg loss)',
  'Calculate your emotional trade percentage',
  'Define max risk per trade (1-2% of account)',
  'Define max daily loss limit (3-5% of account)',
  'Filter by "planned" tag and compare P&L against emotional trades',
  'Check Bias Detection for flagged behavioral patterns',
  'Prepare your numbers for the Week 1 group call',
]

const CHECKLIST_STORAGE_KEY = 'mentorship_week1_checklist_v1'

/* ─── Sub-components ─── */
function MockBrowser({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
        <div className="flex-1 text-center font-mono text-[10px] text-white/30">{url}</div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Callout({ type, children }: { type: 'tip' | 'warning' | 'critical'; children: React.ReactNode }) {
  const styles = {
    tip: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300',
    warning: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-300',
    critical: 'border-red-500/20 bg-red-500/[0.06] text-red-300',
  }
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}

function MockField({ label, value, placeholder, error }: { label: string; value?: string; placeholder?: string; error?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</label>
      <div className={`rounded-md border px-3 py-2 font-mono text-xs ${error ? 'border-red-500/30 text-red-400/60' : 'border-white/10 text-white/60'} bg-white/[0.03]`}>
        {value || <span className="text-white/20">{placeholder || '—'}</span>}
      </div>
    </div>
  )
}

/* ─── Main Component ─── */
export default function JournalGuidePage() {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY)
      if (!raw) return new Set()
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return new Set()
      const validItems = parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value < CHECKLIST_ITEMS.length)
      return new Set(validItems)
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(Array.from(checkedItems)))
    } catch {
      // Ignore local storage write failures.
    }
  }, [checkedItems])

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
    void Analytics.trackAcademyAction('mentorship_week1_checklist_toggle')
  }

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-10">
      {/* ─── Hero ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8 text-center md:p-10">
        <div className="relative z-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
            Week 1 &mdash; Sniper Mentorship
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-bold md:text-3xl">
            Your <span className="text-emerald-400">Trade Journal</span> Walkthrough
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/50">
            A step-by-step guide to completing your Week 1 assignment &mdash; the 20-trade audit, trade categorization, and setting your risk foundation.
          </p>
        </div>
      </div>

      {/* ─── Section Nav ─── */}
      <div className="sticky top-[var(--members-topbar-h)] z-40 lg:top-0">
        <div className="rounded-xl border border-white/10 bg-[#0A0A0B]/90 px-3 py-2 backdrop-blur-xl">
          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="min-h-11 shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: OVERVIEW
      ════════════════════════════════════════════════════════════════ */}
      <section id="overview" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">01 &mdash; OVERVIEW</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">What You&apos;ll Do in the Trade Journal</h2>
        <p className="text-sm text-white/50">Your Week 1 assignment requires four things. The Trade Journal handles all of them.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Plus, title: 'Log Your Last 20 Trades', desc: 'Enter each trade using the New Entry form. Record symbol, direction, entry/exit, and P&L.' },
            { icon: Target, title: 'Categorize Each Trade', desc: 'Use the Behavioral & Psychology section to tag whether each trade was Planned, Emotional, FOMO, or Revenge.' },
            { icon: BarChart3, title: 'Calculate Your Real Numbers', desc: 'The Analytics tab auto-calculates win rate, P&L, profit factor, avg win/loss, and expectancy.' },
            { icon: TrendingDown, title: 'Set Your Risk Rules', desc: 'Document your max risk per trade and daily loss limit in your journal setup notes.' },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <card.icon className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold">{card.title}</h3>
              </div>
              <p className="text-xs text-white/50">{card.desc}</p>
            </div>
          ))}
        </div>
        <Callout type="tip">
          <strong>Pro tip:</strong> If you have a CSV from your broker, use the <strong>Import</strong> button to bulk-upload from Interactive Brokers, Schwab, Robinhood, E*Trade, Fidelity, or Webull. Then go back and add behavioral data.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: NAVIGATE
      ════════════════════════════════════════════════════════════════ */}
      <section id="navigate" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">02 &mdash; NAVIGATE</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Finding the Trade Journal</h2>
        <p className="text-sm text-white/50">The journal lives under your member dashboard. Here&apos;s exactly what the page looks like.</p>

        <MockBrowser url="tradeitm.com/members/journal">
          <div className="mb-1 font-mono text-[10px] text-white/30">Dashboard <span className="text-emerald-400">&rsaquo;</span> Journal</div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-semibold">Trade Journal</h3>
              <p className="text-[11px] text-white/30">Manual-first journaling with clean analytics and import workflows</p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px]"><Upload className="h-3 w-3" /> Import</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px]"><Camera className="h-3 w-3" /> Screenshot</span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-black"><Plus className="h-3 w-3" /> New Entry</span>
            </div>
          </div>

          {/* Sub nav */}
          <div className="mb-4 flex gap-0 border-b border-white/10">
            <span className="border-b-2 border-emerald-500 px-4 py-2 text-xs font-medium text-emerald-400">Entries</span>
            <span className="px-4 py-2 text-xs text-white/30">Analytics</span>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Total Trades', value: '0' },
              { label: 'Win Rate', value: '—' },
              { label: 'Total P&L', value: '$0.00' },
              { label: 'Profit Factor', value: '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{s.label}</div>
                <div className="mt-1 font-mono text-base font-semibold text-white/40">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="py-8 text-center text-xs text-white/30">
            No journal entries yet. Click <strong className="text-emerald-400">+ New Entry</strong> to log your first trade.
          </div>
        </MockBrowser>

        <Callout type="tip">
          <strong>Three ways to add trades:</strong> <strong>New Entry</strong> opens the manual form (what we&apos;ll use for Week 1). <strong>Import</strong> uploads a CSV from your broker. <strong>Screenshot</strong> uses AI to extract trade data from a broker screenshot.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3: NEW ENTRY — QUICK FORM
      ════════════════════════════════════════════════════════════════ */}
      <section id="new-entry" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">03 &mdash; NEW ENTRY</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Logging a Trade: Quick Form</h2>
        <p className="text-sm text-white/50">Click <strong className="text-emerald-400">+ New Entry</strong> and you&apos;ll see the entry form. It starts in Quick mode.</p>

        <MockBrowser url="New Trade Entry — Quick Form">
          <div className="mb-3 flex items-center gap-0 overflow-hidden rounded-lg border border-white/10 w-fit">
            <span className="bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-black">Quick Form</span>
            <span className="px-4 py-1.5 text-[11px] text-white/40">Full Form</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MockField label="Symbol *" placeholder="SPY" />
            <MockField label="Direction" value="Long" />
            <MockField label="Entry Price" placeholder="0.00" />
            <MockField label="Exit Price" placeholder="0.00" />
          </div>
          <div className="mt-3">
            <MockField label="P&L (optional)" placeholder="0.00" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <span className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50">Cancel</span>
            <span className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black">Save Entry</span>
          </div>
        </MockBrowser>

        {/* Steps */}
        <div className="space-y-4 pl-4 border-l-2 border-white/10">
          {[
            { title: 'Enter the Symbol', desc: 'Type the ticker: SPY, QQQ, NVDA, SPX. It auto-uppercases.' },
            { title: 'Select Direction', desc: 'Long (bought calls/stock) or Short (bought puts/sold short).' },
            { title: 'Enter Entry & Exit Prices', desc: 'Your fill price in and out. For options, use premium price.' },
            { title: 'Add P&L', desc: 'Dollar result. Positive for winners, negative for losers.' },
            { title: 'Save', desc: 'Hit Save Entry. The trade appears immediately. Edit anytime for more detail.' },
          ].map((step, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-mono text-[10px] font-bold text-emerald-400">
                {i + 1}
              </div>
              <h4 className="text-sm font-semibold">{step.title}</h4>
              <p className="text-xs text-white/50">{step.desc}</p>
            </div>
          ))}
        </div>

        <Callout type="warning">
          <strong>For Week 1:</strong> Quick Form is fine for speed. But switch to <strong>Full Form</strong> on each entry to add behavioral data — that&apos;s where the real self-audit happens.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4: FULL FORM
      ════════════════════════════════════════════════════════════════ */}
      <section id="full-form" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">04 &mdash; FULL FORM</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">The Full Entry Form: Where Honesty Lives</h2>

        <MockBrowser url="New Trade Entry — Full Form">
          <div className="mb-3 flex items-center gap-0 overflow-hidden rounded-lg border border-white/10 w-fit">
            <span className="px-4 py-1.5 text-[11px] text-white/40">Quick Form</span>
            <span className="bg-emerald-500 px-4 py-1.5 text-[11px] font-semibold text-black">Full Form</span>
          </div>

          {/* Core section */}
          <div className="mb-3 rounded-lg border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <span className="text-xs font-semibold">Core Trade Details</span>
              <ChevronDown className="h-3 w-3 text-white/30" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
              <MockField label="Trade Date" value="2026-02-28" />
              <MockField label="Symbol" value="SPY" />
              <MockField label="Direction" value="Long" />
              <MockField label="Contract" value="Call" />
              <MockField label="Entry Price" value="3.45" />
              <MockField label="Exit Price" value="2.10" />
              <MockField label="Position Size" value="5" />
              <MockField label="P&L" value="-675.00" error />
            </div>
          </div>

          {/* Risk section */}
          <div className="mb-3 rounded-lg border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
              <span className="text-xs font-semibold">Risk Management</span>
              <ChevronDown className="h-3 w-3 text-white/30" />
            </div>
            <div className="grid grid-cols-3 gap-3 p-4">
              <MockField label="Stop Loss" placeholder="Not set" error />
              <MockField label="Initial Target" placeholder="Not set" error />
              <MockField label="Is Open" value="No (Closed)" />
            </div>
          </div>

          {/* BEHAVIORAL — HIGHLIGHTED */}
          <div className="mb-3 rounded-lg border border-emerald-500/30 overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between border-b border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5">
              <span className="text-xs font-semibold text-emerald-400">&#9733; Behavioral &amp; Psychology — CRITICAL FOR WEEK 1</span>
              <ChevronDown className="h-3 w-3 text-emerald-400" />
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Mood Before Trade</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <span
                      key={m}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        m === 'Anxious'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-white/[0.03] text-white/40'
                      }`}
                    >
                      {MOOD_EMOJI[m]} {m}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Mood After Trade</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <span
                      key={m}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        m === 'Frustrated'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-white/10 bg-white/[0.03] text-white/40'
                      }`}
                    >
                      {MOOD_EMOJI[m]} {m}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Discipline Score</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className={`rounded px-3 py-1.5 text-xs font-mono border ${
                          n === 2
                            ? 'border-red-500/30 bg-red-500/10 text-red-400'
                            : 'border-white/10 bg-white/[0.03] text-white/30'
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
                <MockField label="Followed Plan?" value="No" error />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Deviation Notes</label>
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs italic text-red-400/70">
                  Entered because SPY was dropping fast. No setup, no stop loss. Pure panic.
                </div>
              </div>
            </div>
          </div>

          {/* Tags — HIGHLIGHTED */}
          <div className="mb-3 rounded-lg border border-amber-500/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/[0.04] px-4 py-2.5">
              <span className="text-xs font-semibold text-amber-400">&#9733; Tags &amp; Rating — USE FOR CATEGORIZATION</span>
              <ChevronDown className="h-3 w-3 text-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Tags (comma-separated)</label>
                <div className="rounded-md border border-amber-500/20 bg-white/[0.03] px-3 py-2 font-mono text-xs text-amber-400">
                  emotional, no-stop-loss, revenge
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/30">Rating (1-5)</label>
                <div className="mt-1 text-amber-400" style={{ letterSpacing: '4px' }}>&#9733;&#9733;&#9734;&#9734;&#9734;</div>
              </div>
            </div>
          </div>

          {/* Collapsed sections */}
          <div className="mb-3 rounded-lg border border-white/10">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs font-semibold text-white/50">Trade Narrative</span>
              <ChevronRight className="h-3 w-3 text-white/20" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <span className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/50">Cancel</span>
            <span className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black">Save Entry</span>
          </div>
        </MockBrowser>

        <Callout type="critical">
          <strong>Week 1 requirement:</strong> Every one of your 20 trades must have the <strong>Behavioral &amp; Psychology</strong> section filled out and a tag of <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">planned</code>, <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">emotional</code>, <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">fomo</code>, or <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">revenge</code>.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5: CATEGORIZE
      ════════════════════════════════════════════════════════════════ */}
      <section id="categorize" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">05 &mdash; CATEGORIZE</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Tag Every Trade Honestly</h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TRADE_CATEGORIES.map((cat) => (
            <div key={cat.tag} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <cat.icon className={`mx-auto mb-2 h-6 w-6 ${cat.color === 'emerald' ? 'text-emerald-400' : cat.color === 'amber' ? 'text-amber-400' : 'text-red-400'}`} />
              <div className={`text-sm font-semibold ${cat.color === 'emerald' ? 'text-emerald-400' : cat.color === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>{cat.label}</div>
              <p className="mt-1 text-[11px] text-white/40">{cat.desc}</p>
            </div>
          ))}
        </div>

        {/* Sample journal with trades */}
        <MockBrowser url="Your journal after entering 20 trades">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Total Trades</div>
              <div className="font-mono text-lg font-bold">20</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Win Rate</div>
              <div className="font-mono text-lg font-bold text-emerald-400">45%</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Total P&L</div>
              <div className="font-mono text-lg font-bold text-red-400">-$1,240</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Profit Factor</div>
              <div className="font-mono text-lg font-bold text-red-400">0.72</div>
            </div>
          </div>

          {/* Filter hint */}
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
            <Filter className="h-3 w-3 text-white/30" />
            <span className="text-[11px] text-white/30">Tags:</span>
            <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">emotional</span>
          </div>

          {/* Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-white/30">Date</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-white/30">Symbol</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-white/30">Dir</th>
                  <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-white/30">Entry</th>
                  <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-white/30">Exit</th>
                  <th className="px-3 py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-white/30">P&L</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold uppercase tracking-wider text-white/30">Tag</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_TRADES.map((t, i) => (
                  <tr key={i} className={`border-b border-white/5 ${t.winner ? 'border-l-2 border-l-emerald-500' : 'border-l-2 border-l-red-500'}`}>
                    <td className="px-3 py-2.5 text-white/50">{t.date}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold">{t.symbol}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.dir === 'Long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {t.dir}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white/60">{t.entry}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-white/60">{t.exit}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${t.pnlColor}`}>{t.pnl}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.tagColor}`}>{t.tag}</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-white/20">... 15 more entries ...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 md:hidden">
            {SAMPLE_TRADES.map((trade, index) => (
              <article key={index} className={`rounded-lg border p-3 ${trade.winner ? 'border-emerald-500/25 bg-emerald-500/[0.03]' : 'border-red-500/25 bg-red-500/[0.03]'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-semibold text-white/90">{trade.symbol}</p>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${trade.tagColor}`}>{trade.tag}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/50">{trade.date} • {trade.dir}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-white/35">Entry</p>
                    <p className="font-mono text-white/70">{trade.entry}</p>
                  </div>
                  <div>
                    <p className="text-white/35">Exit</p>
                    <p className="font-mono text-white/70">{trade.exit}</p>
                  </div>
                  <div>
                    <p className="text-white/35">P&L</p>
                    <p className={`font-mono font-semibold ${trade.pnlColor}`}>{trade.pnl}</p>
                  </div>
                </div>
              </article>
            ))}
            <p className="px-2 text-center text-[11px] text-white/30">... 15 more entries ...</p>
          </div>
        </MockBrowser>

        <Callout type="tip">
          <strong>Use the filter bar</strong> to isolate by tag. Filter by <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]">emotional</code> to see only emotional trades — then look at the P&L. The pattern is usually clear: emotional trades are destroying your account.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6: ANALYTICS
      ════════════════════════════════════════════════════════════════ */}
      <section id="analytics" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">06 &mdash; ANALYTICS</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Read Your Analytics Dashboard</h2>
        <p className="text-sm text-white/50">Click the <strong className="text-white/80">Analytics</strong> tab. Once you have 20 trades entered, the dashboard populates automatically.</p>

        <MockBrowser url="tradeitm.com/members/journal/analytics">
          <div className="mb-3 flex gap-0 border-b border-white/10">
            <span className="px-4 py-2 text-xs text-white/30">Entries</span>
            <span className="border-b-2 border-emerald-500 px-4 py-2 text-xs font-medium text-emerald-400">Analytics</span>
          </div>

          {/* Period selector */}
          <div className="mb-4 flex gap-1">
            {['7d', '30d', '90d', '1y', 'All'].map((p) => (
              <span
                key={p}
                className={`rounded px-3 py-1 text-[10px] font-medium ${p === '30d' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'border border-white/10 text-white/30'}`}
              >
                {p}
              </span>
            ))}
          </div>

          {/* Stats grid */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Win Rate', value: '45%', color: 'text-amber-400' },
              { label: 'Avg P&L', value: '-$62', color: 'text-red-400' },
              { label: 'Expectancy', value: '-$62', color: 'text-red-400' },
              { label: 'Profit Factor', value: '0.72', color: 'text-red-400' },
              { label: 'Sharpe Ratio', value: '-0.31', color: 'text-red-400' },
              { label: 'Max Drawdown', value: '-18.4%', color: 'text-red-400' },
              { label: 'Winning', value: '9', color: 'text-emerald-400' },
              { label: 'Losing', value: '11', color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="text-[8px] font-semibold uppercase tracking-wider text-white/25">{s.label}</div>
                <div className={`font-mono text-sm font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Bias detection */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Behavioral Bias Detection</div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Revenge Trading Pattern Detected
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Confidence: <strong className="text-red-400">High (87%)</strong> — You enter trades within minutes of a loss with larger sizes. 4 of 20 trades match.
              </p>
            </div>
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Loss Aversion Bias
              </div>
              <p className="mt-1 text-[11px] text-white/40">
                Confidence: <strong className="text-amber-400">Medium (62%)</strong> — You hold losers longer than winners, hoping for recovery instead of cutting at your stop.
              </p>
            </div>
          </div>
        </MockBrowser>

        <Callout type="tip">
          <strong>What to look for:</strong> Focus on <strong>Win Rate</strong>, <strong>Expectancy</strong> (your EV from the lesson), <strong>Profit Factor</strong> (above 1.0 = profitable), and <strong>Behavioral Bias Detection</strong> which flags your biggest psychological patterns.
        </Callout>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7: CALCULATE
      ════════════════════════════════════════════════════════════════ */}
      <section id="calculate" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">07 &mdash; CALCULATE</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Your Week 1 Numbers</h2>

        <div className="space-y-3">
          {[
            { label: 'Expected Value (EV) per Trade', formula: 'EV = (Win Rate × Avg Win) − (Loss Rate × Avg Loss)', note: 'Shown as "Expectancy" in Analytics' },
            { label: 'Risk-to-Reward Ratio', formula: 'R:R = Average Win ÷ Average Loss', note: 'Sum winning P&Ls ÷ count of winners, then losing P&Ls ÷ count of losers' },
            { label: 'Emotional Trade %', formula: 'Emotional % = (FOMO + Revenge + Emotional) ÷ Total × 100', note: 'Use Tags filter to count each category' },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{f.label}</div>
              <div className="mt-2 font-mono text-emerald-400">{f.formula}</div>
              <p className="mt-2 text-xs text-white/40">{f.note}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <h3 className="text-sm font-semibold text-emerald-400">From Your Analytics Dashboard</h3>
            {['Win Rate', 'Total P&L', 'Profit Factor', 'Expectancy (EV per trade)', 'Max Drawdown'].map((item) => (
              <p key={item} className="text-xs text-white/50"><span className="text-emerald-400">&#9679;</span> {item}</p>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
            <h3 className="text-sm font-semibold" style={{ color: '#F3E5AB' }}>Calculate Yourself</h3>
            {['R:R Ratio (avg win $ ÷ avg loss $)', 'Emotional % (count emotional tags ÷ 20)', 'Max Daily Loss (3-5% of account)', 'Max Risk Per Trade (1-2% of account)', 'Planned vs. Unplanned — which won more?'].map((item) => (
              <p key={item} className="text-xs text-white/50"><span style={{ color: '#F3E5AB' }}>&#9679;</span> {item}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 8: CHECKLIST
      ════════════════════════════════════════════════════════════════ */}
      <section id="checklist" className="scroll-mt-24 space-y-4">
        <div className="font-mono text-xs tracking-widest text-emerald-400">08 &mdash; CHECKLIST</div>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-semibold">Week 1 Completion Checklist</h2>
        <p className="text-sm text-white/50">
          <span className="font-mono text-emerald-400">{checkedItems.size}</span> of {CHECKLIST_ITEMS.length} completed — tap each item as you finish it.
        </p>

        {/* Progress bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-300"
            style={{ width: `${(checkedItems.size / CHECKLIST_ITEMS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-1">
          {CHECKLIST_ITEMS.map((item, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all ${
                checkedItems.has(i)
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-white/40 line-through'
                  : 'border-white/5 bg-transparent text-white/70 hover:bg-white/[0.02]'
              }`}
            >
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                checkedItems.has(i)
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-white/20'
              }`}>
                {checkedItems.has(i) && <CheckCircle2 className="h-3 w-3 text-black" />}
              </div>
              <span>{item}</span>
            </button>
          ))}
        </div>

        <Callout type="tip">
          <strong>Remember:</strong> The point isn&apos;t to feel good about your numbers. It&apos;s to see the truth. Every great trader started by confronting their weaknesses. Your journal is now your mirror.
        </Callout>

        {/* Closing quote */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center">
          <p className="font-[family-name:var(--font-playfair)] text-lg">
            &ldquo;You don&apos;t need more trades.<br />You need <span className="text-emerald-400">better filters</span>.&rdquo;
          </p>
          <p className="mt-3 text-xs text-white/40">Week 2 Preview: The Setup Filter — How to build a checklist that eliminates 80% of bad trades before you enter.</p>
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/members/journal"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <BookOpen className="h-4 w-4" />
            Open Trade Journal
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/members/mentorship/week-1"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Back to Week 1 Lesson
          </Link>
        </div>
      </section>
    </div>
  )
}
