'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { TraderIdentityCard } from '@/components/profile/trader-identity-card'
import { TradingTranscriptCard } from '@/components/profile/trading-transcript'
import { AcademyProgressCard } from '@/components/profile/academy-progress-card'
import { DiscordCommunityCard } from '@/components/profile/discord-community-card'
import { WhopAffiliateCard } from '@/components/profile/whop-affiliate-card'
import { ProfileSettingsSheet } from '@/components/profile/profile-settings-sheet'
import { getRankForXP, getXPToNextRank } from '@/lib/academy/xp-utils'
import type { MemberProfile, TradingTranscript } from '@/lib/types/social'

interface AcademyData {
  rank: string
  xp: number
  nextRankXp: number
  achievementCount?: number
}

export default function ProfilePage() {
  const { user, profile: authProfile, syncDiscordRoles } = useMemberAuth()

  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null)
  const [transcript, setTranscript] = useState<TradingTranscript | null>(null)
  const [academyData, setAcademyData] = useState<AcademyData | null>(null)
  const [affiliateStats, setAffiliateStats] = useState<{
    stats: { total_referrals: number; active_referrals: number; total_earnings: number; unpaid_earnings: number; conversion_rate: number | null } | null
  }>({ stats: null })
  const [loading, setLoading] = useState(true)
  const [transcriptLoading, setTranscriptLoading] = useState(true)
  const [affiliateLoading, setAffiliateLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setTranscriptLoading(true)
    setAffiliateLoading(true)

    try {
      // Fetch all data in parallel
      const [profileRes, transcriptRes, affiliateRes] = await Promise.all([
        fetch('/api/members/profile'),
        fetch('/api/members/profile/transcript'),
        fetch('/api/members/affiliate'),
      ])

      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setMemberProfile(profileData.data)
      }

      if (transcriptRes.ok) {
        const transcriptData = await transcriptRes.json()
        setTranscript(transcriptData.data)
      }

      if (affiliateRes.ok) {
        const affiliateData = await affiliateRes.json()
        setAffiliateStats({ stats: affiliateData.data?.stats ?? null })
      }

      // Derive academy profile metrics from v3 mastery data.
      try {
        const academyRes = await fetch('/api/academy-v3/mastery')
        if (academyRes.ok) {
          const academyJson = await academyRes.json()
          const masteryItems = Array.isArray(academyJson?.data?.items) ? academyJson.data.items : []
          const averageMasteryScore = masteryItems.length > 0
            ? masteryItems.reduce((sum: number, item: { currentScore?: number }) => (
              sum + (typeof item.currentScore === 'number' ? item.currentScore : 0)
            ), 0) / masteryItems.length
            : 0
          const inferredXp = Math.round(averageMasteryScore * 120)
          const rank = getRankForXP(inferredXp)
          const nextRank = getXPToNextRank(inferredXp)
          setAcademyData({
            rank,
            xp: inferredXp,
            nextRankXp: inferredXp + nextRank.xpNeeded,
            achievementCount: masteryItems.filter((item: { currentScore?: number }) => (
              typeof item.currentScore === 'number' && item.currentScore >= 85
            )).length,
          })
        }
      } catch {
        // Academy data is optional
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error)
    } finally {
      setLoading(false)
      setTranscriptLoading(false)
      setAffiliateLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSettingsSave = async (updates: Record<string, unknown>) => {
    const res = await fetch('/api/members/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.ok) {
      const data = await res.json()
      setMemberProfile(data.data)
    }
  }

  if (loading && !memberProfile) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!memberProfile) {
    return (
      <div className="max-w-4xl mx-auto rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-white/60">
          Unable to load your profile right now. Please refresh and try again.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Settings button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="border-white/10 text-white/60 hover:text-white hover:bg-white/5"
          data-testid="settings-button"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Section 1: Trader Identity Card */}
      <TraderIdentityCard
        profile={memberProfile}
        discordUsername={authProfile?.discord_username}
        discordAvatar={authProfile?.discord_avatar}
        membershipTier={authProfile?.membership_tier}
        academyData={academyData}
      />

      {/* Section 2: Trading Transcript */}
      <TradingTranscriptCard
        transcript={transcript}
        isOwnProfile={true}
        isPublic={memberProfile?.privacy_settings?.show_transcript ?? true}
        loading={transcriptLoading}
      />

      {/* Section 3: Academy Progress */}
      <AcademyProgressCard
        academyData={academyData}
        loading={loading}
      />

      {/* Section 4: Discord & Community */}
      <DiscordCommunityCard
        discordUsername={authProfile?.discord_username}
        discordAvatar={authProfile?.discord_avatar}
        discordRoles={authProfile?.discord_roles}
        onSyncRoles={syncDiscordRoles}
      />

      {/* Section 5: WHOP & Affiliate Hub */}
      <WhopAffiliateCard
        affiliateUrl={memberProfile?.whop_affiliate_url ?? undefined}
        stats={affiliateStats.stats}
        loading={affiliateLoading}
      />

      {/* Settings Sheet */}
      <ProfileSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={memberProfile}
        onSave={handleSettingsSave}
      />
    </div>
  )
}
