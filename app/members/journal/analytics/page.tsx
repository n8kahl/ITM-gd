'use client'

import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/members/page-header'
import { JournalSubNav } from '@/components/journal/journal-sub-nav'
import { BiasInsightsCard } from '@/components/journal/bias-insights-card'
import { SetupPerformanceCard } from '@/components/journal/setup-performance-card'

const AnalyticsDashboard = dynamic(
  () => import('@/components/journal/analytics-dashboard').then((mod) => mod.AnalyticsDashboard),
  {
    loading: () => (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
        Loading analytics...
      </div>
    ),
  },
)

export default function JournalAnalyticsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Analytics"
        subtitle="Advanced performance metrics, behavioral insights, and regime analysis."
        icon={<BarChart3 className="h-6 w-6 text-emerald-400" />}
        breadcrumbs={[
          { label: 'Dashboard', href: '/members' },
          { label: 'Journal', href: '/members/journal' },
          { label: 'Analytics' },
        ]}
      />

      <JournalSubNav />

      {/* Phase 3: Behavioral Analytics cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <BiasInsightsCard />
        <SetupPerformanceCard />
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
