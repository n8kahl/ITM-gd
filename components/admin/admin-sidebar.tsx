/* components/admin/admin-sidebar.tsx */
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Users, MessageSquare, GraduationCap, BookOpen,
  ClipboardCheck, Shield, ShieldAlert, Tag, Sliders, Activity, PanelTop,
  ChevronRight, LogOut, Wand2, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'
import { createBrowserSupabase } from '@/lib/supabase-browser'

interface NavItemModel {
  name: string
  href: string
  icon: LucideIcon
  badge?: number
}

interface NavGroupModel {
  group: string
  items: NavItemModel[]
}

function isMissingCoachReviewTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code ?? '').toUpperCase()
  if (code === '42P01' || code === 'PGRST205') return true
  const message = String(error.message ?? '').toLowerCase()
  return message.includes('coach_review_requests') && message.includes('does not exist')
}

function usePendingCoachReviewCount(): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createBrowserSupabase()

    const refreshCount = async () => {
      const { count: nextCount, error } = await supabase
        .from('coach_review_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (!mounted) return

      if (error) {
        if (isMissingCoachReviewTable(error)) {
          setCount(null)
          return
        }
        console.error('[AdminSidebar] Failed to load coach review pending count:', error.message)
        return
      }

      setCount(nextCount ?? 0)
    }

    void refreshCount()

    const channel = supabase
      .channel('admin-trade-review-pending-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'coach_review_requests' },
        () => { void refreshCount() },
      )
      .subscribe()

    const pollId = window.setInterval(() => { void refreshCount() }, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshCount()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(pollId)
      void supabase.removeChannel(channel)
    }
  }, [])

  return count
}

export function AdminSidebar() {
  const pathname = usePathname()
  const pendingCount = usePendingCoachReviewCount()

  const navigation = useMemo(() => {
    const productAndContent: NavGroupModel = {
      group: 'Product & Content',
      items: [
        { name: 'Course Library', href: '/admin/courses', icon: GraduationCap },
        { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen },
        {
          name: 'Trade Review',
          href: '/admin/trade-review',
          icon: ClipboardCheck,
          badge: pendingCount != null && pendingCount > 0 ? pendingCount : undefined,
        },
        { name: 'Studio Hub', href: '/admin/studio', icon: Wand2 },
      ],
    }

    return {
      topItem: { name: 'Command Center', href: '/admin', icon: LayoutDashboard } as NavItemModel,
      groups: [
        {
          group: 'Growth & Sales',
          items: [
            { name: 'Leads Pipeline', href: '/admin/leads', icon: Users },
            { name: 'Notifications', href: '/admin/notifications', icon: Bell },
            { name: 'Live Chat', href: '/admin/chat', icon: MessageSquare },
            { name: 'Packages', href: '/admin/packages', icon: Tag },
          ],
        },
        productAndContent,
        {
          group: 'System',
          items: [
            { name: 'Analytics', href: '/admin/analytics', icon: Activity },
            { name: 'Member Access', href: '/admin/members-access', icon: ShieldAlert },
            { name: 'Role Permissions', href: '/admin/roles', icon: Shield },
            { name: 'Member Tabs', href: '/admin/tabs', icon: PanelTop },
            { name: 'Settings', href: '/admin/settings', icon: Sliders },
          ],
        },
      ] as NavGroupModel[],
    }
  }, [pendingCount])

  return (
    <div className="flex flex-col h-full">
      {/* Brand Header - UPDATED WITH LOGO */}
      <div className="h-16 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
           <div className="relative w-10 h-10">
             <Image
               src={BRAND_LOGO_SRC}
               alt={BRAND_NAME}
               fill
               className="object-contain"
             />
           </div>
           <div>
             <span className="text-base font-bold text-white tracking-tight">TradeITM</span>
             <span className="text-[10px] text-emerald-500 block tracking-widest uppercase font-medium">
               Admin Panel
             </span>
           </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        <NavItem
          item={navigation.topItem}
          isActive={pathname === navigation.topItem.href}
        />

        {navigation.groups.map((group) => (
          <div key={group.group}>
            <h3 className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-white/20">
              {group.group}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => (
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]">
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

function NavItem({ item, isActive }: { item: NavItemModel, isActive: boolean }) {
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
      {/* Active Indicator Line - UPDATED TO CHAMPAGNE */}
      {isActive && (
        <div className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-[#F3E5AB] shadow-[0_0_10px_rgba(243,229,171,0.5)]" />
      )}

      {/* Icon Color - UPDATED TO EMERALD */}
      <Icon className={cn(
        "w-4 h-4 transition-colors",
        isActive ? "text-emerald-400" : "text-white/40 group-hover:text-white/60"
      )} />

      <span className="flex-1">{item.name}</span>
      {typeof item.badge === 'number' && item.badge > 0 ? (
        <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}

      {isActive && <ChevronRight className="w-3 h-3 text-white/20" />}
    </Link>
  )
}

// Needed for layout export compatibility
export function AdminMobileNav() { return null }
