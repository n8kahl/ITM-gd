'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
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
  membership_tier: 'core' | 'pro' | 'executive' | null
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
  allowedTabs: string[] // Simple RBAC: tabs user can access
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
// Example: { "1234567890123456789": "executive", "9876543210987654321": "pro" }
const DEFAULT_ROLE_MAPPING: Record<string, 'core' | 'pro' | 'executive'> = {
  // Empty by default - must be configured with actual Discord role IDs
}

// Rate limiting for sync operations
const SYNC_COOLDOWN_MS = 30000 // 30 seconds

// Request timeout for auth operations (10 seconds - faster fallback)
const REQUEST_TIMEOUT_MS = 10000

// Cross-tab sync channel name
const AUTH_CHANNEL_NAME = 'titm-auth-sync'

/**
 * Helper to fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<MemberAuthState>({
    user: null,
    session: null,
    profile: null,
    permissions: [],
    allowedTabs: [],
    isLoading: true,
    isAuthenticated: false,
    error: null,
    errorCode: null,
  })

  // Dynamic role mapping fetched from config API (role ID -> tier)
  const [roleMapping, setRoleMapping] = useState<Record<string, 'core' | 'pro' | 'executive'>>(DEFAULT_ROLE_MAPPING)

  // Rate limiting using ref (not state) to avoid race conditions
  const lastSyncTimeRef = useRef(0)
  const isSyncingRef = useRef(false)

  // Track authentication status to prevent re-initialization on navigation
  const isAuthenticatedRef = useRef(false)

  // Guard against concurrent initializeAuth calls (useEffect + onAuthStateChange race)
  const isInitializingRef = useRef(false)

  // Refs for state values so callbacks stay stable (don't depend on state objects)
  const sessionRef = useRef(state.session)
  sessionRef.current = state.session
  const userRef = useRef(state.user)
  userRef.current = state.user

  // Cross-tab sync channel
  const authChannelRef = useRef<BroadcastChannel | null>(null)

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
  const getMembershipTier = useCallback((roleIds: string[]): 'core' | 'pro' | 'executive' | null => {
    // Check in order of highest tier (executive > pro > core)
    const tierOrder: Array<'executive' | 'pro' | 'core'> = ['executive', 'pro', 'core']

    for (const tier of tierOrder) {
      for (const [roleId, mappedTier] of Object.entries(roleMapping)) {
        if (mappedTier === tier && roleIds.includes(roleId)) {
          return tier
        }
      }
    }

    return null
  }, [roleMapping])

  // Get allowed tabs based on membership tier
  const getAllowedTabsForTier = useCallback((tier: 'core' | 'pro' | 'executive' | null): string[] => {
    if (!tier) return ['dashboard', 'profile'] // Free users get minimal access

    switch (tier) {
      case 'executive':
        return ['dashboard', 'ai-coach', 'journal', 'library', 'profile'] // All access
      case 'pro':
        return ['dashboard', 'ai-coach', 'journal', 'library', 'profile'] // Same as executive for now
      case 'core':
        return ['dashboard', 'ai-coach', 'journal', 'profile'] // No library access
      default:
        return ['dashboard', 'profile']
    }
  }, [])

  // Fetch allowed tabs (now based on tier, not database)
  const fetchAllowedTabs = useCallback(async (userId: string, tier?: 'core' | 'pro' | 'executive' | null): Promise<string[]> => {
    // If tier is provided, use it directly
    if (tier !== undefined) {
      return getAllowedTabsForTier(tier)
    }

    // Otherwise, this is a fallback - shouldn't happen in normal flow
    try {
      const { data, error } = await supabase.rpc('get_user_allowed_tabs', {
        user_id: userId
      })

      if (error) {
        console.error('Error fetching allowed tabs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('fetchAllowedTabs error:', error)
      return []
    }
  }, [])

  // Refs for stable access to latest callback versions (breaks dependency chains)
  const getMembershipTierRef = useRef(getMembershipTier)
  getMembershipTierRef.current = getMembershipTier
  const fetchAllowedTabsRef = useRef(fetchAllowedTabs)
  fetchAllowedTabsRef.current = fetchAllowedTabs

  // Sync Discord roles via Edge Function (with rate limiting and timeout)
  const syncDiscordRoles = useCallback(async (): Promise<DiscordSyncResult | null> => {
    const now = Date.now()

    // Atomic check: if already syncing or in cooldown, skip
    if (isSyncingRef.current) {
      console.log('Sync already in progress, skipping')
      return null
    }

    if (now - lastSyncTimeRef.current < SYNC_COOLDOWN_MS) {
      console.log('Sync cooldown active, skipping (wait', Math.ceil((SYNC_COOLDOWN_MS - (now - lastSyncTimeRef.current)) / 1000), 'seconds)')
      return null
    }

    // Set flags atomically before async operation
    isSyncingRef.current = true
    lastSyncTimeRef.current = now

    if (!sessionRef.current) {
      console.log('No session available for Discord sync')
      isSyncingRef.current = false
      return null
    }

    try {
      const response = await fetchWithTimeout(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionRef.current.access_token}`,
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
        id: userRef.current?.id || '',
        email: userRef.current?.email || null,
        discord_user_id: result.discord_user_id,
        discord_username: result.discord_username,
        discord_avatar: result.discord_avatar || null, // Store avatar from sync result
        discord_roles: roleIds,
        membership_tier: getMembershipTierRef.current(roleIds),
      }

      const permissions: MemberPermission[] = result.permissions.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        granted_by_role: p.granted_by_role,
      }))

      // Get allowed tabs based on membership tier
      const allowedTabs = await fetchAllowedTabsRef.current(userRef.current?.id || '', profile.membership_tier)

      setState(prev => ({
        ...prev,
        profile,
        permissions,
        allowedTabs,
        error: null,
        errorCode: null,
      }))

      // Notify other tabs of auth change
      authChannelRef.current?.postMessage({ type: 'SYNC_COMPLETE', profile })

      return result as DiscordSyncResult
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Discord sync timed out')
        setState(prev => ({
          ...prev,
          error: 'Discord sync timed out. Please try again.',
          errorCode: SYNC_ERROR_CODES.SYNC_FAILED,
        }))
      } else {
        console.error('Discord sync error:', error)
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to sync Discord roles',
          errorCode: SYNC_ERROR_CODES.SYNC_FAILED,
        }))
      }
      return null
    } finally {
      isSyncingRef.current = false
    }
  }, []) // Stable — reads from refs

  // Ref for syncDiscordRoles so initializeAuth doesn't depend on it
  const syncDiscordRolesRef = useRef(syncDiscordRoles)
  syncDiscordRolesRef.current = syncDiscordRoles

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    // Prevent concurrent calls (useEffect + onAuthStateChange can race)
    if (isInitializingRef.current) {
      console.log('[MemberAuth] initializeAuth already running, skipping')
      return
    }
    isInitializingRef.current = true

    console.log('[MemberAuth] initializeAuth started')
    try {
      // Diagnostic: check Supabase client health
      console.log('[MemberAuth] 🔍 Supabase client check:', {
        hasAuthModule: !!supabase?.auth,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) || 'MISSING',
      })

      // Try a direct fetch to Supabase to check connectivity
      const healthUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`
      console.log('[MemberAuth] 🔍 Testing Supabase connectivity:', healthUrl)
      try {
        const healthCheck = await Promise.race([
          fetch(healthUrl, {
            headers: { 'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 5000))
        ]) as Response
        console.log('[MemberAuth] 🔍 Supabase health:', { status: healthCheck.status, ok: healthCheck.ok })
      } catch (healthErr: any) {
        console.error('[MemberAuth] 🔍 Supabase NOT reachable:', healthErr.message)
      }

      // Get current session with timeout wrapper
      console.log('[MemberAuth] 1️⃣ Calling getSession()...')

      // Add 8-second timeout to prevent hanging
      const getSessionWithTimeout = async () => {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout after 8 seconds')), 8000)
        )
        return Promise.race([
          supabase.auth.getSession(),
          timeout
        ])
      }

      const { data: { session }, error: sessionError } = await getSessionWithTimeout() as any

      if (sessionError) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: sessionError.message,
        }))
        return
      }

      if (!session) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
        }))
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: userError?.message || 'Failed to get user',
        }))
        return
      }

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
        .maybeSingle()

      if (discordProfile) {
        const profile: MemberProfile = {
          id: user.id,
          email: user.email || null,
          discord_user_id: discordProfile.discord_user_id,
          discord_username: discordProfile.discord_username,
          discord_avatar: discordProfile.discord_avatar,
          discord_roles: discordProfile.discord_roles || [],
          membership_tier: getMembershipTierRef.current(discordProfile.discord_roles || []),
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

        // Get allowed tabs based on membership tier
        const allowedTabs = await fetchAllowedTabsRef.current(user.id, profile.membership_tier)

        setState(prev => ({
          ...prev,
          profile,
          permissions,
          allowedTabs,
          isLoading: false,
        }))

        // Sync Discord roles in background if profile is stale (> 5 minutes)
        const lastSynced = new Date(discordProfile.last_synced_at).getTime()
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        if (lastSynced < fiveMinutesAgo) {
          syncDiscordRolesRef.current()
        }
      } else {
        // No cached profile - sync Discord roles immediately
        setState(prev => ({ ...prev, session, user }))

        // Validate Supabase URL is configured
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
          throw new Error('Supabase URL not configured')
        }

        try {
          const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`

          const response = await fetchWithTimeout(
            edgeFunctionUrl,
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
            membership_tier: getMembershipTierRef.current(roleIds),
          }

          const permissions: MemberPermission[] = result.permissions.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            granted_by_role: p.granted_by_role,
          }))

          // Get allowed tabs based on membership tier
          const allowedTabs = await fetchAllowedTabsRef.current(user.id, profile.membership_tier)

          setState(prev => ({
            ...prev,
            profile,
            permissions,
            allowedTabs,
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
        } catch (syncError) {
          // Handle timeout or network errors during initial sync
          const isTimeout = syncError instanceof Error && syncError.name === 'AbortError'
          console.error('[MemberAuth] Initial Discord sync failed:', {
            error: syncError,
            isTimeout,
            message: syncError instanceof Error ? syncError.message : 'Unknown error'
          })

          // Create basic profile from Supabase user so user isn't stuck
          const fallbackProfile: MemberProfile = {
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
            profile: fallbackProfile,
            isLoading: false,
            error: isTimeout
              ? 'Discord sync timed out. Your roles will sync in the background.'
              : 'Failed to sync Discord roles. Please try refreshing.',
            errorCode: SYNC_ERROR_CODES.SYNC_FAILED,
          }))
        }
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timeout')
      console.error('[MemberAuth] Auth initialization error:', {
        error,
        isTimeout,
        message: error instanceof Error ? error.message : 'Unknown'
      })

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: isTimeout
          ? 'Authentication check timed out. Please refresh the page or check your connection.'
          : (error instanceof Error ? error.message : 'Authentication failed'),
        errorCode: isTimeout ? SYNC_ERROR_CODES.SYNC_FAILED : null,
      }))
    } finally {
      isInitializingRef.current = false
      // Safety net: ensure loading is always set to false
      console.log('[MemberAuth] initializeAuth completed')
      setState(prev => {
        if (prev.isLoading) {
          console.warn('[MemberAuth] isLoading was still true after initialization, forcing to false')
          return { ...prev, isLoading: false }
        }
        return prev
      })
    }
  }, []) // Stable — reads from refs to avoid re-render cascade

  // Sign out with full cleanup
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()

      // Clear all auth-related state
      setState({
        user: null,
        session: null,
        profile: null,
        permissions: [],
        allowedTabs: [],
        isLoading: false,
        isAuthenticated: false,
        error: null,
        errorCode: null,
      })

      // Clear any cached data from storage
      try {
        // Clear localStorage items (analytics session, etc.)
        const keysToRemove = ['titm_session', 'titm_analytics', 'titm_user']
        keysToRemove.forEach(key => localStorage.removeItem(key))

        // Clear sessionStorage
        sessionStorage.clear()
      } catch (storageError) {
        // Storage might not be available in some contexts
        console.warn('Could not clear storage:', storageError)
      }

      // Notify other tabs of sign out
      authChannelRef.current?.postMessage({ type: 'SIGNED_OUT' })

      router.push('/')
    } catch (error) {
      console.error('Sign out error:', error)
      // Still redirect on error
      router.push('/')
    }
  }, [router])

  // Check if user has a specific permission
  // Supports both:
  // 1. Simple RBAC tab IDs: 'dashboard', 'journal', 'library', 'profile'
  // 2. Legacy permission names: 'access_trading_journal', etc.
  const hasPermission = useCallback((permissionName: string): boolean => {
    // Check if it's a tab ID (Simple RBAC)
    const tabIds = ['dashboard', 'journal', 'library', 'profile', 'ai-coach']
    if (tabIds.includes(permissionName)) {
      return state.allowedTabs.includes(permissionName)
    }

    // Map permission names to tab IDs for nav items
    const permissionToTab: Record<string, string> = {
      'access_ai_coach': 'ai-coach',
    }
    if (permissionToTab[permissionName]) {
      return state.allowedTabs.includes(permissionToTab[permissionName])
    }

    // Fall back to legacy permission system
    return state.permissions.some(p => p.name === permissionName)
  }, [state.permissions, state.allowedTabs])

  // Refresh auth state (reset guard so initializeAuth can run again)
  const refresh = useCallback(async () => {
    isInitializingRef.current = false
    setState(prev => ({ ...prev, isLoading: true }))
    await initializeAuth()
  }, [initializeAuth])

  // Initialize on mount
  useEffect(() => {
    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {

        if (event === 'SIGNED_OUT') {
          isAuthenticatedRef.current = false
          setState({
            user: null,
            session: null,
            profile: null,
            permissions: [],
            allowedTabs: [],
            isLoading: false,
            isAuthenticated: false,
            error: null,
            errorCode: null,
          })
        } else if (event === 'SIGNED_IN' && session) {
          // Only re-initialize if not already authenticated
          // This prevents the loading screen on navigation/tab switching
          if (!isAuthenticatedRef.current) {
            // First sign in - full initialization needed
            await initializeAuth()
          } else {
            // Already signed in, just update session without loading screen
            setState(prev => ({ ...prev, session }))
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Just update session, don't show loading screen
          setState(prev => ({ ...prev, session }))
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth])

  // Keep authentication ref in sync with state
  useEffect(() => {
    isAuthenticatedRef.current = state.isAuthenticated
  }, [state.isAuthenticated])

  // Cross-tab session sync using BroadcastChannel
  useEffect(() => {
    // BroadcastChannel is not available in all environments (e.g., SSR)
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return
    }

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
    authChannelRef.current = channel

    channel.onmessage = (event) => {
      const { type, profile } = event.data

      switch (type) {
        case 'SIGNED_OUT':
          // Another tab signed out, update this tab's state
          console.log('Received SIGNED_OUT from another tab')
          setState({
            user: null,
            session: null,
            profile: null,
            permissions: [],
            allowedTabs: [],
            isLoading: false,
            isAuthenticated: false,
            error: null,
            errorCode: null,
          })
          break

        case 'SYNC_COMPLETE':
          // Another tab completed a sync, update profile
          if (profile && state.isAuthenticated) {
            console.log('Received SYNC_COMPLETE from another tab')
            setState(prev => ({ ...prev, profile }))
          }
          break
      }
    }

    return () => {
      channel.close()
      authChannelRef.current = null
    }
  }, [state.isAuthenticated])

  // Computed flag for NOT_MEMBER error
  const isNotMember = state.errorCode === SYNC_ERROR_CODES.NOT_MEMBER

  const value = useMemo<MemberAuthContextValue>(() => ({
    ...state,
    signOut,
    syncDiscordRoles,
    hasPermission,
    refresh,
    isNotMember,
  }), [state, signOut, syncDiscordRoles, hasPermission, refresh, isNotMember])

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
