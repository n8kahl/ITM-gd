'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  Notebook,
  Trophy,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberAuthProvider, useMemberAuth } from '@/contexts/MemberAuthContext'

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
  { name: 'Dashboard', href: '/members', icon: LayoutDashboard },
  { name: 'Course Library', href: '/members/library', icon: BookOpen, permission: 'view_courses' },
  { name: 'Trade Journal', href: '/members/journal', icon: Notebook, badge: 'New' },
  { name: 'Achievements', href: '/members/achievements', icon: Trophy, badge: 'Soon' },
  { name: 'Profile', href: '/members/profile', icon: User },
  { name: 'Settings', href: '/members/settings', icon: Settings },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    user,
    profile,
    permissions,
    isLoading,
    isAuthenticated,
    error,
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

  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter(item => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#D4AF37] mx-auto mb-4 animate-pulse" />
          <p className="text-white/60">Loading your dashboard...</p>
          <p className="text-white/40 text-sm mt-2">Syncing Discord roles...</p>
        </div>
      </div>
    )
  }

  // Not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#D4AF37] mx-auto mb-4 animate-pulse" />
          <p className="text-white/60">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Error state (but still authenticated)
  const showError = error && !profile?.discord_user_id

  return (
    <div className="min-h-screen bg-[#0f0f10] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-[#0a0a0b] border-r border-white/5">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <Link href="/members" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="text-lg font-bold text-[#D4AF37]">TradeITM</span>
              <span className="text-xs text-white/40 block">Member Area</span>
            </div>
          </Link>
        </div>

        {/* User Card */}
        {profile && (
          <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center overflow-hidden">
                {profile.discord_avatar ? (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                    alt={profile.discord_username || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-[#D4AF37]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {profile.discord_username || profile.email || 'Member'}
                </p>
                <p className="text-xs text-[#D4AF37] capitalize">
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
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-[#D4AF37]' : 'text-white/40 group-hover:text-white/60'
                )} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded-full',
                    item.badge === 'New'
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'bg-white/5 text-white/40'
                  )}>
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-4 h-4 text-[#D4AF37]/60" />}
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

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a0a0b] border-r border-white/5 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <Link href="/members" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-black" />
                </div>
                <span className="text-lg font-bold text-[#D4AF37]">TradeITM</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Card */}
            {profile && (
              <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center overflow-hidden">
                    {profile.discord_avatar ? (
                      <img
                        src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                        alt={profile.discord_username || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-[#D4AF37]" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {profile.discord_username || profile.email || 'Member'}
                    </p>
                    <p className="text-xs text-[#D4AF37] capitalize">
                      {profile.membership_tier || 'Free'} Member
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
              {filteredNavigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive
                        ? 'bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <span className={cn(
                        'px-2 py-0.5 text-xs rounded-full',
                        item.badge === 'New'
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                          : 'bg-white/5 text-white/40'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Logout */}
            <div className="p-4 border-t border-white/5">
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b border-white/5 bg-[#0a0a0b] flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-white/60 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-lg font-bold text-[#D4AF37]">TradeITM</span>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

// Re-export hook for convenience
export { useMemberAuth, useMemberAuth as useMemberSession } from '@/contexts/MemberAuthContext'
