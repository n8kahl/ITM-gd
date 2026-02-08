'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  LayoutDashboard,
  BookOpen,
  Bot,
  GraduationCap,
  Palette,
  UserCircle,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth, type TabConfig } from '@/contexts/MemberAuthContext'

const ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  journal: BookOpen,
  'ai-coach': Bot,
  library: GraduationCap,
  studio: Palette,
  profile: UserCircle,
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname()
  const { profile, getVisibleTabs, signOut } = useMemberAuth()
  const visibleTabs = getVisibleTabs()

  // Close on route change
  useEffect(() => {
    onClose()
  }, [pathname])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed inset-y-0 left-0 z-50 w-[300px] bg-[#0A0A0B]/98 backdrop-blur-[40px] border-r border-white/[0.08] flex flex-col lg:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <Link href="/members" className="flex items-center gap-2.5" onClick={onClose}>
                <div className="relative w-7 h-7">
                  <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
                </div>
                <span className="text-base font-semibold text-ivory">TradeITM</span>
              </Link>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-ivory hover:bg-white/5 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Card */}
            {profile && (
              <div className="mx-4 mt-2 mb-3 p-3 rounded-xl glass-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 ring-2 ring-emerald-500/30 overflow-hidden">
                    {profile.discord_avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                        alt={profile.discord_username || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                          {(profile.discord_username || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ivory truncate">
                      {profile.discord_username || profile.email || 'Member'}
                    </p>
                    <p className="text-[11px] text-emerald-400 capitalize">
                      {profile.membership_tier || 'Free'} Member
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mx-5 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />

            {/* Navigation */}
            <nav className="flex-1 px-3 pt-3 pb-2 space-y-0.5 overflow-y-auto">
              {visibleTabs.map((tab) => {
                const Icon = ICON_MAP[tab.tab_id] || LayoutDashboard
                const href = tab.path.startsWith('/') ? tab.path : `/members/${tab.path}`
                const isActive = pathname === href || (href !== '/members' && pathname.startsWith(href))

                return (
                  <Link
                    key={tab.tab_id}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                      isActive
                        ? 'bg-emerald-500/[0.08] text-ivory font-medium'
                        : 'text-muted-foreground hover:text-ivory hover:bg-white/[0.03]'
                    )}
                  >
                    <Icon className={cn(
                      'w-5 h-5 flex-shrink-0',
                      isActive ? 'text-emerald-400' : 'text-muted-foreground'
                    )} />
                    <span className="flex-1">{tab.label}</span>
                    {tab.badge_text && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-900/30 text-emerald-400">
                        {tab.badge_text}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Sign Out */}
            <div className="px-3 pb-5 pt-2 border-t border-white/[0.06]">
              <button
                onClick={() => { signOut(); onClose() }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
