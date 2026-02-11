'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Search, X, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TargetableUser } from '@/lib/types/notifications'

interface NotificationUserSearchProps {
  selectedUsers: Array<{ user_id: string; discord_username: string | null }>
  onSelect: (user: { user_id: string; discord_username: string | null }) => void
  onRemove: (userId: string) => void
}

function resolveDiscordAvatarUrl(
  avatar: string | null,
  discordUserId: string | null | undefined,
): string | null {
  if (!avatar) return null
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  if (!discordUserId) return null
  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.png?size=64`
}

export function NotificationUserSearch({
  selectedUsers,
  onSelect,
  onRemove,
}: NotificationUserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TargetableUser[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/notifications/search-users?q=${encodeURIComponent(q)}`)
      const data = await response.json()
      if (data.success) {
        setResults(data.data ?? [])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedIds = new Set(selectedUsers.map((u) => u.user_id))

  return (
    <div className="space-y-3">
      {/* Selected users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <span
              key={user.user_id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/30 text-emerald-300 text-xs font-medium border border-emerald-800/50"
            >
              @{user.discord_username || 'Unknown'}
              <button
                type="button"
                onClick={() => onRemove(user.user_id)}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search by Discord username..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
          )}
        </div>

        {/* Results dropdown */}
        {isOpen && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0D0D0E]/98 backdrop-blur-xl shadow-[0_20px_45px_rgba(0,0,0,0.4)]">
            {results.length === 0 && !loading && (
              <p className="px-4 py-3 text-sm text-white/40">No users found</p>
            )}

            {results.map((user) => {
              const isSelected = selectedIds.has(user.user_id)

              return (
                <button
                  key={user.user_id}
                  type="button"
                  disabled={isSelected || !user.has_subscription}
                  onClick={() => {
                    onSelect({
                      user_id: user.user_id,
                      discord_username: user.discord_username,
                    })
                    setQuery('')
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'opacity-40 cursor-not-allowed'
                      : !user.has_subscription
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-white/5 cursor-pointer',
                  )}
                >
                  {/* Avatar */}
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                    {resolveDiscordAvatarUrl(user.discord_avatar, user.discord_user_id) ? (
                      <Image
                        src={resolveDiscordAvatarUrl(user.discord_avatar, user.discord_user_id)!}
                        alt={user.discord_username || 'User'}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">
                          {(user.discord_username || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      @{user.discord_username || 'Unknown'}
                    </p>
                    <p className="text-xs text-white/40 truncate">
                      {user.user_id.slice(0, 8)}...
                    </p>
                  </div>

                  {/* Subscription status */}
                  {user.has_subscription ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                  )}

                  {isSelected && (
                    <span className="text-[10px] text-emerald-400 font-medium">Added</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
