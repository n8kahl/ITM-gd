'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Analytics } from '@/lib/analytics'

export interface FeatureSubNavItem {
  id: string
  label: string
  href: string
  icon?: ComponentType<{ className?: string }>
  match?: (pathname: string) => boolean
}

interface FeatureSubNavProps {
  items: FeatureSubNavItem[]
  className?: string
  stickyOffsetClassName?: string
}

function isItemActive(pathname: string, item: FeatureSubNavItem): boolean {
  if (item.match) return item.match(pathname)
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function FeatureSubNav({
  items,
  className,
  stickyOffsetClassName = 'top-[var(--members-topbar-h)] lg:top-0',
}: FeatureSubNavProps) {
  const pathname = usePathname()

  if (!items.length) return null

  const handleNavItemClick = (label: string) => {
    try {
      void Analytics.trackMemberNavItem(label)
    } catch (error) {
      console.error('Failed to track member nav item click:', error)
    }
  }

  return (
    <div className={cn('sticky z-30 mb-4 lg:mb-6', stickyOffsetClassName, className)}>
      <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/85 backdrop-blur-xl px-2 py-2">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {items.map((item) => {
            const active = isItemActive(pathname, item)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => handleNavItemClick(item.label)}
                className={cn(
                  'group shrink-0 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                    : 'text-white/70 border border-transparent hover:text-white/95 hover:bg-white/[0.06]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
