'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  LogOut,
  Bell,
  BellOff,
  Menu,
  X
} from 'lucide-react'
import { subscribeToPush, unsubscribeFromPush, checkPushSubscription, isPushSupported } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { AdminSidebar, AdminMobileNav } from '@/components/admin/admin-sidebar'
import { cn } from '@/lib/utils'

// Inner component that uses useSearchParams
function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Check admin access - supports cookie auth and magic link tokens
  useEffect(() => {
    const checkAuth = async () => {
      // Check existing cookie first
      const cookies = document.cookie.split(';')
      const adminCookie = cookies.find(c => c.trim().startsWith('titm_admin='))

      if (adminCookie?.includes('true')) {
        setIsAuthenticated(true)
        return
      }

      // Check for magic link token from Discord
      const token = searchParams.get('token')
      if (token) {
        // Verify token is valid (not expired, not used)
        const { data: tokenData, error } = await supabase
          .from('admin_access_tokens')
          .select('*')
          .eq('token', token)
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .single()

        if (tokenData && !error) {
          // Mark token as used
          await supabase
            .from('admin_access_tokens')
            .update({ used_at: new Date().toISOString() })
            .eq('id', tokenData.id)

          // Set auth cookie (24 hours)
          document.cookie = 'titm_admin=true; path=/; max-age=86400'
          setIsAuthenticated(true)

          // Remove token from URL for cleaner look (keep the id param)
          const convId = searchParams.get('id')
          if (convId) {
            router.replace(`${pathname}?id=${convId}`)
          }
          return
        }
      }

      // No valid auth, redirect to home
      router.push('/')
    }

    checkAuth()
  }, [router, searchParams, pathname])

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
        await unsubscribeFromPush('admin')
        setNotificationsEnabled(false)
      } else {
        const success = await subscribeToPush('admin')
        if (success) {
          setNotificationsEnabled(true)
        }
      }
    } catch (error) {
      console.error('Notification toggle error:', error)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#0f0f10] flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-64 z-50">
            <AdminSidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-white/5 bg-[#0a0a0b]/95 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Page Title - derived from pathname */}
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-white/90">
              {pathname === '/admin' ? 'Dashboard' :
               pathname.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h1>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden text-lg font-bold text-[#D4AF37]">
            TradeITM
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {pushSupported && (
              <button
                onClick={toggleNotifications}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  notificationsEnabled
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
                title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
              >
                {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {notificationsEnabled ? 'On' : 'Off'}
                </span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <AdminMobileNav />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

// Outer layout with Suspense boundary for useSearchParams
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={null}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  )
}
