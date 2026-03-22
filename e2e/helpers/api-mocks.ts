import { Page, Route } from '@playwright/test'

// Mock responses for admin API routes
export const mockApiResponses = {
  roles: {
    success: true,
    roles: [
      {
        discord_role_id: '1111111111111111111',
        discord_role_name: 'Core Sniper',
        permission_ids: ['perm-1', 'perm-2'],
        mapping_ids: ['map-1', 'map-2'],
      },
      {
        discord_role_id: '2222222222222222222',
        discord_role_name: 'Pro Sniper',
        permission_ids: ['perm-1', 'perm-2', 'perm-3'],
        mapping_ids: ['map-3', 'map-4', 'map-5'],
      },
    ],
    permissions: [
      { id: 'perm-1', name: 'view_courses', description: 'View course library' },
      { id: 'perm-2', name: 'view_premium_content', description: 'View premium content' },
      { id: 'perm-3', name: 'admin_dashboard', description: 'Access admin dashboard' },
    ],
  },
  settings: {
    success: true,
    data: [
      { key: 'discord_guild_id', value: '123456789012345678', description: 'Discord server ID', is_masked: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { key: 'discord_bot_token', value: '••••••••••••', description: 'Discord bot token', is_masked: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { key: 'openai_api_key', value: '••••••••••••', description: 'OpenAI API key', is_masked: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { key: 'telegram_bot_token', value: '••••••••••••', description: 'Telegram bot token', is_masked: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
  },
  system: {
    success: true,
    status: 'healthy' as const,
    timestamp: new Date().toISOString(),
    results: [
      { name: 'Database Connection', status: 'pass' as const, message: 'Database is responsive', details: 'Query returned successfully', latency: 45 },
      { name: 'Edge Functions', status: 'pass' as const, message: 'Edge Functions are accessible', details: 'notify-team-lead responded with status 200', latency: 120 },
      { name: 'OpenAI Integration', status: 'pass' as const, message: 'OpenAI API key is configured', details: 'Key starts with "sk-..."', latency: 10, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'Massive.com', status: 'pass' as const, message: 'Massive.com API is reachable', details: 'SPY ticker lookup succeeded', latency: 85, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'FRED', status: 'pass' as const, message: 'FRED API is reachable', details: 'Federal Funds Rate series lookup succeeded', latency: 95, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'FMP', status: 'pass' as const, message: 'FMP API is reachable', details: 'Stock list endpoint responded', latency: 70, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'Discord Bot', status: 'pass' as const, message: 'Discord is configured', details: 'Guild ID: 123456...', latency: 15 },
      { name: 'Redis', status: 'pass' as const, message: 'Redis is configured and backend is reachable', details: 'REDIS_URL is set', latency: 8 },
      { name: 'Storage', status: 'pass' as const, message: 'Storage is accessible', details: 'Bucket "journal-screenshots" found', latency: 30 },
    ],
  },
  systemWarning: {
    success: true,
    status: 'warning' as const,
    timestamp: new Date().toISOString(),
    results: [
      { name: 'Database Connection', status: 'pass' as const, message: 'Database is responsive', latency: 45 },
      { name: 'Edge Functions', status: 'pass' as const, message: 'Edge Functions are accessible', latency: 120 },
      { name: 'OpenAI Integration', status: 'pass' as const, message: 'OpenAI API key is configured', latency: 10, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'Massive.com', status: 'pass' as const, message: 'Massive.com API is reachable', latency: 85, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'FRED', status: 'pass' as const, message: 'FRED API is reachable', latency: 95, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'FMP', status: 'pass' as const, message: 'FMP API is reachable', latency: 70, circuitState: 'CLOSED' as const, failureCount: 0 },
      { name: 'Discord Bot', status: 'warning' as const, message: 'Discord bot token not set', details: 'Guild ID is set but bot token is missing', latency: 15 },
      { name: 'Redis', status: 'warning' as const, message: 'Redis not configured', details: 'REDIS_URL not set', latency: 2 },
      { name: 'Storage', status: 'pass' as const, message: 'Storage is accessible', latency: 30 },
    ],
  },
  edgeFunctions: {
    success: true,
    metrics: [
      { functionName: 'aggregate-chat-analytics', totalInvocations: 120, successCount: 118, errorCount: 2, errorRate: 2, avgExecutionTimeMs: 340, p95ExecutionTimeMs: 890, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'analyze-trade-screenshot', totalInvocations: 45, successCount: 44, errorCount: 1, errorRate: 2, avgExecutionTimeMs: 1200, p95ExecutionTimeMs: 2300, lastInvokedAt: new Date().toISOString(), lastError: 'Timeout' },
      { functionName: 'chat-visitor-sync', totalInvocations: 300, successCount: 300, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 85, p95ExecutionTimeMs: 150, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'compute-leaderboards', totalInvocations: 24, successCount: 24, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 560, p95ExecutionTimeMs: 780, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'create-team-member', totalInvocations: 5, successCount: 5, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 200, p95ExecutionTimeMs: 300, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'cron-archive-conversations', totalInvocations: 48, successCount: 48, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 420, p95ExecutionTimeMs: 650, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'handle-chat-message', totalInvocations: 1500, successCount: 1490, errorCount: 10, errorRate: 1, avgExecutionTimeMs: 150, p95ExecutionTimeMs: 400, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'notify-team-lead', totalInvocations: 30, successCount: 30, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 180, p95ExecutionTimeMs: 250, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'send-chat-transcript', totalInvocations: 80, successCount: 79, errorCount: 1, errorRate: 1, avgExecutionTimeMs: 300, p95ExecutionTimeMs: 500, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'send-push-notification', totalInvocations: 200, successCount: 198, errorCount: 2, errorRate: 1, avgExecutionTimeMs: 95, p95ExecutionTimeMs: 200, lastInvokedAt: new Date().toISOString(), lastError: null },
      { functionName: 'sync-discord-roles', totalInvocations: 60, successCount: 60, errorCount: 0, errorRate: 0, avgExecutionTimeMs: 250, p95ExecutionTimeMs: 400, lastInvokedAt: new Date().toISOString(), lastError: null },
    ],
    hoursBack: 24,
    tableExists: true,
  },
}

/**
 * Set up API mocks for admin routes
 */
export async function setupAdminApiMocks(page: Page): Promise<void> {
  // Mock admin roles API
  await page.route('/api/admin/roles', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.roles),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
  })

  // Mock admin settings API
  await page.route('/api/admin/settings*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.settings),
    })
  })

  // Mock admin system API
  await page.route('/api/admin/system', async (route: Route) => {
    // Don't match sub-routes like /api/admin/system/edge-functions
    const url = new URL(route.request().url())
    if (url.pathname !== '/api/admin/system') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.system),
    })
  })

  // Mock admin system edge functions API
  await page.route('/api/admin/system/edge-functions', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.edgeFunctions),
    })
  })
}

/**
 * Mock member journal API
 */
export async function setupMemberApiMocks(page: Page): Promise<void> {
  await page.route('/api/members/journal*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        streaks: {
          current_streak: 5,
          longest_streak: 10,
          total_entries: 20,
          total_winners: 15,
          total_losers: 5,
        },
      }),
    })
  })

  // Mock courses API
  await page.route('**/rest/v1/courses*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '1',
          title: 'Trading Fundamentals',
          description: 'Learn the basics of trading',
          slug: 'trading-fundamentals',
          is_published: true,
          display_order: 1,
          lessons: [],
        },
      ]),
    })
  })
}
