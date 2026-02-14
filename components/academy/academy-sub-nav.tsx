'use client'

import {
  Bookmark,
  House,
  LibraryBig,
  CirclePlay,
  RotateCcw,
} from 'lucide-react'
import { FeatureSubNav, type FeatureSubNavItem } from '@/components/members/feature-sub-nav'

const ACADEMY_NAV_ITEMS: FeatureSubNavItem[] = [
  { id: 'home', label: 'Home', href: '/members/academy', icon: House },
  {
    id: 'courses',
    label: 'Courses',
    href: '/members/academy/courses',
    icon: LibraryBig,
    match: (pathname) => (
      pathname === '/members/academy/courses'
      || pathname === '/members/library'
      || pathname.startsWith('/members/academy/courses/')
      || pathname.startsWith('/members/academy/learn/')
    ),
  },
  { id: 'continue', label: 'Continue', href: '/members/academy/continue', icon: CirclePlay },
  { id: 'review', label: 'Review', href: '/members/academy/review', icon: RotateCcw },
  { id: 'saved', label: 'Saved', href: '/members/academy/saved', icon: Bookmark },
]

export function AcademySubNav() {
  return <FeatureSubNav items={ACADEMY_NAV_ITEMS} />
}
