'use client'

import { BarChart3, BookOpen, CheckCircle2, Compass } from 'lucide-react'

import { FeatureSubNav, type FeatureSubNavItem } from '@/components/members/feature-sub-nav'

const ITEMS: FeatureSubNavItem[] = [
  {
    id: 'dashboard',
    href: '/members/academy',
    label: 'Dashboard',
    icon: Compass,
    match: (pathname) => pathname === '/members/academy',
  },
  {
    id: 'modules',
    href: '/members/academy/modules',
    label: 'Modules',
    icon: BookOpen,
  },
  {
    id: 'review',
    href: '/members/academy/review',
    label: 'Review',
    icon: CheckCircle2,
  },
  {
    id: 'progress',
    href: '/members/academy/progress',
    label: 'Progress',
    icon: BarChart3,
  },
]

export function AcademySubNav() {
  return <FeatureSubNav items={ITEMS} stickyOffsetClassName="top-[var(--members-topbar-h)] lg:top-0" />
}
