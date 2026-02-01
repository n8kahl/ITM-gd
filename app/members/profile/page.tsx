'use client'

import { User, LogOut, RefreshCw, Shield, Crown, Calendar, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const {
    user,
    profile,
    permissions,
    signOut,
    syncDiscordRoles,
    getMembershipTier,
  } = useMemberAuth()

  const tier = getMembershipTier()
  const tierColors = {
    core: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    pro: 'text-[#F3E5AB] bg-[#F3E5AB]/10 border-[#F3E5AB]/30',
    execute: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    none: 'text-white/40 bg-white/5 border-white/10',
  }

  const handleSync = async () => {
    await syncDiscordRoles()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden border-2 border-emerald-500/30">
              {profile?.discord_avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png?size=160`}
                  alt={profile.discord_username || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-emerald-500" />
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                {profile?.discord_username || 'Member'}
              </h1>
              <p className="text-white/40 text-sm mt-1">
                {user?.email}
              </p>

              {/* Membership Tier Badge */}
              {tier && tier !== 'none' && (
                <div className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mt-3 border',
                  tierColors[tier]
                )}>
                  <Crown className="w-4 h-4" />
                  <span className="capitalize">{tier} Sniper</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-white/60">Discord Username</span>
            <span className="text-white font-medium">
              {profile?.discord_username || 'Not connected'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-white/60">Email</span>
            <span className="text-white font-medium truncate max-w-[200px]">
              {user?.email || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-white/60">Member Since</span>
            <span className="text-white font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-white/40" />
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Unknown'}
            </span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-white/60">Membership Tier</span>
            <span className={cn(
              'px-2 py-1 rounded text-sm font-medium capitalize',
              tierColors[tier || 'none']
            )}>
              {tier || 'None'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Permissions (if any) */}
      {permissions.length > 0 && (
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Your Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {permissions.map((perm) => (
                <span
                  key={perm.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                >
                  {perm.name.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sync Discord Roles */}
          <Button
            onClick={handleSync}
            variant="outline"
            className="w-full justify-start border-white/10 text-white hover:bg-white/5 h-12"
          >
            <RefreshCw className="w-5 h-5 mr-3 text-emerald-500" />
            Sync Discord Roles
          </Button>

          {/* Discord Server Link */}
          <a
            href="https://discord.gg/tradeitm"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button
              variant="outline"
              className="w-full justify-start border-white/10 text-white hover:bg-white/5 h-12"
            >
              <ExternalLink className="w-5 h-5 mr-3 text-[#5865F2]" />
              Open Discord Server
            </Button>
          </a>

          {/* Logout Button - Prominent for mobile users */}
          <div className="pt-4 border-t border-white/10">
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10 h-12"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
