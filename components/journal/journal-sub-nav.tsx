'use client'

import { BookOpen, BarChart3 } from 'lucide-react'
import { FeatureSubNav, type FeatureSubNavItem } from '@/components/members/feature-sub-nav'

const JOURNAL_NAV_ITEMS: FeatureSubNavItem[] = [
  { id: 'entries', label: 'Entries', href: '/members/journal', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', href: '/members/journal/analytics', icon: BarChart3 },
]

export function JournalSubNav() {
  return <FeatureSubNav items={JOURNAL_NAV_ITEMS} stickyOffsetClassName="top-[var(--members-topbar-h)] lg:top-0" />
}
