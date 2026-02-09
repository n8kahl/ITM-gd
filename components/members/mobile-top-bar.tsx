'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

export function MobileTopBar() {
  const { profile } = useMemberAuth()

  return (
    <header className="sticky top-0 z-40 lg:hidden h-14 flex items-center justify-between px-4 bg-[#0A0A0B]/95 backdrop-blur-[20px] border-b border-white/[0.06]">
      <div className="w-8 h-8" />

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
    </header>
  )
}
