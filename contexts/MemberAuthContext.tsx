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

// Error codes from sync-discord-roles edge function
export const SYNC_ERROR_CODES = {
  NOT_MEMBER: 'NOT_MEMBER',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_SESSION: 'INVALID_SESSION',
  GUILD_NOT_CONFIGURED: 'GUILD_NOT_CONFIGURED',
  SYNC_FAILED: 'SYNC_FAILED',
} as const

export type SyncErrorCode = typeof SYNC_ERROR_CODES[keyof typeof SYNC_ERROR_CODES]

interface MemberAuthState {
  user: User | null
  session: Session | null
  profile: MemberProfile | null
  permissions: MemberPermission[]
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  errorCode: SyncErrorCode | null
}

interface MemberAuthContextValue extends MemberAuthState {
  signOut: () => Promise<void>
  syncDiscordRoles: () => Promise<DiscordSyncResult | null>
  hasPermission: (permissionName: string) => boolean
  refresh: () => Promise<void>
  isNotMember: boolean
}

// ============================================
// CONTEXT
// ============================================

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

// Default role mapping fallback (Discord role ID -> tier)
// Configure actual Discord role IDs in Admin > Settings or via app_settings table
// Example: { "1234567890123456789": "execute", "9876543210987654321": "pro" }
const DEFAULT_ROLE_MAPPING: Record<string, 'core' | 'pro' | 'execute'> = {
  // Empty by default - must be configured with actual Discord role IDs
}

// Rate limiting for sync operations
const SYNC_COOLDOWN_MS = 30000 // 30 seconds

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
    errorCode: null,
  })

  // Dynamic role mapping fetched from config API (role ID -> tier)
  const [roleMapping, setRoleMapping] = useState<Record<string, 'core' | 'pro' | 'execute'>>(DEFAULT_ROLE_MAPPING)

  // Rate limiting state for sync operations
  const [lastSyncTime, setLastSyncTime] = useState(0)

  // Fetch role mapping from config API on mount
  useEffect(() => {
    fetch('/api/config/roles')
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setRoleMapping(data)
        }
      })
      .catch(() => {
        // Keep default mapping on error
      })
  }, [])

  // Derive membership tier from Discord role IDs using dynamic mapping
  // roleMapping keys are Discord role IDs, values are tier names
  const getMembershipTier = useCallback((roleIds: string[]): 'core' | 'pro' | 'execute' | null => {
    // Check in order of highest tier (execute > pro > core)
    const tierOrder: Array<'execute' | 'pro' | 'core'> = ['execute', 'pro', 'core']

    for (const tier of tierOrder) {
      for (const [roleId, mappedTier] of Object.entries(roleMapping)) {
        if (mappedTier === tier && roleIds.includes(roleId)) {
          return tier
        }
      }
    }

    return null
  }, [roleMapping])

  // Sync Discord roles via Edge Function (with rate limiting)
  const syncDiscordRoles = useCallback(async (): Promise<DiscordSyncResult | null> => {
    // Rate limiting: prevent rapid sync calls
    const now = Date.now()
    if (now - lastSyncTime < SYNC_COOLDOWN_MS) {
      console.log('Sync cooldown active, skipping (wait', Math.ceil((SYNC_COOLDOWN_MS - (now - lastSyncTime)) / 1000), 'seconds)')
      return null
    }
    setLastSyncTime(now)

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
        console.error('Discord sync failed:', result.error, 'Code:', result.code)
        setState(prev => ({
          ...prev,
          error: result.error,
          errorCode: result.code || null,
        }))
        return null
      }

      // Extract role IDs for tier determination (not names)
      const roleIds = result.roles.map((r: { id: string; name: string | null }) => r.id)

      // Update state with sync results
      const profile: MemberProfile = {
        id: state.user?.id || '',
        email: state.user?.email || null,
        discord_user_id: result.discord_user_id,
        discord_username: result.discord_username,
        discord_avatar: result.discord_avatar || null, // Store avatar from sync result
        discord_roles: roleIds,
        membership_tier: getMembershipTier(roleIds),
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
        errorCode: null,
      }))

      return result as DiscordSyncResult
    } catch (error) {
      console.error('Discord sync error:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sync Discord roles',
        errorCode: SYNC_ERROR_CODES.SYNC_FAILED,
      }))
      return null
    }
  }, [state.session, state.user, getMembershipTier, lastSyncTime])

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
          // Use role IDs for tier determination
          const roleIds = result.roles.map((r: { id: string; name: string | null }) => r.id)

          const profile: MemberProfile = {
            id: user.id,
            email: user.email || null,
            discord_user_id: result.discord_user_id,
            discord_username: result.discord_username,
            discord_avatar: result.discord_avatar || null,
            discord_roles: roleIds,
            membership_tier: getMembershipTier(roleIds),
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
            errorCode: result.code || null,
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
  }, [syncDiscordRoles, getMembershipTier])

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
        errorCode: null,
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
            errorCode: null,
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

  // Computed flag for NOT_MEMBER error
  const isNotMember = state.errorCode === SYNC_ERROR_CODES.NOT_MEMBER

  const value: MemberAuthContextValue = {
    ...state,
    signOut,
    syncDiscordRoles,
    hasPermission,
    refresh,
    isNotMember,
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
