import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { isValidVerificationCode } from '@/lib/validation/crypto-utils'
import { ShareButtons } from './share-buttons'

// ---------------------------------------------------------------------------
// Supabase admin client (server-side only)
// ---------------------------------------------------------------------------
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
interface AchievementRecord {
  id: string
  user_id: string
  achievement_type: string
  achievement_key: string
  achievement_data: Record<string, unknown>
  xp_earned: number
  trade_card_image_url: string | null
  verification_code: string
  earned_at: string
}

interface UserProfile {
  discord_username: string | null
  discord_avatar: string | null
}

async function getVerifiedAchievement(code: string) {
  if (!isValidVerificationCode(code)) {
    return null
  }

  const supabase = getSupabaseAdmin()

  const { data: achievement, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('verification_code', code)
    .single()

  if (error || !achievement) {
    return null
  }

  const typedAchievement = achievement as AchievementRecord

  // Fetch Discord profile for display name
  const { data: profile } = await supabase
    .from('user_discord_profiles')
    .select('discord_username, discord_avatar')
    .eq('user_id', typedAchievement.user_id)
    .maybeSingle()

  // Fetch user email as fallback
  const { data: userData } = await supabase.auth.admin.getUserById(
    typedAchievement.user_id
  )

  const userProfile = profile as UserProfile | null
  const achievementData = typedAchievement.achievement_data || {}
  const memberName =
    userProfile?.discord_username ||
    userData?.user?.user_metadata?.full_name ||
    userData?.user?.email?.split('@')[0] ||
    'TITM Member'

  const metadataTier =
    typeof achievementData.tier === 'string'
      ? achievementData.tier.toLowerCase()
      : null

  const tier =
    metadataTier === 'core' || metadataTier === 'pro' || metadataTier === 'executive'
      ? metadataTier
      : 'core'

  return {
    achievement: typedAchievement,
    memberName,
    tier,
  }
}

// ---------------------------------------------------------------------------
// Tier color mapping for UI accents
// ---------------------------------------------------------------------------
const TIER_ACCENT: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  core: {
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    glow: 'shadow-[0_0_60px_rgba(16,185,129,0.15)]',
  },
  pro: {
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    glow: 'shadow-[0_0_60px_rgba(59,130,246,0.15)]',
  },
  executive: {
    border: 'border-[#F3E5AB]/30',
    text: 'text-[#F3E5AB]',
    bg: 'bg-[#F3E5AB]/10',
    glow: 'shadow-[0_0_60px_rgba(243,229,171,0.12)]',
  },
}

// ---------------------------------------------------------------------------
// Dynamic OG metadata
// ---------------------------------------------------------------------------
interface PageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const result = await getVerifiedAchievement(code)

  if (!result) {
    return {
      title: 'Achievement Not Found | TITM Academy',
      description: 'This verification code is invalid or the achievement does not exist.',
    }
  }

  const { achievement, memberName } = result
  const achievementData = achievement.achievement_data || {}
  const title = (achievementData.title as string) || achievement.achievement_key || 'Achievement'
  const description = `${memberName} earned "${title}" at TITM Academy. Verified on-chain.`

  const ogImage = achievement.trade_card_image_url || '/og-image.png'

  return {
    title: `${title} | TITM Academy Verified`,
    description,
    openGraph: {
      title: `${title} - TITM Academy Achievement`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${title} - Achievement by ${memberName}`,
        },
      ],
      type: 'article',
      siteName: 'Trade In The Money',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - TITM Academy`,
      description,
      images: [ogImage],
    },
  }
}

// ---------------------------------------------------------------------------
// Page Component (Server)
// ---------------------------------------------------------------------------
export default async function VerifyPage({ params }: PageProps) {
  const { code } = await params
  const result = await getVerifiedAchievement(code)

  if (!result) {
    notFound()
  }

  const { achievement, memberName, tier } = result
  const achievementData = achievement.achievement_data || {}
  const achievementTitle = (achievementData.title as string) || achievement.achievement_key || 'Achievement Unlocked'
  const achievementDescription = (achievementData.description as string) || null

  const earnedDate = new Date(achievement.earned_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const accent = TIER_ACCENT[tier] || TIER_ACCENT.core
  const verificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://tradeitm.com'}/verify/${code}`

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F0] relative">
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to TITM
        </Link>

        {/* Verified badge */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`p-2.5 rounded-full ${accent.bg} ${accent.glow}`}>
            <ShieldCheck className={`w-6 h-6 ${accent.text}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold uppercase tracking-wider ${accent.text}`}>
              Verified Achievement
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Authenticity confirmed by TITM Academy
            </p>
          </div>
        </div>

        {/* Main card */}
        <div
          className={`glass-card-heavy rounded-xl ${accent.border} border overflow-hidden mb-8 ${accent.glow}`}
        >
          {/* Trade card image */}
          {achievement.trade_card_image_url && (
            <div className="relative w-full aspect-[1200/630] bg-black/50">
              <Image
                src={achievement.trade_card_image_url}
                alt={`${achievementTitle} - Trade Card`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
                priority
              />
            </div>
          )}

          {/* Achievement details */}
          <div className="p-6 sm:p-8">
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight">
              {achievementTitle}
            </h1>

            {achievementDescription && (
              <p className="text-white/60 text-sm sm:text-base mb-6 leading-relaxed">
                {achievementDescription}
              </p>
            )}

            {/* Member info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {/* Member */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                  Member
                </p>
                <p className="text-sm font-medium text-white/90">{memberName}</p>
              </div>

              {/* Earned */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                  Earned
                </p>
                <p className="text-sm font-medium text-white/90">{earnedDate}</p>
              </div>

              {/* XP Earned */}
              {achievement.xp_earned > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                  <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1">
                    XP Earned
                  </p>
                  <p className={`text-sm font-semibold ${accent.text}`}>
                    +{achievement.xp_earned} XP
                  </p>
                </div>
              )}
            </div>

            {/* Tier badge */}
            <div className="flex items-center gap-3 mb-6">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${accent.bg} ${accent.text} border ${accent.border}`}
              >
                {tier} Tier
              </span>
              <span className="text-xs text-white/30 font-mono">
                {achievement.achievement_type.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Verification code */}
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">
                Verification Code
              </p>
              <p className="font-mono text-xs text-white/50 break-all">
                {code}
              </p>
            </div>
          </div>
        </div>

        {/* Share buttons */}
        <div className="mb-12">
          <p className="text-sm text-white/40 mb-3">Share this achievement</p>
          <ShareButtons
            verificationUrl={verificationUrl}
            cardImageUrl={achievement.trade_card_image_url}
            achievementTitle={achievementTitle}
          />
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-white/20">
            TITM Academy &middot; Trade In The Money &middot; Verified Achievements
          </p>
        </div>
      </div>
    </div>
  )
}
