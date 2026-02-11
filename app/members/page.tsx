'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { WelcomeHeader } from '@/components/dashboard/welcome-header'
import { LiveMarketTicker } from '@/components/dashboard/live-market-ticker'
import { DashboardStatCards } from '@/components/dashboard/dashboard-stat-cards'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { RecentTrades } from '@/components/dashboard/recent-trades'
import { AIInsights } from '@/components/dashboard/ai-insights'
import { CalendarHeatmap } from '@/components/dashboard/calendar-heatmap'
import { FADE_UP_VARIANT, LUXURY_SPRING, STAGGER_CHILDREN } from '@/lib/motion-primitives'

const EquityCurve = dynamic(
  () => import('@/components/dashboard/equity-curve').then((mod) => mod.EquityCurve),
  {
    loading: () => <div className="h-[320px] rounded-2xl shimmer-surface" />,
  },
)

const TICKER_VARIANT = {
  initial: { opacity: 0, x: 20, filter: 'blur(2px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
}

export default function MemberDashboard() {
  const { profile } = useMemberAuth()

  return (
    <motion.div
      className="space-y-6"
      variants={STAGGER_CHILDREN}
      initial="initial"
      animate="animate"
    >
      <motion.section
        role="region"
        aria-label="Dashboard welcome"
        variants={FADE_UP_VARIANT}
        transition={LUXURY_SPRING}
      >
        <WelcomeHeader
          username={profile?.discord_username || profile?.email || 'Trader'}
        />
      </motion.section>

      <motion.section
        role="region"
        aria-label="Live market ticker"
        variants={TICKER_VARIANT}
        transition={LUXURY_SPRING}
      >
        <LiveMarketTicker />
      </motion.section>

      <motion.section
        role="region"
        aria-label="Performance statistics"
        variants={FADE_UP_VARIANT}
        transition={LUXURY_SPRING}
      >
        <DashboardStatCards />
      </motion.section>

      <motion.section
        role="region"
        aria-label="Equity and quick actions"
        variants={FADE_UP_VARIANT}
        transition={LUXURY_SPRING}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <EquityCurve />
          <QuickActions />
        </div>
      </motion.section>

      <motion.section
        role="region"
        aria-label="Recent trades"
        variants={FADE_UP_VARIANT}
        transition={LUXURY_SPRING}
      >
        <RecentTrades />
      </motion.section>

      <motion.section
        role="region"
        aria-label="AI insights and calendar"
        variants={FADE_UP_VARIANT}
        transition={LUXURY_SPRING}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIInsights />
          <CalendarHeatmap />
        </div>
      </motion.section>
    </motion.div>
  )
}
