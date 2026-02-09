'use client'

import Link from 'next/link'
import { BarChart3 } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { AnalyticsDashboard } from '@/components/journal/analytics-dashboard'
import { PlaybookManager } from '@/components/journal/playbook-manager'
import { BehavioralInsights } from '@/components/journal/behavioral-insights'

export default function JournalAnalyticsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-serif text-ivory font-medium tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Journal Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Advanced performance metrics, timing, and execution analysis
          </p>
          <Breadcrumb
            className="mt-2"
            items={[
              { label: 'Dashboard', href: '/members' },
              { label: 'Journal', href: '/members/journal' },
              { label: 'Analytics' },
            ]}
          />
        </div>

        <Link
          href="/members/journal"
          className="px-3.5 py-2 rounded-lg border border-white/[0.1] text-sm text-ivory hover:bg-white/[0.05]"
        >
          Back To Journal
        </Link>
      </div>

      <AnalyticsDashboard />
      <PlaybookManager />
      <BehavioralInsights />
    </div>
  )
}
