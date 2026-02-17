'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  Bot,
  Ellipsis,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { Analytics } from '@/lib/analytics'
import {
  getMemberTabHref,
  getMemberTabIcon,
  isMemberTabActive,
  resolveMemberTabLabel,
} from '@/lib/member-navigation'

interface NavTab {
  id: string
  label: string
  href: string
  icon: LucideIcon
  tabId?: string
}

const PRIMARY_LIMIT = 4

const PRIMARY_TABS: NavTab[] = [
  { id: 'dashboard', tabId: 'dashboard', label: 'Dashboard', href: '/members', icon: LayoutDashboard },
  { id: 'journal', tabId: 'journal', label: 'Journal', href: '/members/journal', icon: BookOpen },
  { id: 'ai-coach', tabId: 'ai-coach', label: 'AI Coach', href: '/members/ai-coach', icon: Bot },
  { id: 'library', tabId: 'library', label: 'Academy', href: '/members/academy-v3', icon: GraduationCap },
]

function isActivePath(pathname: string, tab: NavTab): boolean {
  if (tab.tabId) {
    return isMemberTabActive(pathname, {
      tab_id: tab.tabId,
      path: tab.href,
    })
  }

  if (tab.href === '/members') return pathname === '/members'
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(10)
  }
}

export function MemberBottomNav() {
  const pathname = usePathname()
  const { getMobileTabs } = useMemberAuth()
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const moreOpen = moreOpenPath === pathname

  const dynamicTabs = getMobileTabs?.() ?? []
  const mappedDynamicTabs: NavTab[] = dynamicTabs.map((tab) => ({
    id: tab.tab_id,
    tabId: tab.tab_id,
    label: resolveMemberTabLabel(tab),
    href: getMemberTabHref(tab),
    icon: getMemberTabIcon(tab),
  }))
  const allTabs = mappedDynamicTabs.length > 0 ? mappedDynamicTabs : PRIMARY_TABS
  const primaryTabs = allTabs.slice(0, PRIMARY_LIMIT)
  const overflowTabs = allTabs.slice(PRIMARY_LIMIT)
  const moreItems = overflowTabs
  const showMoreButton = moreItems.length > 0
  const isMoreActive = showMoreButton && moreItems.some((item) => isActivePath(pathname, item))

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!moreMenuRef.current) return
      if (moreMenuRef.current.contains(event.target as Node)) return
      setMoreOpenPath(null)
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => document.removeEventListener('mousedown', handleClickAway)
  }, [])

  return (
    <div className="fixed bottom-6 left-4 right-4 z-40 lg:hidden">
      <nav className="glass-card-heavy rounded-2xl border border-white/10 shadow-2xl px-2 pt-2 pb-safe">
        <div className="flex items-end justify-around gap-1">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon
            const active = isActivePath(pathname, tab)
            return (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={() => {
                  triggerHaptic()
                  Analytics.trackMemberNavItem(tab.label)
                  setMoreOpenPath(null)
                }}
                className="relative flex-1 max-w-[84px] flex flex-col items-center justify-center py-1.5"
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="member-mobile-active"
                    className="absolute -top-1 h-0.5 w-8 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  />
                )}

                {active && (
                  <motion.div
                    layoutId="member-mobile-active-glow"
                    className="pointer-events-none absolute inset-x-2 bottom-5 h-8 rounded-full bg-emerald-500/10 blur-lg"
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                  />
                )}

                <motion.span
                  animate={active ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 0.22 }}
                  className={cn(
                    'relative inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
                    active ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground',
                  )}
                >
                  <Icon strokeWidth={1.5} className={cn('w-5 h-5 transition-all', active && 'fill-current')} />
                </motion.span>

                <span
                  className={cn(
                    'text-[10px] mt-0.5 leading-none transition-colors',
                    active ? 'font-bold text-emerald-300' : 'font-normal text-muted-foreground',
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}

          {showMoreButton ? (
            <div ref={moreMenuRef} className="relative flex-1 max-w-[84px] flex flex-col items-center justify-center py-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic()
                  setMoreOpenPath((prev) => (prev === pathname ? null : pathname))
                }}
                className={cn(
                  'relative flex flex-col items-center justify-center w-full',
                  (moreOpen || isMoreActive) && 'text-emerald-300',
                )}
                aria-label="Open more menu"
                aria-expanded={moreOpen}
              >
                {(moreOpen || isMoreActive) && <span className="absolute -top-1 h-0.5 w-8 rounded-full bg-emerald-400" />}
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
                    moreOpen || isMoreActive ? 'bg-emerald-500/20 text-emerald-300' : 'text-muted-foreground',
                  )}
                >
                  <Ellipsis strokeWidth={1.5} className="w-5 h-5" />
                </span>
                <span
                  className={cn(
                    'text-[10px] mt-0.5 leading-none transition-colors',
                    moreOpen || isMoreActive ? 'font-bold text-emerald-300' : 'font-normal text-muted-foreground',
                  )}
                >
                  More
                </span>
              </button>

              <AnimatePresence>
                {moreOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute bottom-[calc(100%+0.6rem)] right-0 w-48 rounded-xl border border-white/[0.1] bg-[#0D0D0E]/98 backdrop-blur-xl p-1.5 shadow-[0_20px_45px_rgba(0,0,0,0.4)]"
                  >
                    {moreItems.map((item) => {
                      const ItemIcon = item.icon
                      const active = isActivePath(pathname, item)
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => {
                            triggerHaptic()
                            Analytics.trackMemberNavItem(item.label)
                            setMoreOpenPath(null)
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-white/[0.06]',
                            active ? 'bg-emerald-500/10 text-emerald-200' : 'text-ivory/85',
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          <ItemIcon strokeWidth={1.5} className="w-4 h-4 text-emerald-300" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </nav>
    </div>
  )
}
