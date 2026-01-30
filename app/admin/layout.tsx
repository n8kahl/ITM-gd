'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Users,
  BarChart3,
  LogOut,
  Bell,
  BellOff
} from 'lucide-react'
import { subscribeToPush, unsubscribeFromPush, checkPushSubscription, isPushSupported } from '@/lib/notifications'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)

  // Check admin access using Supabase Auth
  useEffect(() => {
    const checkAuth = async () => {
      // For now, allow access if user is in team_members table
      // TODO: Implement proper Supabase Auth login flow
      const cookies = document.cookie.split(';')
      const adminCookie = cookies.find(c => c.trim().startsWith('titm_admin='))

      if (adminCookie?.includes('true')) {
        setIsAuthenticated(true)
        return
      }

      // If no cookie, redirect to home
      router.push('/')
    }

    checkAuth()
  }, [router])

  // Check push notification support and status
  useEffect(() => {
    const checkPushStatus = async () => {
      const supported = await isPushSupported()
      setPushSupported(supported)

      if (supported) {
        const enabled = await checkPushSubscription()
        setNotificationsEnabled(enabled)
      }
    }

    checkPushStatus()
  }, [])

  const handleLogout = () => {
    document.cookie = 'titm_admin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/')
  }

  const toggleNotifications = async () => {
    try {
      if (notificationsEnabled) {
        // Disable notifications
        await unsubscribeFromPush('admin')
        setNotificationsEnabled(false)
        alert('Push notifications disabled')
      } else {
        // Enable notifications
        const success = await subscribeToPush('admin')
        if (success) {
          setNotificationsEnabled(true)
          alert('Push notifications enabled! You\'ll receive alerts when chats are escalated.')
        } else {
          alert('Failed to enable notifications. Please check your browser settings.')
        }
      }
    } catch (error) {
      console.error('Notification toggle error:', error)
      alert('Failed to toggle notifications. Please try again.')
    }
  }

  if (!isAuthenticated) {
    return null
  }

  const navigation = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Chat Conversations', href: '/admin/chat', icon: MessageSquare },
    { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen },
    { name: 'Team Members', href: '/admin/team', icon: Users },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-emerald-500" />
              <span className="text-xl font-bold text-gradient-champagne">
                TradeITM Admin
              </span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'text-platinum/60 hover:text-ivory hover:bg-accent/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Notifications & Logout */}
            <div className="flex items-center gap-2">
              {pushSupported && (
                <button
                  onClick={toggleNotifications}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    notificationsEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-platinum/60 hover:text-ivory hover:bg-accent/10'
                  }`}
                  title={notificationsEnabled ? 'Disable push notifications' : 'Enable push notifications'}
                >
                  {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  <span className="hidden md:inline">
                    {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                  </span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-platinum/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-border/40 bg-background/95 backdrop-blur sticky top-16 z-40">
        <div className="px-4 py-2 overflow-x-auto">
          <nav className="flex items-center gap-2 whitespace-nowrap">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-platinum/60 hover:text-ivory hover:bg-accent/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
