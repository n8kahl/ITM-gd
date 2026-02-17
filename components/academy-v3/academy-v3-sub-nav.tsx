'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/members/academy-v3', label: 'Plan' },
  { href: '/members/academy-v3/modules', label: 'Modules' },
  { href: '/members/academy-v3/review', label: 'Review' },
  { href: '/members/academy-v3/progress', label: 'Progress' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/members/academy-v3') {
    return pathname === href
  }

  return pathname.startsWith(href)
}

export function AcademyV3SubNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-[var(--members-topbar-h)] z-20 mb-6 border border-white/10 bg-[#111318]/90 backdrop-blur-sm">
      <ul className="flex items-center gap-2 overflow-x-auto px-3 py-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
