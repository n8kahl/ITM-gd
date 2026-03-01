'use client'

import { BookOpen, Crosshair, GraduationCap, Target } from 'lucide-react'

import { FeatureSubNav, type FeatureSubNavItem } from '@/components/members/feature-sub-nav'

const ITEMS: FeatureSubNavItem[] = [
  {
    id: 'overview',
    href: '/members/mentorship',
    label: 'Program Overview',
    icon: GraduationCap,
    match: (pathname) => pathname === '/members/mentorship',
  },
  {
    id: 'week-1',
    href: '/members/mentorship/week-1',
    label: 'Week 1',
    icon: Target,
  },
  {
    id: 'journal-guide',
    href: '/members/mentorship/week-1/journal-guide',
    label: 'Journal Guide',
    icon: BookOpen,
  },
  {
    id: 'resources',
    href: '/members/mentorship/resources',
    label: 'Resources',
    icon: Crosshair,
  },
]

export function MentorshipSubNav() {
  return <FeatureSubNav items={ITEMS} stickyOffsetClassName="top-[var(--members-topbar-h)] lg:top-0" />
}
