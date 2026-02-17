'use client'

import { BarChart3, BookOpen, CheckCircle2, Compass } from 'lucide-react'
import { FeatureSubNav, type FeatureSubNavItem } from '@/components/members/feature-sub-nav'

const ITEMS: FeatureSubNavItem[] = [
  {
    id: 'plan',
    href: '/members/academy-v3',
    label: 'Plan',
    icon: Compass,
    match: (pathname) => pathname === '/members/academy-v3',
  },
  {
    id: 'modules',
    href: '/members/academy-v3/modules',
    label: 'Modules',
    icon: BookOpen,
  },
  {
    id: 'review',
    href: '/members/academy-v3/review',
    label: 'Review',
    icon: CheckCircle2,
  },
  {
    id: 'progress',
    href: '/members/academy-v3/progress',
    label: 'Progress',
    icon: BarChart3,
  },
]

export function AcademyV3SubNav() {
  return <FeatureSubNav items={ITEMS} stickyOffsetClassName="top-[var(--members-topbar-h)] lg:top-0" />
}
