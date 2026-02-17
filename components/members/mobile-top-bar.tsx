'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { getMemberFallbackTitle, getMemberTabHref, isMemberTabActive, resolveMemberTabLabel } from '@/lib/member-navigation'

function isTabRootPath(pathname: string, tabPath: string): boolean {
  if (tabPath === '/members/academy-v3') {
    return (
      pathname === '/members/library' ||
      pathname === '/members/academy-v3' ||
      pathname.startsWith('/members/academy-v3')
    )
  }
  return pathname === tabPath
}

export function MobileTopBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, getVisibleTabs } = useMemberAuth()

  const visibleTabs = getVisibleTabs()
  const activeTab = visibleTabs.find((tab) => isMemberTabActive(pathname, tab))
  const activeTabHref = activeTab ? getMemberTabHref(activeTab) : '/members'
  const showBackButton = activeTab ? !isTabRootPath(pathname, activeTabHref) : pathname !== '/members'
  const title = activeTab ? resolveMemberTabLabel(activeTab) : getMemberFallbackTitle(pathname)

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push(activeTabHref)
  }

  return (
    <header className="sticky top-0 z-40 lg:hidden h-14 flex items-center justify-between px-3 bg-[#0A0A0B]/95 backdrop-blur-[20px] border-b border-white/[0.06]">
      <div className="w-10 flex items-center justify-start">
        {showBackButton ? (
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]"
            aria-label="Go back"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 px-2 text-center">
        <p className="truncate text-sm font-semibold tracking-tight text-ivory">{title}</p>
      </div>

      <div className="w-10 flex items-center justify-end">
        <Link href="/members/profile" className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
            {profile?.discord_avatar ? (
              <Image
                src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
                alt={profile.discord_username || 'User'}
                width={32}
                height={32}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">
                  {(profile?.discord_username || 'U')[0].toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </header>
  )
}
