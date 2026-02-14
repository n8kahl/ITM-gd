'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  GraduationCap,
  Palette,
  Users,
  UserCircle,
  LogOut,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth, type TabConfig } from '@/contexts/MemberAuthContext'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'
import { isLibraryPath } from '@/lib/navigation-utils'

// ============================================
// ICON MAP (tab_id -> Lucide icon)
// ============================================

const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  journal: BookOpen,
  'ai-coach': Bot,
  library: GraduationCap,
  social: Users,
  studio: Palette,
  profile: UserCircle,
}

function getIconForTab(tab: TabConfig): LucideIcon {
  return ICON_MAP[tab.tab_id] || LayoutDashboard
}

function getTabHref(tab: TabConfig): string {
  const rawHref = tab.path.startsWith('/') ? tab.path : `/members/${tab.path}`
  if (tab.tab_id === 'library' && rawHref === '/members/library') {
    return '/members/academy/courses'
  }
  return rawHref
}

function isTabActive(pathname: string, tab: TabConfig, href: string): boolean {
  if (tab.tab_id === 'library') {
    return pathname === href || pathname.startsWith(`${href}/`) || isLibraryPath(pathname)
  }

  return pathname === href || (href !== '/members' && pathname.startsWith(href))
}

// ============================================
// TIER BADGE
// ============================================

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null

  const styles: Record<string, string> = {
    core: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50',
    pro: 'bg-champagne/10 text-champagne border-champagne/30',
    executive: 'bg-gradient-to-r from-champagne to-emerald-400 text-onyx border-transparent',
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize',
      styles[tier] || styles.core
    )}>
      {tier}
    </span>
  )
}

// ============================================
// SIDEBAR
// ============================================

export function MemberSidebar() {
  const pathname = usePathname()
  const {
    profile,
    getVisibleTabs,
    signOut,
  } = useMemberAuth()

  const visibleTabs = getVisibleTabs()
  const isExecutive = profile?.membership_tier === 'executive'

  return (
    <aside className={cn(
      'hidden lg:flex w-[280px] flex-col fixed inset-y-0 left-0 z-40 overflow-hidden',
      'bg-[#0A0A0B]/60 backdrop-blur-xl',
      'border-r border-white/5',
    )}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"
      />

      {/* Brand Header */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/members" className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="32px" className="object-contain" />
          </div>
          <div>
            <span className="text-base font-semibold text-ivory tracking-tight">TradeITM</span>
            <span className="text-[11px] text-champagne/70 block font-serif">Trading Room</span>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-champagne/20 via-champagne/10 to-transparent" />

      {/* User Profile Card */}
      {profile && (
        <div className="mx-3 mt-4 p-4 rounded-xl glass-card">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative w-11 h-11 rounded-full flex-shrink-0 ring-2 ring-emerald-500/30 ring-offset-1 ring-offset-[#0A0A0B]">
              {profile.discord_avatar ? (
                <Image
                  src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                  alt={profile.discord_username || 'User'}
                  fill
                  sizes="44px"
                  className="rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {(profile.discord_username || profile.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ivory truncate">
                {profile.discord_username || profile.email || 'Member'}
              </p>
              <TierBadge tier={profile.membership_tier} />
            </div>
          </div>

        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5 overflow-y-auto">
        {visibleTabs.map((tab) => {
          const Icon = getIconForTab(tab)
          const href = getTabHref(tab)
          const isActive = isTabActive(pathname, tab, href)

          return (
            <Link
              key={tab.tab_id}
              href={href}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-500 ease-out group overflow-hidden',
                isActive
                  ? 'text-ivory'
                  : 'text-muted-foreground hover:text-ivory hover:bg-white/[0.03]'
              )}
            >
              {/* Active glow pill */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-glow"
                  className="pointer-events-none absolute inset-y-0 left-0 right-0 rounded-lg bg-emerald-500/10 border-l-2 border-emerald-500 shadow-[0_0_20px_-5px_rgba(16,185,129,0.15)]"
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              )}

              <Icon
                strokeWidth={1.5}
                className={cn(
                'relative z-[1] w-[18px] h-[18px] flex-shrink-0 transition-colors',
                isActive ? 'text-emerald-400' : 'text-muted-foreground group-hover:text-ivory/60'
              )}
              />

              <span className="relative z-[1] flex-1 truncate font-sans font-normal tracking-[0.08em]">{tab.label}</span>

              {tab.badge_text && (
                <span className={cn(
                  'relative z-[1] px-1.5 py-0.5 text-[10px] font-medium rounded-full',
                  tab.badge_variant === 'emerald'
                    ? 'bg-emerald-900/30 text-emerald-400'
                    : tab.badge_variant === 'champagne'
                    ? 'bg-champagne/10 text-champagne'
                    : 'bg-white/[0.06] text-muted-foreground'
                )}>
                  {tab.badge_text}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Tier Upgrade CTA (if not executive) */}
      {!isExecutive && profile?.membership_tier && (
        <div className="mx-3 mb-3 p-3 rounded-xl glass-card border-champagne/15">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles strokeWidth={1.5} className="w-4 h-4 text-champagne" />
            <span className="text-xs font-medium text-champagne">
              Upgrade to {profile.membership_tier === 'core' ? 'Pro' : 'Executive'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Unlock more features and tools
          </p>
          <Link
            href="/members/profile#upgrade"
            className="block text-center px-3 py-1.5 rounded-lg text-xs font-medium border border-champagne/25 text-champagne hover:bg-champagne/10 transition-colors"
          >
            Learn More
          </Link>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 pb-4 pt-2 border-t border-white/[0.06]">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut strokeWidth={1.5} className="w-[18px] h-[18px]" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
