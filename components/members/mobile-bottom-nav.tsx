'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  GraduationCap,
  Ellipsis,
  UserCircle,
  Settings,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

interface NavTab {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

const PRIMARY_TABS: NavTab[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/members', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', href: '/members/journal', icon: BookOpen },
  { id: 'ai-coach', label: 'AI Coach', href: '/members/ai-coach', icon: Bot },
  { id: 'library', label: 'Library', href: '/members/academy/courses', icon: GraduationCap },
]

function isLibraryPath(pathname: string): boolean {
  return pathname === '/members/library' || pathname.startsWith('/members/academy')
}

function isActivePath(pathname: string, tab: NavTab): boolean {
  const { href, id } = tab
  if (id === 'library') {
    return pathname === href || pathname.startsWith(`${href}/`) || isLibraryPath(pathname)
  }

  if (href === '/members') return pathname === '/members'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

export function MemberBottomNav() {
  const pathname = usePathname()
  const { syncDiscordRoles } = useMemberAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [syncingRoles, setSyncingRoles] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!moreMenuRef.current) return
      if (moreMenuRef.current.contains(event.target as Node)) return
      setMoreOpen(false)
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [])

  const handleSyncRoles = async () => {
    if (syncingRoles) return
    setSyncingRoles(true)
    triggerHaptic()

    try {
      const result = await syncDiscordRoles()
      if (!result) {
        toast.info('Sync already in progress. Please wait a moment.')
      } else if (result.success) {
        toast.success('Discord roles synced')
      } else {
        toast.error('Failed to sync roles')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync roles')
    } finally {
      setSyncingRoles(false)
      setMoreOpen(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <nav className="bg-[#0A0A0B]/98 backdrop-blur-[24px] border-t border-white/[0.06] px-2 pt-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="flex items-end justify-around gap-1">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon
            const active = isActivePath(pathname, tab)
            return (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={triggerHaptic}
                className="relative flex-1 max-w-[84px] flex flex-col items-center justify-center py-1.5"
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="member-mobile-active"
                    className="absolute -top-1 h-0.5 w-8 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  />
                )}

                <span className={cn(
                  'inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
                  active ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground',
                )}>
                  <Icon className="w-5 h-5" />
                </span>

                <span className={cn(
                  'text-[10px] font-medium mt-0.5 leading-none transition-colors',
                  active ? 'text-emerald-300' : 'text-muted-foreground',
                )}>
                  {tab.label}
                </span>
              </Link>
            )
          })}

          <div ref={moreMenuRef} className="relative flex-1 max-w-[84px] flex flex-col items-center justify-center py-1.5">
            <button
              type="button"
              onClick={() => {
                triggerHaptic()
                setMoreOpen((prev) => !prev)
              }}
              className={cn(
                'relative flex flex-col items-center justify-center w-full',
                moreOpen && 'text-emerald-300',
              )}
              aria-label="Open more menu"
              aria-expanded={moreOpen}
            >
              {moreOpen && <span className="absolute -top-1 h-0.5 w-8 rounded-full bg-emerald-400" />}
              <span className={cn(
                'inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
                moreOpen ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground',
              )}>
                <Ellipsis className="w-5 h-5" />
              </span>
              <span className={cn(
                'text-[10px] font-medium mt-0.5 leading-none transition-colors',
                moreOpen ? 'text-emerald-300' : 'text-muted-foreground',
              )}>
                More
              </span>
            </button>

            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute bottom-[calc(100%+0.6rem)] right-0 w-44 rounded-xl border border-white/[0.1] bg-[#0D0D0E]/98 backdrop-blur-xl p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.4)]"
                >
                  <Link
                    href="/members/profile"
                    onClick={triggerHaptic}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ivory/85 hover:bg-white/[0.06]"
                  >
                    <UserCircle className="w-4 h-4 text-emerald-300" />
                    Profile
                  </Link>

                  <Link
                    href="/members/profile?view=settings"
                    onClick={triggerHaptic}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ivory/85 hover:bg-white/[0.06]"
                  >
                    <Settings className="w-4 h-4 text-emerald-300" />
                    Settings
                  </Link>

                  <button
                    type="button"
                    onClick={handleSyncRoles}
                    disabled={syncingRoles}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-ivory/85 hover:bg-white/[0.06] disabled:opacity-55"
                  >
                    <RefreshCw className={cn('w-4 h-4 text-emerald-300', syncingRoles && 'animate-spin')} />
                    {syncingRoles ? 'Syncing Roles...' : 'Sync Roles'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </div>
  )
}
