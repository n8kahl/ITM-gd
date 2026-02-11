'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SocialFeed } from '@/components/social/social-feed'
import { FeedFilterBar } from '@/components/social/feed-filter-bar'
import { LeaderboardTable } from '@/components/social/leaderboard-table'
import { AchievementGallery } from '@/components/social/achievement-gallery'
import { CommunityHighlights } from '@/components/social/community-highlights'
import { CommunityStatsBar } from '@/components/social/community-stats-bar'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { FeedFilters } from '@/lib/types/social'
import { DEFAULT_FEED_FILTERS } from '@/lib/types/social'

export default function TradeSocialPage() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FEED_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Feed - 2/3 width */}
      <div className="lg:col-span-2 space-y-4">
        <FeedFilterBar filters={filters} onFiltersChange={setFilters} />
        <SocialFeed filters={filters} />
      </div>

      {/* Sidebar - 1/3 width, collapsible on mobile */}
      <div className="space-y-6">
        {/* Mobile toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden w-full gap-2 text-xs"
        >
          {sidebarOpen ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Hide Community
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show Community
            </>
          )}
        </Button>

        <div className={cn('space-y-6', !sidebarOpen && 'hidden lg:block')}>
          <CommunityStatsBar />
          <LeaderboardTable period="weekly" category="win_rate" compact />
          <AchievementGallery compact limit={6} />
          <CommunityHighlights />
        </div>
      </div>
    </div>
  )
}
