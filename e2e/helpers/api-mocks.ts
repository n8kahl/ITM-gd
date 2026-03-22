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
      { name: 'OpenAI Integration', status: 'pass' as const, message: 'OpenAI API key is configured', details: 'Key starts with "sk-..."', latency: 10 },
      { name: 'Discord Bot', status: 'pass' as const, message: 'Discord is configured', details: 'Guild ID: 123456...', latency: 15 },
      { name: 'Storage', status: 'pass' as const, message: 'Storage is accessible', details: 'Bucket "journal-screenshots" found', latency: 30 },
    ],
  },
  analytics: {
    period: '30d',
    platform: {
      total_members: 1250,
      new_members: 47,
      total_journal_entries: 892,
      ai_analysis_count: 340,
      ai_coach_sessions: 156,
      ai_coach_messages: 1204,
      shared_trade_cards: 89,
      active_users: 312,
      active_learners: 198,
      pending_applications: 3,
    },
    marketing: {
      total_page_views: 28500,
      unique_visitors: 4200,
      total_clicks: 1890,
      total_subscribers: 620,
      total_contacts: 45,
      conversion_rate: 2.18,
    },
    page_views_by_day: [],
    conversions_by_day: [],
    conversion_funnel: { modal_opened: 0, modal_closed: 0, form_submitted: 0, subscribed: 0 },
    device_breakdown: {},
    browser_breakdown: {},
    click_breakdown: {},
    top_pages: [],
    recent_subscribers: [],
    recent_contacts: [],
    recent_page_views: [],
    recent_sales: [],
    ai_coach_activity: [],
  },
  leads: {
    success: true,
    data: [
      { id: 'lead-1', full_name: 'Alice Johnson', status: 'pending', created_at: new Date().toISOString() },
      { id: 'lead-2', full_name: 'Bob Chen', status: 'approved', created_at: new Date(Date.now() - 86400000).toISOString() },
    ],
  },
  courses: {
    success: true,
    data: [
      {
        id: 'course-1',
        title: 'Options Mastery',
        description: 'Master options trading from basics to advanced',
        slug: 'options-mastery',
        is_published: true,
        display_order: 1,
        thumbnail_url: null,
        discord_role_required: null,
        lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }],
      },
      {
        id: 'course-2',
        title: 'SPX Day Trading',
        description: 'Learn to trade SPX 0DTE options',
        slug: 'spx-day-trading',
        is_published: false,
        display_order: 2,
        thumbnail_url: null,
        discord_role_required: '1111111111111111111',
        lessons: [{ id: 'l4' }],
      },
    ],
  },
  notifications: {
    success: true,
    data: [
      {
        id: 'notif-1',
        title: 'New Trade Alert',
        body: 'SPX 5850C setup identified in the trading room',
        status: 'sent' as const,
        target_type: 'all' as const,
        target_tiers: null,
        target_user_ids: null,
        delivered_count: 245,
        failed_count: 3,
        total_targeted: 248,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        title: 'Weekly Recap',
        body: 'Your weekly trading performance summary is ready',
        status: 'sent' as const,
        target_type: 'tier' as const,
        target_tiers: ['pro', 'executive'],
        target_user_ids: null,
        delivered_count: 89,
        failed_count: 0,
        total_targeted: 89,
        sent_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    total: 2,
  },
  systemWarning: {
    success: true,
    status: 'warning' as const,
    timestamp: new Date().toISOString(),
    results: [
      { name: 'Database Connection', status: 'pass' as const, message: 'Database is responsive', latency: 45 },
      { name: 'Edge Functions', status: 'pass' as const, message: 'Edge Functions are accessible', latency: 120 },
      { name: 'OpenAI Integration', status: 'pass' as const, message: 'OpenAI API key is configured', latency: 10 },
      { name: 'Discord Bot', status: 'warning' as const, message: 'Discord bot token not set', details: 'Guild ID is set but bot token is missing', latency: 15 },
      { name: 'Storage', status: 'pass' as const, message: 'Storage is accessible', latency: 30 },
    ],
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.system),
    })
  })

  // Mock admin analytics API
  await page.route('/api/admin/analytics*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.analytics),
    })
  })

  // Mock admin leads API
  await page.route('/api/admin/leads*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockApiResponses.leads),
    })
  })

  // Mock admin courses API
  await page.route('/api/admin/courses*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.courses),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
  })

  // Mock admin notifications API
  await page.route('/api/admin/notifications*', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.notifications),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stats: { delivered: 245, targeted: 248, failed: 3 } }),
      })
    }
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
