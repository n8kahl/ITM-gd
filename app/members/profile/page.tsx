'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { TraderIdentityCard } from '@/components/profile/trader-identity-card'
import { TradingTranscriptCard } from '@/components/profile/trading-transcript'
import { AcademyProgressCard } from '@/components/profile/academy-progress-card'
import { DiscordCommunityCard } from '@/components/profile/discord-community-card'
import { WhopAffiliateCard } from '@/components/profile/whop-affiliate-card'
import { ProfileSettingsSheet } from '@/components/profile/profile-settings-sheet'
import { Skeleton } from '@/components/ui/skeleton-loader'
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
      // Fetch ALL data in parallel (including academy)
      const [profileRes, transcriptRes, affiliateRes, xpRes] = await Promise.allSettled([
        fetch('/api/members/profile'),
        fetch('/api/members/profile/transcript'),
        fetch('/api/members/affiliate'),
        fetch('/api/academy/xp'),
      ])

      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const profileData = await profileRes.value.json()
        setMemberProfile(profileData.data)
      }

      if (transcriptRes.status === 'fulfilled' && transcriptRes.value.ok) {
        const transcriptData = await transcriptRes.value.json()
        setTranscript(transcriptData.data)
      }

      if (affiliateRes.status === 'fulfilled' && affiliateRes.value.ok) {
        const affiliateData = await affiliateRes.value.json()
        setAffiliateStats({ stats: affiliateData.data?.stats ?? null })
      }

      if (xpRes.status === 'fulfilled' && xpRes.value.ok) {
        const xpData = await xpRes.value.json()
        setAcademyData({
          rank: xpData.data?.rank || 'Recruit',
          xp: xpData.data?.total_xp || 0,
          nextRankXp: xpData.data?.next_rank_xp || 100,
          achievementCount: xpData.data?.achievement_count || 0,
        })
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

    if (!res.ok) {
      throw new Error('Failed to save settings')
    }

    const data = await res.json()
    setMemberProfile(data.data)
  }

  const handleTranscriptPrivacyChange = async (visible: boolean) => {
    await handleSettingsSave({
      privacy_settings: {
        ...memberProfile?.privacy_settings,
        show_transcript: visible,
      },
    })
  }

  if (loading && !memberProfile) {
    return <Skeleton variant="screen" />
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
        isOwnProfile
        onEditProfile={() => setSettingsOpen(true)}
      />

      {/* Section 2: Trading Transcript */}
      <TradingTranscriptCard
        transcript={transcript}
        isOwnProfile={true}
        isPublic={memberProfile?.privacy_settings?.show_transcript ?? true}
        loading={transcriptLoading}
        onPrivacyChange={handleTranscriptPrivacyChange}
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
