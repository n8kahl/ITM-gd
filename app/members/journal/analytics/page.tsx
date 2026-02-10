'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/breadcrumb'

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-medium tracking-tight text-ivory lg:text-2xl">
            <BarChart3 className="h-6 w-6 text-emerald-400" />
            Journal Analytics
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Advanced performance metrics and trade analytics.
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
          className="rounded-lg border border-white/10 px-3.5 py-2 text-sm text-ivory hover:bg-white/5"
        >
          Back To Journal
        </Link>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
