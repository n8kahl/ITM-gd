import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCreateServerClient,
  mockCreateClient,
  mockCookies,
  mockHeaders,
  mockExtractDiscordRoleIdsFromUser,
  mockNormalizeDiscordRoleIds,
  mockHasAdminRoleAccess,
} = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockHeaders: vi.fn(),
  mockExtractDiscordRoleIdsFromUser: vi.fn(),
  mockNormalizeDiscordRoleIds: vi.fn(),
  mockHasAdminRoleAccess: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
  headers: (...args: unknown[]) => mockHeaders(...args),
}))

vi.mock('@/lib/discord-role-access', () => ({
  extractDiscordRoleIdsFromUser: (...args: unknown[]) => mockExtractDiscordRoleIdsFromUser(...args),
  normalizeDiscordRoleIds: (...args: unknown[]) => mockNormalizeDiscordRoleIds(...args),
  hasAdminRoleAccess: (...args: unknown[]) => mockHasAdminRoleAccess(...args),
}))

import { isAdminUser } from '@/lib/supabase-server'

function makeServerSupabaseClient(options: {
  user: unknown
  discordProfile?: { discord_roles: unknown } | null
  throwOnFrom?: boolean
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options.discordProfile ?? null,
    error: null,
  })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockImplementation(() => {
    if (options.throwOnFrom) {
      throw new Error('Unexpected from() call')
    }
    return { select }
  })
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options.user },
    error: null,
  })

  return {
    client: {
      auth: { getUser },
      from,
    },
    from,
  }
}

function makeServiceRoleClient(options: { role?: string | null; throwOnMaybeSingle?: boolean }) {
  const maybeSingle = options.throwOnMaybeSingle
    ? vi.fn().mockRejectedValue(new Error('profiles query failed'))
    : vi.fn().mockResolvedValue({
      data: options.role == null ? null : { role: options.role },
      error: null,
    })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })

  return {
    from,
  }
}

describe('isAdminUser admin-chain behavior', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NODE_ENV = 'test'
    process.env.E2E_BYPASS_AUTH = 'false'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockCookies.mockResolvedValue({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    })
    mockHeaders.mockResolvedValue({
      get: vi.fn(() => null),
    })

    mockExtractDiscordRoleIdsFromUser.mockReturnValue([])
    mockNormalizeDiscordRoleIds.mockImplementation((roles: unknown) => Array.isArray(roles) ? roles : [])
    mockHasAdminRoleAccess.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true when app_metadata.is_admin is true', async () => {
    const serverClient = makeServerSupabaseClient({
      user: { id: 'user-1', app_metadata: { is_admin: true } },
      throwOnFrom: true,
    })
    mockCreateServerClient.mockReturnValue(serverClient.client)

    const result = await isAdminUser()

    expect(result).toBe(true)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(serverClient.from).not.toHaveBeenCalled()
    expect(mockExtractDiscordRoleIdsFromUser).not.toHaveBeenCalled()
    expect(mockHasAdminRoleAccess).not.toHaveBeenCalled()
  })

  it('returns true when profiles.role is admin via service-role client', async () => {
    const serverClient = makeServerSupabaseClient({
      user: { id: 'user-2', app_metadata: { is_admin: false } },
      throwOnFrom: true,
    })
    const serviceRoleClient = makeServiceRoleClient({ role: 'admin' })
    mockCreateServerClient.mockReturnValue(serverClient.client)
    mockCreateClient.mockReturnValue(serviceRoleClient as never)

    const result = await isAdminUser()

    expect(result).toBe(true)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(serviceRoleClient.from).toHaveBeenCalledWith('profiles')
    expect(mockExtractDiscordRoleIdsFromUser).not.toHaveBeenCalled()
    expect(mockHasAdminRoleAccess).not.toHaveBeenCalled()
  })

  it('falls back to discord-role path when service-role client is unavailable', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const serverClient = makeServerSupabaseClient({
      user: { id: 'user-3', app_metadata: { is_admin: false } },
      discordProfile: null,
    })
    mockCreateServerClient.mockReturnValue(serverClient.client)
    mockExtractDiscordRoleIdsFromUser.mockReturnValue(['discord-admin'])
    mockHasAdminRoleAccess.mockReturnValue(true)

    const result = await isAdminUser()

    expect(result).toBe(true)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(serverClient.from).toHaveBeenCalledWith('user_discord_profiles')
    expect(mockHasAdminRoleAccess).toHaveBeenCalledWith(['discord-admin'])
  })

  it('falls back to discord-role path when service-role profiles query throws', async () => {
    const serverClient = makeServerSupabaseClient({
      user: { id: 'user-4', app_metadata: { is_admin: false } },
      discordProfile: null,
    })
    const serviceRoleClient = makeServiceRoleClient({ throwOnMaybeSingle: true })
    mockCreateServerClient.mockReturnValue(serverClient.client)
    mockCreateClient.mockReturnValue(serviceRoleClient as never)
    mockExtractDiscordRoleIdsFromUser.mockReturnValue(['fallback-role'])
    mockHasAdminRoleAccess.mockReturnValue(true)

    const result = await isAdminUser()

    expect(result).toBe(true)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(mockHasAdminRoleAccess).toHaveBeenCalledWith(['fallback-role'])
  })

  it('returns false when user is unauthenticated', async () => {
    const serverClient = makeServerSupabaseClient({
      user: null,
    })
    mockCreateServerClient.mockReturnValue(serverClient.client)

    const result = await isAdminUser()

    expect(result).toBe(false)
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockHasAdminRoleAccess).not.toHaveBeenCalled()
  })

  it('returns false when profile is non-admin and discord fallback also denies access', async () => {
    const serverClient = makeServerSupabaseClient({
      user: { id: 'user-5', app_metadata: { is_admin: false } },
      discordProfile: { discord_roles: ['member-role'] },
    })
    const serviceRoleClient = makeServiceRoleClient({ role: 'member' })
    mockCreateServerClient.mockReturnValue(serverClient.client)
    mockCreateClient.mockReturnValue(serviceRoleClient as never)
    mockExtractDiscordRoleIdsFromUser.mockReturnValue(['jwt-role'])
    mockNormalizeDiscordRoleIds.mockReturnValue(['member-role'])
    mockHasAdminRoleAccess.mockReturnValue(false)

    const result = await isAdminUser()

    expect(result).toBe(false)
    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(mockNormalizeDiscordRoleIds).toHaveBeenCalledWith(['member-role'])
    expect(mockHasAdminRoleAccess).toHaveBeenCalledWith(['member-role'])
  })
})
