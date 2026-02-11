'use client'

import { useEffect, useState } from 'react'
import { User, LogOut, RefreshCw, Shield, Crown, Calendar, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface DiscordRole {
  discord_role_id: string
  role_name: string
  role_color: string | null
}

export default function ProfilePage() {
  const {
    user,
    profile,
    permissions,
    signOut,
    syncDiscordRoles,
  } = useMemberAuth()

  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([])
  const [isLoadingRoles, setIsLoadingRoles] = useState(true)

  const tier = profile?.membership_tier
  const tierColors = {
    core: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    pro: 'text-[#F3E5AB] bg-[#F3E5AB]/10 border-[#F3E5AB]/30',
    executive: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    none: 'text-white/40 bg-white/5 border-white/10',
  }

  // Fetch Discord role details from database
  useEffect(() => {
    const fetchDiscordRoles = async () => {
      if (!profile?.discord_roles || profile.discord_roles.length === 0) {
        setIsLoadingRoles(false)
        return
      }

      try {
        const { data, error } = await supabase
          .schema('app_config')
          .from('role_permissions')
          .select('discord_role_id, role_name, role_color')
          .in('discord_role_id', profile.discord_roles)

        if (!error && data) {
          setDiscordRoles(data as DiscordRole[])
        }
      } catch (error) {
        console.error('Failed to fetch Discord roles:', error)
      } finally {
        setIsLoadingRoles(false)
      }
    }

    fetchDiscordRoles()
  }, [profile?.discord_roles])

  const handleSync = async () => {
    await syncDiscordRoles()
  }

  // Determine if membership is active
  const isActive = !!tier

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <Card className="glass-card-heavy border-emerald-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center overflow-hidden border-4 border-emerald-500/30 shadow-lg">
              {profile?.discord_avatar ? (
                <img
                  src={`https://cdn.discordapp.com/avatars/${profile.discord_user_id}/${profile.discord_avatar}.png?size=256`}
                  alt={profile.discord_username || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-emerald-500" />
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">
                {profile?.discord_username || 'Member'}
              </h1>
              <p className="text-white/40 text-sm mt-1">
                {user?.email}
              </p>

              {/* Membership Tier Badge */}
              {tier && (
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

      {/* Membership Status */}
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            {isActive ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            Membership Status
          </CardTitle>
          <CardDescription>
            {isActive ? 'Your membership is active' : 'No active membership'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className={cn(
                'text-xl font-bold',
                isActive ? 'text-emerald-500' : 'text-red-500'
              )}>
                {isActive ? 'Active' : 'Inactive'}
              </div>
              <p className="text-sm text-white/60 mt-1">
                {isActive
                  ? `${tier?.toUpperCase()} tier membership`
                  : 'Join a tier to unlock member features'}
              </p>
            </div>
            {isActive && (
              <CheckCircle className="w-12 h-12 text-emerald-500/30" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Discord Roles */}
      {profile?.discord_roles && profile.discord_roles.length > 0 && (
        <Card className="glass-card-heavy border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#5865F2]" />
              Discord Roles
            </CardTitle>
            <CardDescription>Your current roles on the Discord server</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRoles ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-24 bg-white/10 rounded animate-pulse" />
                ))}
              </div>
            ) : discordRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {discordRoles.map((role) => (
                  <Badge
                    key={role.discord_role_id}
                    variant="outline"
                    className="px-3 py-1.5 text-sm border-white/20"
                    style={{
                      color: role.role_color || '#FFFFFF',
                      borderColor: role.role_color ? `${role.role_color}40` : 'rgba(255,255,255,0.2)',
                      backgroundColor: role.role_color ? `${role.role_color}15` : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: role.role_color || '#FFFFFF' }}
                    />
                    {role.role_name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-white/60 text-sm">
                {profile.discord_roles.length} role(s) - sync to see details
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Details */}
      <Card className="glass-card-heavy border-white/10">
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
            <span className="text-white font-medium flex items-center gap-2" suppressHydrationWarning>
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
        <Card className="glass-card-heavy border-white/10">
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
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sync Discord Identity */}
          <Button
            onClick={handleSync}
            variant="outline"
            className="w-full justify-start border-emerald-500/30 text-white hover:bg-emerald-500/10 h-12"
          >
            <RefreshCw className="w-5 h-5 mr-3 text-emerald-500" />
            Sync Discord Identity
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
