'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  // Operations
  Users,
  UserCheck,
  MessageSquare,
  // Product
  BookOpen,
  GraduationCap,
  Notebook,
  // System
  Shield,
  Settings,
  BarChart3,
  Tag,
  LayoutDashboard,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
  name: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    name: 'Operations',
    items: [
      { name: 'Leads', href: '/admin/leads', icon: UserCheck },
      { name: 'Chat', href: '/admin/chat', icon: MessageSquare },
      { name: 'Team', href: '/admin/team', icon: Users },
    ],
  },
  {
    name: 'Product',
    items: [
      { name: 'Courses', href: '/admin/courses', icon: GraduationCap },
      { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen },
      { name: 'Journal Config', href: '/admin/journal', icon: Notebook },
    ],
  },
  {
    name: 'System',
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { name: 'Packages', href: '/admin/packages', icon: Tag },
      { name: 'Roles', href: '/admin/roles', icon: Shield },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 min-h-screen bg-[#0a0a0b] border-r border-white/5 flex flex-col">
      {/* Logo Header */}
      <div className="p-6 border-b border-white/5">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-black" />
          </div>
          <div>
            <span className="text-lg font-bold text-[#D4AF37]">TradeITM</span>
            <span className="text-xs text-white/40 block">Admin Console</span>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navigation.map((group) => (
          <div key={group.name}>
            {/* Group Label */}
            <h3 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              {group.name}
            </h3>

            {/* Group Items */}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <li key={item.name}>
                    <Link
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
                      {isActive && (
                        <ChevronRight className="w-4 h-4 text-[#D4AF37]/60" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <div className="px-3 py-2 rounded-lg bg-white/5">
          <p className="text-xs text-white/40">
            Nexus Admin v1.0
          </p>
        </div>
      </div>
    </aside>
  )
}

// Mobile navigation for responsive design
export function AdminMobileNav() {
  const pathname = usePathname()

  // Flatten all items for mobile
  const allItems = navigation.flatMap(g => g.items)

  return (
    <nav className="flex items-center gap-1 px-4 py-2 overflow-x-auto whitespace-nowrap bg-[#0a0a0b] border-b border-white/5">
      {allItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
              isActive
                ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-4 h-4" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
