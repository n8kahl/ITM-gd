'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCw, ExternalLink, User, MessageCircle } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface DiscordCommunityCardProps {
  discordUsername?: string | null
  discordAvatar?: string | null
  discordRoles?: string[]
  onSyncRoles?: () => void | Promise<unknown>
  className?: string
}

// ============================================
// COMPONENT
// ============================================

export function DiscordCommunityCard({
  discordUsername,
  discordAvatar,
  discordRoles = [],
  onSyncRoles,
  className,
}: DiscordCommunityCardProps) {
  const [imgError, setImgError] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleSyncRoles = async () => {
    if (!onSyncRoles) return
    setSyncing(true)
    try {
      await onSyncRoles()
    } catch {
      // Sync error handled by parent
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card className={cn('glass-card-heavy border-white/[0.08]', className)}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-[#F5F5F0] flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#5865F2]" />
            Discord
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        {discordUsername ? (
          <>
            {/* Discord User Info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden bg-[#141416]">
                {discordAvatar && !imgError ? (
                  <Image
                    src={discordAvatar}
                    alt={`${discordUsername}'s Discord avatar`}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-5 h-5 text-[#9A9A9A]" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#F5F5F0] truncate">
                  {discordUsername}
                </p>
                <p className="text-xs text-[#9A9A9A]">Connected</p>
              </div>
            </div>

            {/* Discord Roles */}
            {discordRoles.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] mb-2">
                  Roles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {discordRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="text-[10px] bg-[#5865F2]/10 text-[#5865F2] border-[#5865F2]/20"
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sync Roles Button */}
            {onSyncRoles && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={handleSyncRoles}
                disabled={syncing}
              >
                <RefreshCw
                  className={cn('w-3.5 h-3.5', syncing && 'animate-spin')}
                />
                {syncing ? 'Syncing...' : 'Sync Roles'}
              </Button>
            )}
          </>
        ) : (
          /* Not connected state */
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#5865F2]/10 flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-[#5865F2]" />
            </div>
            <div>
              <p className="text-sm text-[#F5F5F0]">
                Connect your Discord
              </p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                Link your account to sync roles and community features
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              asChild
            >
              <a
                href="https://discord.gg/tradeinthemoney"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Join Discord
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
