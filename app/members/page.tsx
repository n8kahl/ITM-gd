'use client'

import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { LiveMarketTicker } from '@/components/dashboard/live-market-ticker'
import { DashboardStatCards } from '@/components/dashboard/dashboard-stat-cards'
import { EquityCurve } from '@/components/dashboard/equity-curve'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RecentTrades } from '@/components/dashboard/recent-trades'
import { AIInsights } from '@/components/dashboard/ai-insights'
import { CalendarHeatmap } from '@/components/dashboard/calendar-heatmap'

export default function MemberDashboard() {
  const { profile } = useMemberAuth()

  return (
    <div className="space-y-5 lg:space-y-6">
      <section role="region" aria-label="Dashboard welcome">
        <WelcomeHeader
          username={profile?.discord_username || profile?.email || 'Trader'}
        />
      </section>

      <section role="region" aria-label="Live market ticker">
        <LiveMarketTicker />
      </section>

      <section role="region" aria-label="Performance statistics">
        <DashboardStatCards />
      </section>

      <section role="region" aria-label="Equity and quick actions">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 lg:gap-5">
          <EquityCurve />
          <QuickActions />
        </div>
      </section>

      <section role="region" aria-label="Recent trades">
        <RecentTrades />
      </section>

      <section role="region" aria-label="AI insights and calendar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          <AIInsights />
          <CalendarHeatmap />
        </div>
      </section>
    </div>
  )
}
