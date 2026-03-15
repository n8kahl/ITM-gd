'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { DiscordSyncResult } from '@/lib/types_db'

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
  discord_role_titles: Record<string, string>
  membership_tier: 'core' | 'pro' | 'executive' | null
  role?: 'admin' | null
}

export interface TabConfig {
  id: string
  tab_id: string
  label: string
  icon: string
  path: string
  required_tier: 'core' | 'pro' | 'executive' | 'admin'
  badge_text?: string | null
  badge_variant?: 'emerald' | 'champagne' | 'destructive' | null
  description?: string | null
  mobile_visible: boolean
  sort_order: number
  is_required: boolean
  is_active: boolean
  required_discord_role_ids?: string[] | null
}

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
  allowedTabs: string[]
  tabConfigs: TabConfig[]
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
  getVisibleTabs: () => TabConfig[]
  getMobileTabs: () => TabConfig[]
}

interface MemberSessionContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
  errorCode: SyncErrorCode | null
  isNotMember: boolean
}

interface MemberAccessContextValue {
  profile: MemberProfile | null
  permissions: MemberPermission[]
  allowedTabs: string[]
  tabConfigs: TabConfig[]
  hasPermission: (permissionName: string) => boolean
  getVisibleTabs: () => TabConfig[]
  getMobileTabs: () => TabConfig[]
}

interface MemberAuthActionsContextValue {
  signOut: () => Promise<void>
  syncDiscordRoles: () => Promise<DiscordSyncResult | null>
  refresh: () => Promise<void>
}

interface AccessSnapshotResponse {
  success: boolean
  error?: string
  data?: {
    profile: MemberProfile
    permissions: MemberPermission[]
    allowedTabs: string[]
    tabConfigs: TabConfig[]
    access?: {
      isAdmin?: boolean
      hasMembersAccess?: boolean
      linkStatus?: string
      tabDecisions?: unknown[]
      activeOverrides?: unknown[]
      healthWarnings?: unknown[]
    }
  }
}

const E2E_BYPASS_AUTH_ENABLED = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === 'true'
const E2E_BYPASS_USER_ID = '00000000-0000-4000-8000-000000000001'
const E2E_BYPASS_SHARED_SECRET = process.env.NEXT_PUBLIC_E2E_BYPASS_SHARED_SECRET || ''
const REQUEST_TIMEOUT_MS = 10000
const SYNC_COOLDOWN_MS = 30_000
const AUTH_CHANNEL_NAME = 'titm-auth-sync'

const E2E_TAB_CONFIGS: TabConfig[] = [
  { id: 'dashboard', tab_id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/members', required_tier: 'core', badge_text: null, badge_variant: null, description: null, mobile_visible: true, sort_order: 0, is_required: true, is_active: true, required_discord_role_ids: [] },
  { id: 'journal', tab_id: 'journal', label: 'Journal', icon: 'BookOpen', path: '/members/journal', required_tier: 'core', badge_text: null, badge_variant: null, description: null, mobile_visible: true, sort_order: 1, is_required: false, is_active: true, required_discord_role_ids: [] },
  { id: 'ai-coach', tab_id: 'ai-coach', label: 'AI Coach', icon: 'Bot', path: '/members/ai-coach', required_tier: 'pro', badge_text: null, badge_variant: null, description: null, mobile_visible: true, sort_order: 2, is_required: false, is_active: true, required_discord_role_ids: [] },
  { id: 'profile', tab_id: 'profile', label: 'Profile', icon: 'UserCircle', path: '/members/profile', required_tier: 'core', badge_text: null, badge_variant: null, description: null, mobile_visible: true, sort_order: 99, is_required: true, is_active: true, required_discord_role_ids: [] },
  { id: 'money-maker', tab_id: 'money-maker', label: 'Money Maker', icon: 'Target', path: '/members/money-maker', required_tier: 'admin', badge_text: 'Beta', badge_variant: 'emerald', description: null, mobile_visible: true, sort_order: 120, is_required: false, is_active: true, required_discord_role_ids: [] },
]

const MemberSessionContext = createContext<MemberSessionContextValue | null>(null)
const MemberAccessContext = createContext<MemberAccessContextValue | null>(null)
const MemberAuthActionsContext = createContext<MemberAuthActionsContextValue | null>(null)

function readE2EBypassRoleOverride(): 'admin' | null {
  if (typeof window === 'undefined') return null
  const role = new URLSearchParams(window.location.search).get('e2eBypassRole')
  return role === 'admin' ? 'admin' : null
}

function createE2EBypassAuthState(): MemberAuthState {
  const nowIso = new Date().toISOString()
  const expiresIn = 60 * 60
  const roleOverride = readE2EBypassRoleOverride()
  const isAdmin = roleOverride === 'admin'

  const user = {
    id: E2E_BYPASS_USER_ID,
    email: 'e2e-member@example.com',
    app_metadata: { provider: 'discord', providers: ['discord'] },
    user_metadata: { full_name: 'E2E Member' },
    aud: 'authenticated',
    role: 'authenticated',
    created_at: nowIso,
    updated_at: nowIso,
  } as User

  const session = {
    access_token: E2E_BYPASS_SHARED_SECRET
      ? `e2e:${E2E_BYPASS_SHARED_SECRET}:${E2E_BYPASS_USER_ID}`
      : `e2e:${E2E_BYPASS_USER_ID}`,
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user,
  } as Session

  const tabConfigs = isAdmin
    ? E2E_TAB_CONFIGS
    : E2E_TAB_CONFIGS.filter((tab) => tab.required_tier !== 'admin')

  return {
    user,
    session,
    profile: {
      id: user.id,
      email: user.email ?? null,
      discord_user_id: '000000000000000001',
      discord_username: 'E2E Member',
      discord_avatar: null,
      discord_roles: ['role-member', 'role-pro'],
      discord_role_titles: {
        'role-member': 'Member',
        'role-pro': 'Pro',
      },
      membership_tier: 'pro',
      role: isAdmin ? 'admin' : null,
    },
    permissions: [
      {
        id: 'e2e-access-ai-coach',
        name: 'access_ai_coach',
        description: 'Playwright E2E bypass permission',
        granted_by_role: 'role-pro',
      },
    ],
    allowedTabs: tabConfigs.map((tab) => tab.tab_id),
    tabConfigs,
    isLoading: false,
    isAuthenticated: true,
    error: null,
    errorCode: null,
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function createBasicProfile(user: User): MemberProfile {
  return {
    id: user.id,
    email: user.email || null,
    discord_user_id: null,
    discord_username: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
    discord_avatar: user.user_metadata?.avatar_url || null,
    discord_roles: [],
    discord_role_titles: {},
    membership_tier: null,
    role: null,
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
    tabConfigs: [],
    isLoading: true,
    isAuthenticated: false,
    error: null,
    errorCode: null,
  })

  const isInitializingRef = useRef(false)
  const isAuthenticatedRef = useRef(false)
  const isSyncingRef = useRef(false)
  const lastSyncTimeRef = useRef(0)
  const authChannelRef = useRef<BroadcastChannel | null>(null)

  const applyAccessSnapshot = useCallback((user: User, session: Session, payload: AccessSnapshotResponse['data']) => {
    if (!payload) {
      setState((prev) => ({
        ...prev,
        user,
        session,
        profile: createBasicProfile(user),
        permissions: [],
        allowedTabs: [],
        tabConfigs: [],
        isLoading: false,
        isAuthenticated: true,
      }))
      return
    }

    setState({
      user,
      session,
      profile: payload.profile,
      permissions: payload.permissions,
      allowedTabs: payload.allowedTabs,
      tabConfigs: payload.tabConfigs,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      errorCode: null,
    })
  }, [])

  const loadAccessSnapshot = useCallback(async (user: User, session: Session) => {
    const response = await fetchWithTimeout(
      '/api/members/access-snapshot',
      {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      },
    )

    const payload = await response.json().catch(() => null) as AccessSnapshotResponse | null
    if (!response.ok || !payload?.success) {
      setState((prev) => ({
        ...prev,
        user,
        session,
        profile: createBasicProfile(user),
        permissions: [],
        allowedTabs: [],
        tabConfigs: [],
        isLoading: false,
        isAuthenticated: true,
        error: payload?.error || 'Failed to load member access snapshot',
        errorCode: null,
      }))
      return
    }

    applyAccessSnapshot(user, session, payload.data)
  }, [applyAccessSnapshot])

  const initializeAuth = useCallback(async () => {
    if (isInitializingRef.current) return
    isInitializingRef.current = true

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        setState({
          user: null,
          session: null,
          profile: null,
          permissions: [],
          allowedTabs: [],
          tabConfigs: [],
          isLoading: false,
          isAuthenticated: false,
          error: sessionError?.message || null,
          errorCode: null,
        })
        return
      }

      let currentSession = session
      let { data: { user }, error: userError } = await supabase.auth.getUser()

      if ((userError || !user) && currentSession.refresh_token) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && refreshedSession) {
          currentSession = refreshedSession
          user = refreshedSession.user ?? null
          userError = null
        }
      }

      if (userError || !user) {
        setState({
          user: null,
          session: null,
          profile: null,
          permissions: [],
          allowedTabs: [],
          tabConfigs: [],
          isLoading: false,
          isAuthenticated: false,
          error: userError?.message || 'Failed to resolve current user',
          errorCode: null,
        })
        return
      }

      await loadAccessSnapshot(user, currentSession)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        errorCode: null,
      }))
    } finally {
      isInitializingRef.current = false
    }
  }, [loadAccessSnapshot])

  const refresh = useCallback(async () => {
    if (E2E_BYPASS_AUTH_ENABLED) {
      setState(createE2EBypassAuthState())
      return
    }

    setState((prev) => ({ ...prev, isLoading: true }))
    isInitializingRef.current = false
    await initializeAuth()
  }, [initializeAuth])

  const syncDiscordRoles = useCallback(async (): Promise<DiscordSyncResult | null> => {
    if (!state.session || !state.user) return null

    const now = Date.now()
    if (isSyncingRef.current || (now - lastSyncTimeRef.current) < SYNC_COOLDOWN_MS) {
      return null
    }

    isSyncingRef.current = true
    lastSyncTimeRef.current = now

    try {
      let accessToken = state.session.access_token
      if (!accessToken) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
        if (!refreshedSession?.access_token) {
          setState((prev) => ({
            ...prev,
            error: 'Session expired. Please refresh and sign in again.',
            errorCode: SYNC_ERROR_CODES.INVALID_SESSION,
          }))
          return null
        }
        accessToken = refreshedSession.access_token
      }

      const response = await fetchWithTimeout(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      const payload = await response.json().catch(() => ({})) as DiscordSyncResult & {
        error?: string
        code?: SyncErrorCode
      }

      if (!response.ok || !payload?.success) {
        setState((prev) => ({
          ...prev,
          error: payload?.error || 'Failed to sync Discord roles',
          errorCode: payload?.code || SYNC_ERROR_CODES.SYNC_FAILED,
        }))
        return null
      }

      await loadAccessSnapshot(state.user, state.session)
      authChannelRef.current?.postMessage({ type: 'SYNC_COMPLETE' })

      return payload
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to sync Discord roles',
        errorCode: SYNC_ERROR_CODES.SYNC_FAILED,
      }))
      return null
    } finally {
      isSyncingRef.current = false
    }
  }, [loadAccessSnapshot, state.session, state.user])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setState({
        user: null,
        session: null,
        profile: null,
        permissions: [],
        allowedTabs: [],
        tabConfigs: [],
        isLoading: false,
        isAuthenticated: false,
        error: null,
        errorCode: null,
      })
      authChannelRef.current?.postMessage({ type: 'SIGNED_OUT' })
      router.push('/')
    }
  }, [router])

  useEffect(() => {
    if (E2E_BYPASS_AUTH_ENABLED) {
      isAuthenticatedRef.current = true
      setState(createE2EBypassAuthState())
      return
    }

    void initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          session: null,
          profile: null,
          permissions: [],
          allowedTabs: [],
          tabConfigs: [],
          isLoading: false,
          isAuthenticated: false,
          error: null,
          errorCode: null,
        })
        return
      }

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        if (!isAuthenticatedRef.current) {
          await initializeAuth()
          return
        }

        setState((prev) => ({
          ...prev,
          session,
        }))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth])

  useEffect(() => {
    isAuthenticatedRef.current = state.isAuthenticated
  }, [state.isAuthenticated])

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
    authChannelRef.current = channel

    channel.onmessage = (event) => {
      if (event.data?.type === 'SIGNED_OUT') {
        setState({
          user: null,
          session: null,
          profile: null,
          permissions: [],
          allowedTabs: [],
          tabConfigs: [],
          isLoading: false,
          isAuthenticated: false,
          error: null,
          errorCode: null,
        })
      }

      if (event.data?.type === 'SYNC_COMPLETE' && state.user && state.session) {
        void loadAccessSnapshot(state.user, state.session)
      }
    }

    return () => {
      channel.close()
      authChannelRef.current = null
    }
  }, [loadAccessSnapshot, state.session, state.user])

  useEffect(() => {
    if (state.user?.id) {
      Sentry.setUser({ id: state.user.id })
      return
    }

    Sentry.setUser(null)
  }, [state.user?.id])

  const hasPermission = useCallback((permissionName: string): boolean => {
    const tabIds = ['dashboard', 'journal', 'spx-command-center', 'library', 'social', 'profile', 'ai-coach', 'swing-sniper', 'money-maker', 'mentorship']
    if (tabIds.includes(permissionName)) {
      return state.allowedTabs.includes(permissionName)
    }

    const permissionToTab: Record<string, string> = {
      access_ai_coach: 'ai-coach',
      access_spx_command_center: 'spx-command-center',
    }

    if (permissionToTab[permissionName]) {
      return state.allowedTabs.includes(permissionToTab[permissionName])
    }

    return state.permissions.some((permission) => permission.name === permissionName)
  }, [state.allowedTabs, state.permissions])

  const visibleTabs = state.tabConfigs
  const mobileTabs = state.tabConfigs.filter((tab) => tab.mobile_visible)
  const getVisibleTabs = useCallback(() => visibleTabs, [visibleTabs])
  const getMobileTabs = useCallback(() => mobileTabs, [mobileTabs])
  const isNotMember = state.errorCode === SYNC_ERROR_CODES.NOT_MEMBER

  const sessionValue = useMemo<MemberSessionContextValue>(() => ({
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    error: state.error,
    errorCode: state.errorCode,
    isNotMember,
  }), [isNotMember, state.error, state.errorCode, state.isAuthenticated, state.isLoading, state.session, state.user])

  const accessValue = useMemo<MemberAccessContextValue>(() => ({
    profile: state.profile,
    permissions: state.permissions,
    allowedTabs: state.allowedTabs,
    tabConfigs: visibleTabs,
    hasPermission,
    getVisibleTabs,
    getMobileTabs,
  }), [getMobileTabs, getVisibleTabs, hasPermission, state.allowedTabs, state.permissions, state.profile, visibleTabs])

  const actionsValue = useMemo<MemberAuthActionsContextValue>(() => ({
    signOut,
    syncDiscordRoles,
    refresh,
  }), [refresh, signOut, syncDiscordRoles])

  return (
    <MemberSessionContext.Provider value={sessionValue}>
      <MemberAccessContext.Provider value={accessValue}>
        <MemberAuthActionsContext.Provider value={actionsValue}>
          {children}
        </MemberAuthActionsContext.Provider>
      </MemberAccessContext.Provider>
    </MemberSessionContext.Provider>
  )
}

function useRequiredMemberContext<T>(
  context: Context<T | null>,
  hookName: string,
): T {
  const value = useContext(context)

  if (!value) {
    throw new Error(`${hookName} must be used within a MemberAuthProvider`)
  }

  return value
}

export function useMemberSession() {
  return useRequiredMemberContext(MemberSessionContext, 'useMemberSession')
}

export function useMemberAccess() {
  return useRequiredMemberContext(MemberAccessContext, 'useMemberAccess')
}

export function useMemberAuthActions() {
  return useRequiredMemberContext(MemberAuthActionsContext, 'useMemberAuthActions')
}

export function useMemberAuth() {
  const session = useMemberSession()
  const access = useMemberAccess()
  const actions = useMemberAuthActions()

  return useMemo<MemberAuthContextValue>(() => ({
    user: session.user,
    session: session.session,
    profile: access.profile,
    permissions: access.permissions,
    allowedTabs: access.allowedTabs,
    tabConfigs: access.tabConfigs,
    isLoading: session.isLoading,
    isAuthenticated: session.isAuthenticated,
    error: session.error,
    errorCode: session.errorCode,
    signOut: actions.signOut,
    syncDiscordRoles: actions.syncDiscordRoles,
    hasPermission: access.hasPermission,
    refresh: actions.refresh,
    isNotMember: session.isNotMember,
    getVisibleTabs: access.getVisibleTabs,
    getMobileTabs: access.getMobileTabs,
  }), [access, actions, session])
}
