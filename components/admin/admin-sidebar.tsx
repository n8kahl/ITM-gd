/* components/admin/admin-sidebar.tsx */
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, MessageSquare, GraduationCap,
  BookOpen, Notebook, ShieldAlert, Tag, Sliders, Activity,
  ChevronRight, LogOut, Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Command Center', href: '/admin', icon: LayoutDashboard },
  {
    group: 'Growth & Sales',
    items: [
      { name: 'Leads Pipeline', href: '/admin/leads', icon: Users },
      { name: 'Live Chat', href: '/admin/chat', icon: MessageSquare },
      { name: 'Packages', href: '/admin/packages', icon: Tag },
    ]
  },
  {
    group: 'Product & Content',
    items: [
      { name: 'Course Library', href: '/admin/courses', icon: GraduationCap },
      { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen },
      { name: 'Journal Config', href: '/admin/journal', icon: Notebook },
    ]
  },
  {
    group: 'System',
    items: [
      { name: 'Analytics', href: '/admin/analytics', icon: Activity },
      { name: 'RBAC & Roles', href: '/admin/roles', icon: ShieldAlert },
      { name: 'Settings', href: '/admin/settings', icon: Sliders },
    ]
  },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#8a7020] flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.3)]">
             <Sparkles className="w-4 h-4 text-[#0A0A0B]" />
           </div>
           <div>
             <span className="text-base font-bold text-white tracking-tight">TradeITM</span>
             <span className="text-[10px] text-[#D4AF37] block font-mono tracking-widest uppercase">Nexus Terminal</span>
           </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Dashboard Link */}
        <NavItem
          item={navigation[0]}
          isActive={pathname === navigation[0].href}
        />

        {/* Groups */}
        {navigation.slice(1).map((group: any) => (
          <div key={group.group}>
            <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/20 font-mono">
              {group.group}
            </h3>
            <div className="space-y-1">
              {group.items.map((item: any) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={pathname.startsWith(item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer User Profile */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-xs font-bold text-white">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Administrator</p>
            <p className="text-xs text-white/40 truncate">System Access</p>
          </div>
          <button className="text-white/40 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function NavItem({ item, isActive }: { item: any, isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden',
        isActive
          ? 'text-white bg-white/5 border border-white/10'
          : 'text-white/50 hover:text-white hover:bg-white/5'
      )}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <div className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.5)]" />
      )}

      <Icon className={cn(
        "w-4 h-4 transition-colors",
        isActive ? "text-[#D4AF37]" : "text-white/40 group-hover:text-white/60"
      )} />

      <span className="flex-1">{item.name}</span>

      {isActive && <ChevronRight className="w-3 h-3 text-white/20" />}
    </Link>
  )
}

// Needed for layout export compatibility
export function AdminMobileNav() { return null }
