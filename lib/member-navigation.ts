import {
  Bot,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Palette,
  Target,
  type LucideIcon,
  UserCircle,
  Users,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'

type MemberTabLike = {
  tab_id: string
  label: string
  path: string
  icon?: string | null
}

const TAB_ID_ICON_MAP: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  journal: BookOpen,
  'spx-command-center': Target,
  'ai-coach': Bot,
  library: GraduationCap,
  social: Users,
  studio: Palette,
  profile: UserCircle,
}

function asLucideIcon(value: unknown): LucideIcon | null {
  if (typeof value === 'function') {
    return value as LucideIcon
  }
  return null
}

export function resolveMemberTabLabel(tab: Pick<MemberTabLike, 'tab_id' | 'label'>): string {
  if (tab.tab_id === 'library' && /library/i.test(tab.label)) {
    return 'Academy'
  }
  return tab.label
}

export function getMemberTabHref(tab: Pick<MemberTabLike, 'tab_id' | 'path'>): string {
  const rawHref = tab.path.startsWith('/') ? tab.path : `/members/${tab.path}`
  if (
    tab.tab_id === 'library' &&
    (
      rawHref === '/members/library' ||
      rawHref === '/members/academy-v3' ||
      rawHref === '/members/academy-v3/modules' ||
      rawHref === '/members/academy/modules'
    )
  ) {
    return '/members/academy'
  }
  return rawHref
}

export function isMemberTabActive(pathname: string, tab: Pick<MemberTabLike, 'tab_id' | 'path'>): boolean {
  const href = getMemberTabHref(tab)
  if (tab.tab_id === 'library') {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname === '/members/library' ||
      pathname.startsWith('/members/academy') ||
      pathname.startsWith('/members/academy-v3')
    )
  }

  if (href === '/members') return pathname === '/members'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getMemberTabIcon(tab: Pick<MemberTabLike, 'tab_id' | 'icon'>): LucideIcon {
  if (tab.icon) {
    const dynamic = asLucideIcon((LucideIcons as Record<string, unknown>)[tab.icon])
    if (dynamic) return dynamic
  }

  return TAB_ID_ICON_MAP[tab.tab_id] ?? LayoutDashboard
}

export function getMemberSectionPath(pathname: string): string {
  if (pathname === '/members') return '/members'
  if (
    pathname === '/members/library' ||
    pathname.startsWith('/members/academy') ||
    pathname.startsWith('/members/academy-v3')
  ) {
    return '/members/academy'
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length >= 2 && segments[0] === 'members') {
    return `/${segments.slice(0, 2).join('/')}`
  }

  return pathname
}

export function getMemberFallbackTitle(pathname: string): string {
  if (pathname === '/members') return 'Dashboard'
  if (
    pathname.startsWith('/members/academy') ||
    pathname.startsWith('/members/academy-v3') ||
    pathname.startsWith('/members/library')
  ) {
    return 'Academy'
  }
  if (pathname.startsWith('/members/journal')) return 'Journal'
  if (pathname.startsWith('/members/spx-command-center')) return 'SPX Command Center'
  if (pathname.startsWith('/members/ai-coach')) return 'AI Coach'
  if (pathname.startsWith('/members/social')) return 'Social'
  if (pathname.startsWith('/members/studio')) return 'Studio'
  if (pathname.startsWith('/members/profile')) return 'Profile'
  return 'Members'
}
