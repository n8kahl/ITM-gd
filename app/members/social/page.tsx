'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SocialFeed } from '@/components/social/social-feed'
import { FeedFilterBar } from '@/components/social/feed-filter-bar'
import { LeaderboardTable } from '@/components/social/leaderboard-table'
import { AchievementGallery } from '@/components/social/achievement-gallery'
import { CommunityHighlights } from '@/components/social/community-highlights'
import { CommunityStatsBar } from '@/components/social/community-stats-bar'
import type { FeedFilters } from '@/lib/types/social'
import { DEFAULT_FEED_FILTERS } from '@/lib/types/social'

export default function TradeSocialPage() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Feed - 2/3 width */}
      <div className="lg:col-span-2 space-y-4">
        <FeedFilterBar filters={filters} onFiltersChange={setFilters} />
        <SocialFeed filters={filters} />
      </div>

      {/* Sidebar - 1/3 width */}
      <div className="space-y-6">
        <CommunityStatsBar />
        <LeaderboardTable period="weekly" category="win_rate" compact />
        <AchievementGallery compact limit={6} />
        <CommunityHighlights />
      </div>
    </div>
  )
}
