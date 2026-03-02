'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator, ClipboardCheck, GraduationCap } from 'lucide-react'

const RESOURCE_ITEMS = [
  {
    title: 'Week 1 Core Lesson',
    description: 'Identity reset, expected value, risk-to-reward, and drawdown recovery.',
    href: '/members/mentorship/week-1',
    icon: GraduationCap,
    cta: 'Open Lesson',
  },
  {
    title: 'Trade Journal Walkthrough',
    description: 'Step-by-step guide for completing the 20-trade Week 1 assignment.',
    href: '/members/mentorship/week-1/journal-guide',
    icon: BookOpen,
    cta: 'Open Journal Guide',
  },
  {
    title: 'Live Journal Workspace',
    description: 'Go straight to the production journal workflow for assignment execution.',
    href: '/members/journal',
    icon: ClipboardCheck,
    cta: 'Open Trade Journal',
  },
]

export default function MentorshipResourcesPage() {
  return (
    <div className="space-y-6">
      <section className="glass-card-heavy rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Sniper Mentorship</p>
        <h1 className="mt-2 font-[family-name:var(--font-playfair)] text-2xl font-semibold text-white md:text-3xl">
          Resource Hub
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/65">
          Central links for Week 1 execution. Use this page as your launchpad for lesson review, journal completion,
          and assignment submission prep.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {RESOURCE_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.title} className="glass-card-heavy rounded-2xl border border-white/10 p-5">
              <div className="flex items-center gap-2 text-emerald-300">
                <Icon className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">Resource</p>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-white/60">{item.description}</p>
              <Link
                href={item.href}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
              >
                {item.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          )
        })}
      </section>

      <section className="glass-card-heavy rounded-2xl border border-champagne/30 p-5">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 h-5 w-5 text-champagne" />
          <div>
            <h3 className="text-sm font-semibold text-white">Week 1 Submission Checklist</h3>
            <p className="mt-2 text-sm text-white/65">
              Bring these to your group call: total trades logged, win rate, expectancy, risk-to-reward, emotional trade
              percentage, and your max daily loss rule.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
