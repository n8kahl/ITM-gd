'use client'

import { LayoutDashboard } from 'lucide-react'
import { MarketBiasCard } from '@/components/dashboard/market-bias-card'
import { StatsOverview } from '@/components/dashboard/stats-overview'
import { RecentEntries } from '@/components/dashboard/recent-entries'

export default function MemberDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-emerald-500" />
          Dashboard
        </h1>
        <p className="text-white/60 mt-2">
          Your trading performance at a glance
        </p>
      </div>

      {/* Market Bias Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <MarketBiasCard bias="bullish" confidence={72} />
        </div>

        <div className="lg:col-span-2">
          {/* Stats Overview */}
          <StatsOverview />
        </div>
      </div>

      {/* Recent Journal Entries */}
      <RecentEntries />
    </div>
  )
}
