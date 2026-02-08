'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  GraduationCap,
  Palette,
  UserCircle,
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

export function MemberBottomNav() {
  const pathname = usePathname()
  const { getMobileTabs } = useMemberAuth()
  const mobileTabs = getMobileTabs()

  if (!mobileTabs.length) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <nav className="bg-[#0A0A0B]/98 backdrop-blur-[20px] border-t border-white/[0.06] px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around">
          {mobileTabs.map((tab) => {
            const Icon = ICON_MAP[tab.tab_id] || LayoutDashboard
            const href = tab.path.startsWith('/') ? tab.path : `/members/${tab.path}`
            const isActive = pathname === href || (href !== '/members' && pathname.startsWith(href))

            return (
              <Link
                key={tab.tab_id}
                href={href}
                className="relative flex flex-col items-center justify-center min-w-[56px] py-1.5 group"
                onClick={() => {
                  // Haptic feedback
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(10)
                  }
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-tab"
                    className="absolute -top-2 w-8 h-0.5 rounded-full bg-emerald-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                <Icon className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-muted-foreground'
                )} />

                <span className={cn(
                  'text-[10px] font-medium mt-0.5 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-muted-foreground'
                )}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
