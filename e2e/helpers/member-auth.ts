import { BrowserContext, Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Mock Supabase session data for testing
 * This simulates what Supabase stores in localStorage after Discord OAuth
 */
export const mockSupabaseSession = {
  access_token: 'mock-access-token-for-testing',
  refresh_token: 'mock-refresh-token-for-testing',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'test-user-id-12345',
    email: 'testuser@example.com',
    user_metadata: {
      provider_id: '123456789012345678', // Discord user ID
      sub: '123456789012345678',
      full_name: 'Test User',
      avatar_url: 'https://cdn.discordapp.com/avatars/123456789/abc123.png',
      name: 'TestUser#1234',
      email: 'testuser@example.com',
      email_verified: true,
      provider: 'discord',
    },
    app_metadata: {
      provider: 'discord',
      providers: ['discord'],
    },
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
}

export const e2eBypassUserId = '00000000-0000-4000-8000-000000000001'
const e2eBypassSharedSecret = process.env.E2E_BYPASS_SHARED_SECRET
export const e2eBypassToken = e2eBypassSharedSecret
  ? `e2e:${e2eBypassSharedSecret}:${e2eBypassUserId}`
  : `e2e:${e2eBypassUserId}`

export const e2eBypassSession = {
  ...mockSupabaseSession,
  access_token: e2eBypassToken,
  refresh_token: 'e2e-refresh-token',
  user: {
    ...mockSupabaseSession.user,
    id: e2eBypassUserId,
    email: 'e2e-member@example.com',
  },
}

/**
 * Enable or disable middleware auth bypass headers for E2E contexts.
 * This mirrors the existing middleware bypass contract used in other suites.
 */
async function setE2EBypassHeader(page: Page, enabled: boolean): Promise<void> {
  await page.context().setExtraHTTPHeaders(enabled ? { 'x-e2e-bypass-auth': '1' } : {})
}

/**
 * Mock Discord profile data (what's stored after role sync)
 */
export const mockDiscordProfile = {
  discord_user_id: '123456789012345678',
  discord_username: 'TestUser',
  discord_discriminator: '1234',
  discord_avatar: 'abc123',
  discord_roles: ['role-core-sniper', 'role-member'],
  last_synced_at: new Date().toISOString(),
  permissions: [
    { id: 'perm-1', name: 'view_courses', description: 'View course library' },
    { id: 'perm-2', name: 'view_premium_content', description: 'View premium content' },
  ],
}

/**
 * Get the Supabase storage key for the current project
 */
function getSupabaseStorageKeys(): string[] {
  const keys = new Set<string>([
    'sb-localhost-auth-token',
    'sb-127.0.0.1-auth-token',
  ])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || readSupabaseUrlFromEnvFile()
  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname
      const projectRef = hostname.split('.')[0]
      if (projectRef) {
        keys.add(`sb-${projectRef}-auth-token`)
      }
    } catch {
      // Ignore invalid URL in test bootstrap.
    }
  }

  return Array.from(keys)
}

function readSupabaseUrlFromEnvFile(): string | null {
  const candidates = ['.env.local', '.env']

  for (const fileName of candidates) {
    const fullPath = path.resolve(process.cwd(), fileName)
    if (!fs.existsSync(fullPath)) continue

    const content = fs.readFileSync(fullPath, 'utf-8')
    const match = content.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)
    if (!match) continue

    const raw = match[1].trim()
    const unquoted = raw.replace(/^['"]|['"]$/g, '')
    if (unquoted.length > 0) return unquoted
  }

  return null
}

/**
 * Authenticate as a member by setting up localStorage with mock Supabase session
 * This simulates what happens after successful Discord OAuth
 */
export async function authenticateAsMember(
  page: Page,
  options: { bypassMiddleware?: boolean } = {},
): Promise<void> {
  const { bypassMiddleware = true } = options
  await setE2EBypassHeader(page, bypassMiddleware)

  // Navigate to a page first to set localStorage for the correct origin
  await page.goto('/')

  const storageKeys = getSupabaseStorageKeys()

  // Set the Supabase session in localStorage
  await page.evaluate(({ session, keys }) => {
    // Supabase stores the session as a JSON string
    keys.forEach((key: string) => {
      localStorage.setItem(key, JSON.stringify(session))
    })

    // Also set any other auth-related items that might be needed
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: session,
      expiresAt: session.expires_at,
    }))
  }, { session: mockSupabaseSession, keys: storageKeys })
}

/**
 * Authenticate using backend E2E bypass token (for backend-integrated test mode).
 */
export async function authenticateAsE2EBypassMember(page: Page): Promise<void> {
  await authenticateWithSession(page, e2eBypassSession, { bypassMiddleware: true })
}

/**
 * Authenticate with custom session data
 */
export async function authenticateWithSession(
  page: Page,
  session: typeof mockSupabaseSession,
  options: { bypassMiddleware?: boolean } = {},
): Promise<void> {
  const { bypassMiddleware = true } = options
  await setE2EBypassHeader(page, bypassMiddleware)

  await page.goto('/')
  const storageKeys = getSupabaseStorageKeys()

  await page.evaluate(({ sessionData, keys }) => {
    keys.forEach((key: string) => {
      localStorage.setItem(key, JSON.stringify(sessionData))
    })
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession: sessionData,
      expiresAt: sessionData.expires_at,
    }))
  }, { sessionData: session, keys: storageKeys })
}

/**
 * Clear member authentication (simulate logout)
 */
export async function clearMemberAuth(page: Page): Promise<void> {
  await setE2EBypassHeader(page, false)

  await page.evaluate(() => {
    // Clear all Supabase-related localStorage items
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('supabase') || key.includes('sb-'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    // Also clear sessionStorage
    sessionStorage.clear()
  })
}

/**
 * Check if member is authenticated (has valid session in localStorage)
 */
export async function isMemberAuthenticated(page: Page): Promise<boolean> {
  const storageKeys = getSupabaseStorageKeys()
  return await page.evaluate((keys) => {
    for (const key of keys) {
      const session = localStorage.getItem(key)
      if (!session) continue

      try {
        const parsed = JSON.parse(session)
        // Check if session is expired
        if (parsed.expires_at && parsed.expires_at < Math.floor(Date.now() / 1000)) {
          continue
        }
        return !!parsed.access_token
      } catch {
        // Keep scanning other keys
      }
    }
    return false
  }, storageKeys)
}

/**
 * Get the current user from localStorage
 */
export async function getCurrentUser(page: Page): Promise<typeof mockSupabaseSession.user | null> {
  const storageKeys = getSupabaseStorageKeys()
  return await page.evaluate((keys) => {
    for (const key of keys) {
      const session = localStorage.getItem(key)
      if (!session) continue

      try {
        const parsed = JSON.parse(session)
        if (parsed.user) {
          return parsed.user
        }
      } catch {
        // Keep scanning other keys
      }
    }
    return null
  }, storageKeys)
}

/**
 * Create an expired session for testing session expiry handling
 */
export function createExpiredSession(): typeof mockSupabaseSession {
  return {
    ...mockSupabaseSession,
    expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    expires_in: -3600,
  }
}

/**
 * Create a session that's about to expire (for testing refresh)
 */
export function createExpiringSession(): typeof mockSupabaseSession {
  return {
    ...mockSupabaseSession,
    expires_at: Math.floor(Date.now() / 1000) + 60, // Expires in 1 minute
    expires_in: 60,
  }
}
