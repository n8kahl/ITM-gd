'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

interface MobileTopBarProps {
  onMenuOpen: () => void
}

export function MobileTopBar({ onMenuOpen }: MobileTopBarProps) {
  const { profile } = useMemberAuth()

  return (
    <header className="sticky top-0 z-40 lg:hidden h-14 flex items-center justify-between px-4 bg-[#0A0A0B]/95 backdrop-blur-[20px] border-b border-white/[0.06]">
      {/* Hamburger */}
      <button
        onClick={onMenuOpen}
        className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-ivory hover:bg-white/5 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo */}
      <Link href="/members" className="absolute left-1/2 -translate-x-1/2">
        <div className="relative w-6 h-6">
          <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
        </div>
      </Link>

      {/* Avatar */}
      <Link href="/members/profile" className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
          {profile?.discord_avatar ? (
            <img
              src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png`}
              alt={profile.discord_username || 'User'}
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
    </header>
  )
}
