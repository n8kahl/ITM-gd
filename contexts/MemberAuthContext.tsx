'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { DiscordSyncResult, UserDiscordProfile } from '@/lib/types_db'

// ============================================
// TYPES
// ============================================

export interface MemberPermission {
  id: string
  name: string
  description: string | null
  granted_by_role: string | null
}

export interface MemberProfile {
  id: string
  email: string | null
  discord_user_id: string | null
  discord_username: string | null
  discord_avatar: string | null
  discord_roles: string[]
  membership_tier: 'core' | 'pro' | 'execute' | null
}

interface MemberAuthState {
  user: User | null
  session: Session | null
  profile: MemberProfile | null
  permissions: MemberPermission[]
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

interface MemberAuthContextValue extends MemberAuthState {
  signOut: () => Promise<void>
  syncDiscordRoles: () => Promise<DiscordSyncResult | null>
  hasPermission: (permissionName: string) => boolean
  refresh: () => Promise<void>
}

// ============================================
// CONTEXT
// ============================================

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<MemberAuthState>({
    user: null,
    session: null,
    profile: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  // Derive membership tier from Discord roles
  const getMembershipTier = (roles: string[]): 'core' | 'pro' | 'execute' | null => {
    // Role IDs should be configured - these are placeholders
    // TODO: Fetch from app_settings or use environment variables
    const roleMap: Record<string, 'core' | 'pro' | 'execute'> = {
      'execute_sniper': 'execute',
      'pro_sniper': 'pro',
      'core_sniper': 'core',
    }

    // Check in order of highest tier
    for (const [roleId, tier] of Object.entries(roleMap)) {
      if (roles.includes(roleId)) {
        return tier
      }
    }

    return null
  }

  // Sync Discord roles via Edge Function
  const syncDiscordRoles = useCallback(async (): Promise<DiscordSyncResult | null> => {
    if (!state.session) {
      console.log('No session available for Discord sync')
      return null
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const result = await response.json()

      if (!result.success) {
        console.error('Discord sync failed:', result.error)
        setState(prev => ({ ...prev, error: result.error }))
        return null
      }

      // Extract role names for tier determination
      const roleNames = result.roles.map((r: { id: string; name: string | null }) => r.name || r.id)

      // Update state with sync results
      const profile: MemberProfile = {
        id: state.user?.id || '',
        email: state.user?.email || null,
        discord_user_id: result.discord_user_id,
        discord_username: result.discord_username,
        discord_avatar: null, // Can be fetched separately if needed
        discord_roles: roleNames,
        membership_tier: getMembershipTier(roleNames),
      }

      const permissions: MemberPermission[] = result.permissions.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        granted_by_role: p.granted_by_role,
      }))

      setState(prev => ({
        ...prev,
        profile,
        permissions,
        error: null,
      }))

      return result as DiscordSyncResult
    } catch (error) {
      console.error('Discord sync error:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sync Discord roles',
      }))
      return null
    }
  }, [state.session, state.user])

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('Session error:', sessionError)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: sessionError.message,
        }))
        return
      }

      if (!session) {
        // No session - user needs to log in
        setState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
        }))
        return
      }

      // Get user
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error('User error:', userError)
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: userError?.message || 'Failed to get user',
        }))
        return
      }

      // Update state with user and session
      setState(prev => ({
        ...prev,
        user,
        session,
        isAuthenticated: true,
      }))

      // Try to get cached Discord profile first
      const { data: discordProfile } = await supabase
        .from('user_discord_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (discordProfile) {
        const profile: MemberProfile = {
          id: user.id,
          email: user.email || null,
          discord_user_id: discordProfile.discord_user_id,
          discord_username: discordProfile.discord_username,
          discord_avatar: discordProfile.discord_avatar,
          discord_roles: discordProfile.discord_roles || [],
          membership_tier: getMembershipTier(discordProfile.discord_roles || []),
        }

        // Get cached permissions
        const { data: userPermissions } = await supabase
          .from('user_permissions')
          .select(`
            permission_id,
            granted_by_role_name,
            app_permissions (
              id,
              name,
              description
            )
          `)
          .eq('user_id', user.id)

        const permissions: MemberPermission[] = (userPermissions || []).map((up: any) => ({
          id: up.app_permissions?.id || up.permission_id,
          name: up.app_permissions?.name || '',
          description: up.app_permissions?.description || null,
          granted_by_role: up.granted_by_role_name,
        }))

        setState(prev => ({
          ...prev,
          profile,
          permissions,
          isLoading: false,
        }))

        // Sync Discord roles in background if profile is stale (> 5 minutes)
        const lastSynced = new Date(discordProfile.last_synced_at).getTime()
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        if (lastSynced < fiveMinutesAgo) {
          console.log('Discord profile stale, syncing in background...')
          syncDiscordRoles()
        }
      } else {
        // No cached profile - sync Discord roles immediately
        console.log('No cached Discord profile, syncing...')
        setState(prev => ({ ...prev, session, user }))

        // Need to sync after state is updated
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        const result = await response.json()

        if (result.success) {
          const roleNames = result.roles.map((r: { id: string; name: string | null }) => r.name || r.id)

          const profile: MemberProfile = {
            id: user.id,
            email: user.email || null,
            discord_user_id: result.discord_user_id,
            discord_username: result.discord_username,
            discord_avatar: null,
            discord_roles: roleNames,
            membership_tier: getMembershipTier(roleNames),
          }

          const permissions: MemberPermission[] = result.permissions.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            granted_by_role: p.granted_by_role,
          }))

          setState(prev => ({
            ...prev,
            profile,
            permissions,
            isLoading: false,
          }))
        } else {
          // Sync failed but user is still authenticated
          // Create basic profile from Supabase user
          const profile: MemberProfile = {
            id: user.id,
            email: user.email || null,
            discord_user_id: null,
            discord_username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
            discord_avatar: user.user_metadata?.avatar_url || null,
            discord_roles: [],
            membership_tier: null,
          }

          setState(prev => ({
            ...prev,
            profile,
            isLoading: false,
            error: result.error || 'Failed to sync Discord roles',
          }))
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }))
    }
  }, [syncDiscordRoles])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setState({
        user: null,
        session: null,
        profile: null,
        permissions: [],
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
      router.push('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }, [router])

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionName: string): boolean => {
    return state.permissions.some(p => p.name === permissionName)
  }, [state.permissions])

  // Refresh auth state
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    await initializeAuth()
  }, [initializeAuth])

  // Initialize on mount
  useEffect(() => {
    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)

        if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            profile: null,
            permissions: [],
            isLoading: false,
            isAuthenticated: false,
            error: null,
          })
        } else if (event === 'SIGNED_IN' && session) {
          // Re-initialize auth
          await initializeAuth()
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setState(prev => ({ ...prev, session }))
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth])

  const value: MemberAuthContextValue = {
    ...state,
    signOut,
    syncDiscordRoles,
    hasPermission,
    refresh,
  }

  return (
    <MemberAuthContext.Provider value={value}>
      {children}
    </MemberAuthContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function useMemberAuth() {
  const context = useContext(MemberAuthContext)

  if (!context) {
    throw new Error('useMemberAuth must be used within a MemberAuthProvider')
  }

  return context
}

// Alias for convenience
export const useMemberSession = useMemberAuth
