'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
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
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/members', icon: LayoutDashboard },
  { name: 'Course Library', href: '/members/library', icon: BookOpen },
  { name: 'Trade Journal', href: '/members/journal', icon: Notebook, badge: 'New' },
  { name: 'Achievements', href: '/members/achievements', icon: Trophy, badge: 'Soon' },
  { name: 'Profile', href: '/members/profile', icon: User },
  { name: 'Settings', href: '/members/settings', icon: Settings },
]

// Mock user session - in real app, this comes from Discord OAuth
interface UserSession {
  id: string
  name: string
  avatar: string
  discord_roles: string[]
  membership_tier: 'core' | 'pro' | 'execute' | null
}

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)

  // Check authentication - in real app, verify Discord OAuth session
  useEffect(() => {
    const checkAuth = async () => {
      // For demo: Check if user has a member session cookie
      const cookies = document.cookie.split(';')
      const memberCookie = cookies.find(c => c.trim().startsWith('titm_member='))

      if (memberCookie) {
        // Parse session data from cookie (in real app: fetch from API)
        try {
          const sessionData = JSON.parse(decodeURIComponent(memberCookie.split('=')[1]))
          setUser(sessionData)
        } catch {
          // Invalid cookie, use demo user
          setUser({
            id: 'demo_user',
            name: 'Demo Trader',
            avatar: '',
            discord_roles: ['core_sniper'],
            membership_tier: 'core',
          })
        }
      } else {
        // No session - for demo, create a temporary user
        // In production, redirect to login
        setUser({
          id: 'demo_user',
          name: 'Demo Trader',
          avatar: '',
          discord_roles: ['core_sniper'],
          membership_tier: 'core',
        })
      }

      setLoading(false)
    }

    checkAuth()
  }, [router])

  const handleLogout = () => {
    document.cookie = 'titm_member=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-[#D4AF37] mx-auto mb-4 animate-pulse" />
          <p className="text-white/60">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

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
        {user && (
          <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
                ) : (
                  <User className="w-5 h-5 text-[#D4AF37]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-[#D4AF37] capitalize">{user.membership_tier || 'Free'} Member</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
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
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-white/40">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-4 h-4 text-[#D4AF37]/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
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
            {/* Same content as desktop sidebar */}
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

            {user && (
              <div className="p-4 mx-4 mt-4 rounded-xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#D4AF37]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{user.name}</p>
                    <p className="text-xs text-[#D4AF37] capitalize">{user.membership_tier || 'Free'} Member</p>
                  </div>
                </div>
              </div>
            )}

            <nav className="flex-1 p-4 space-y-1">
              {navigation.map((item) => {
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
                      <span className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-white/40">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>

            <div className="p-4 border-t border-white/5">
              <button
                onClick={handleLogout}
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

// Export user context hook for child components
export function useMemberSession() {
  // In real app, this would be a React context
  // For now, components can read from cookie or use a default
  return {
    id: 'demo_user',
    name: 'Demo Trader',
    avatar: '',
    discord_roles: ['core_sniper'],
    membership_tier: 'core' as const,
  }
}
