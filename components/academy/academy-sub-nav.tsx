'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  House,
  LibraryBig,
  CirclePlay,
  RotateCcw,
  Bookmark,
  type LucideIcon,
} from 'lucide-react'

interface AcademyNavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

const ACADEMY_NAV_ITEMS: AcademyNavItem[] = [
  { id: 'home', label: 'Home', href: '/members/academy', icon: House },
  { id: 'library', label: 'Library', href: '/members/academy/courses', icon: LibraryBig },
  { id: 'continue', label: 'Continue', href: '/members/academy/continue', icon: CirclePlay },
  { id: 'review', label: 'Review Queue', href: '/members/academy/review', icon: RotateCcw },
  { id: 'saved', label: 'Saved', href: '/members/academy/saved', icon: Bookmark },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/members/academy') {
    return pathname === href
  }

  if (href === '/members/academy/courses') {
    return (
      pathname === href ||
      pathname.startsWith('/members/academy/courses/') ||
      pathname.startsWith('/members/academy/learn/')
    )
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AcademySubNav() {
  const pathname = usePathname()

  return (
    <div className="sticky top-14 lg:top-0 z-30 mb-4 lg:mb-6">
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-[#0A0A0B]/85 backdrop-blur-xl',
          'px-2 py-2'
        )}
      >
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {ACADEMY_NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'group shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    : 'text-white/55 border border-transparent hover:text-white/85 hover:bg-white/[0.04]'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
