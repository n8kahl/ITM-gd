'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  BookOpen,
  Notebook,
  User,
  LogOut,
  RefreshCw,
  AlertCircle,
  Wand2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberAuthProvider, useMemberAuth } from '@/contexts/MemberAuthContext'
import { MobileBottomNav } from '@/components/ui/mobile-bottom-nav'

// ============================================
// NAVIGATION CONFIG
// ============================================

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  permission?: string // Required permission to see this item
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/members', icon: LayoutDashboard, permission: 'access_core_content' },
  { name: 'Library', href: '/members/library', icon: BookOpen, permission: 'access_course_library' },
  { name: 'Journal', href: '/members/journal', icon: Notebook, badge: 'New', permission: 'access_trading_journal' },
  { name: 'Studio', href: '/members/studio', icon: Wand2, permission: 'access_core_content' },
  { name: 'Profile', href: '/members/profile', icon: User, permission: 'access_core_content' },
]

// Mobile nav items (subset for bottom bar)
const mobileNavItems = [
  { name: 'Dashboard', href: '/members', icon: LayoutDashboard },
  { name: 'Library', href: '/members/library', icon: BookOpen },
  { name: 'Studio', href: '/members/studio', icon: Wand2 },
  { name: 'Profile', href: '/members/profile', icon: User },
]

// ============================================
// LAYOUT WRAPPER WITH PROVIDER
// ============================================

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MemberAuthProvider>
      <MembersLayoutContent>{children}</MembersLayoutContent>
    </MemberAuthProvider>
  )
}

// ============================================
// LAYOUT CONTENT (uses auth context)
// ============================================

function MembersLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const {
    user,
    profile,
    permissions,
    isLoading,
    isAuthenticated,
    error,
    isNotMember,
    signOut,
    syncDiscordRoles,
    hasPermission,
  } = useMemberAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/members')
    }
  }, [isLoading, isAuthenticated, router])

  // Redirect to join-discord page if user is not a member of the Discord server
  useEffect(() => {
    if (!isLoading && isAuthenticated && isNotMember) {
      router.push('/join-discord')
    }
  }, [isLoading, isAuthenticated, isNotMember, router])

  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter(item => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  // Filter mobile nav based on permissions
  const filteredMobileNav = mobileNavItems.filter(item => {
    const navItem = navigation.find(n => n.href === item.href)
    if (!navItem?.permission) return true
    return hasPermission(navItem.permission)
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
          </div>
          <p className="text-white/60">Loading your dashboard...</p>
          <p className="text-white/40 text-sm mt-2">Syncing Discord roles...</p>
        </div>
      </div>
    )
  }

  // Not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
          </div>
          <p className="text-white/60">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Not a member of the Discord server (will redirect)
  if (isNotMember) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-white/60">Redirecting to join Discord...</p>
        </div>
      </div>
    )
  }

  // Error state (but still authenticated)
  const showError = error && !profile?.discord_user_id

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Desktop Sidebar - Now with Glass Effect */}
      <aside className="hidden lg:flex w-64 flex-col bg-[#0F0F10]/60 backdrop-blur-xl border-r border-white/5">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <Link href="/members" className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
            </div>
            <div>
              <span className="text-lg font-bold text-emerald-500">TradeITM</span>
              <span className="text-xs text-white/40 block">Member Area</span>
            </div>
          </Link>
        </div>

        {/* User Card */}
        {profile && (
          <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden">
                {profile.discord_avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                    alt={profile.discord_username || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-emerald-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {profile.discord_username || profile.email || 'Member'}
                </p>
                <p className="text-xs text-emerald-500 capitalize">
                  {profile.membership_tier || 'Free'} Member
                </p>
              </div>
            </div>
            {/* Sync Button */}
            <button
              onClick={() => syncDiscordRoles()}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-xs transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              Sync Roles
            </button>
          </div>
        )}

        {/* Error Alert */}
        {showError && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-400">
                <p className="font-medium">Discord sync failed</p>
                <p className="text-red-400/70 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavigation.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/members' && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-emerald-500' : 'text-white/40 group-hover:text-white/60'
                )} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    item.badge === 'New'
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-white/5 text-white/40'
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Permissions Debug (only in dev) */}
        {process.env.NODE_ENV === 'development' && permissions.length > 0 && (
          <div className="mx-4 mb-4 p-3 rounded-lg bg-white/5 text-xs">
            <p className="text-white/40 mb-2">Permissions:</p>
            <div className="flex flex-wrap gap-1">
              {permissions.map(p => (
                <span key={p.id} className="px-2 py-0.5 rounded bg-white/10 text-white/60">
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Page Content with Page Transitions */}
        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav items={filteredMobileNav} />
      </div>
    </div>
  )
}

// Re-export hook for convenience
export { useMemberAuth, useMemberAuth as useMemberSession } from '@/contexts/MemberAuthContext'
