import { expect, test, type Page, type Route } from '@playwright/test'
import { enableMemberBypass } from './journal-test-helpers'

const nowIso = new Date().toISOString()

type MutableRecord = Record<string, unknown>

const baseProfile = {
  id: 'profile-1',
  user_id: '00000000-0000-4000-8000-000000000001',
  display_name: 'E2E Trader',
  bio: 'Options trader focused on high-quality setups.',
  tagline: 'Consistency over home runs',
  custom_avatar_url: null,
  banner_url: null,
  top_symbols: ['SPY', 'QQQ', 'TSLA'],
  preferred_strategy: 'Breakout Retest',
  avg_hold_minutes: 95,
  trading_style: 'day_trader',
  whop_user_id: null,
  whop_affiliate_url: 'https://whop.com/checkout/?a=e2e-ref',
  whop_membership_id: null,
  privacy_settings: {
    show_transcript: true,
    show_academy: true,
    show_trades_in_feed: true,
    show_on_leaderboard: true,
    show_discord_roles: true,
    profile_visibility: 'public',
  },
  notification_preferences: {
    feed_likes: true,
    feed_comments: true,
    leaderboard_changes: true,
    achievement_earned: true,
    weekly_digest: true,
  },
  ai_preferences: {
    risk_tolerance: 'moderate',
    preferred_symbols: ['SPY'],
    trading_style_notes: '',
    account_size_range: '$25k - $100k',
  },
  profile_completed_at: null,
  last_active_at: nowIso,
  created_at: nowIso,
  updated_at: nowIso,
}

const transcript = {
  total_trades: 34,
  winning_trades: 22,
  losing_trades: 12,
  win_rate: 64.7,
  total_pnl: 4820,
  profit_factor: 1.85,
  avg_pnl: 141.76,
  best_trade_pnl: 920,
  worst_trade_pnl: -410,
  best_month: 'Jan 2026',
  current_win_streak: 4,
  longest_win_streak: 7,
  avg_discipline_score: 4.2,
  avg_ai_grade: 'B',
  ai_grade_distribution: { A: 6, B: 14, C: 9, D: 4, F: 1 },
  most_profitable_symbol: 'SPY',
  most_traded_symbol: 'QQQ',
  avg_hold_duration_min: 88,
  equity_curve: [
    { date: '2026-01-10', cumulative_pnl: 720 },
    { date: '2026-01-18', cumulative_pnl: 1560 },
    { date: '2026-01-26', cumulative_pnl: 2510 },
    { date: '2026-02-02', cumulative_pnl: 3670 },
    { date: '2026-02-09', cumulative_pnl: 4820 },
  ],
}

const baseFeedItems = [
  {
    id: 'feed-trade-1',
    user_id: '00000000-0000-4000-8000-000000000001',
    item_type: 'trade_card',
    reference_id: 'trade-card-1',
    reference_table: 'shared_trade_cards',
    display_data: {
      symbol: 'SPY',
      direction: 'long',
      contract_type: 'call',
      pnl: 420.5,
      pnl_percentage: 8.4,
      is_winner: true,
      template: 'dark-elite',
      image_url: null,
      ai_grade: 'A',
      strategy: 'Breakout Retest',
      entry_price: 517.1,
      exit_price: 522.8,
    },
    likes_count: 3,
    comments_count: 0,
    visibility: 'public',
    is_featured: true,
    is_pinned: false,
    created_at: '2026-02-10T13:00:00.000Z',
    updated_at: '2026-02-10T13:00:00.000Z',
    author: {
      display_name: 'E2E Trader',
      discord_username: 'e2e_member',
      discord_avatar: null,
      discord_user_id: null,
      membership_tier: 'pro',
    },
  },
  {
    id: 'feed-achievement-1',
    user_id: '00000000-0000-4000-8000-000000000001',
    item_type: 'achievement',
    reference_id: 'achievement-1',
    reference_table: 'user_achievements',
    display_data: {
      title: 'Seven Day Discipline Streak',
      icon: 'trophy',
      type: 'discipline',
      xp_earned: 120,
      verification_code: 'ACH-XYZ-1001',
      tier: 'emerald',
    },
    likes_count: 1,
    comments_count: 0,
    visibility: 'public',
    is_featured: false,
    is_pinned: false,
    created_at: '2026-02-09T17:00:00.000Z',
    updated_at: '2026-02-09T17:00:00.000Z',
    author: {
      display_name: 'E2E Trader',
      discord_username: 'e2e_member',
      discord_avatar: null,
      discord_user_id: null,
      membership_tier: 'pro',
    },
  },
  {
    id: 'feed-highlight-1',
    user_id: '00000000-0000-4000-8000-000000000001',
    item_type: 'highlight',
    reference_id: null,
    reference_table: null,
    display_data: {
      title: 'Member Spotlight',
      description: 'Great risk management and consistent execution this week.',
      author_note: 'Keep stacking quality decisions.',
      spotlight_type: 'member_spotlight',
    },
    likes_count: 2,
    comments_count: 0,
    visibility: 'public',
    is_featured: true,
    is_pinned: false,
    created_at: '2026-02-08T14:00:00.000Z',
    updated_at: '2026-02-08T14:00:00.000Z',
    author: {
      display_name: 'Coach Team',
      discord_username: 'itm_coach',
      discord_avatar: null,
      discord_user_id: null,
      membership_tier: 'executive',
    },
  },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function successBody(data: unknown): string {
  return JSON.stringify({ success: true, data })
}

function mergedSettings(profile: typeof baseProfile, patch: MutableRecord) {
  return {
    ...profile,
    ...patch,
    privacy_settings: {
      ...profile.privacy_settings,
      ...(patch.privacy_settings as MutableRecord | undefined),
    },
    notification_preferences: {
      ...profile.notification_preferences,
      ...(patch.notification_preferences as MutableRecord | undefined),
    },
    ai_preferences: {
      ...profile.ai_preferences,
      ...(patch.ai_preferences as MutableRecord | undefined),
    },
    updated_at: new Date().toISOString(),
  }
}

async function fulfillJson(route: Route, body: string): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body,
  })
}

async function setupProfileSocialMocks(page: Page): Promise<void> {
  let profile = clone(baseProfile)
  const feedItems = clone(baseFeedItems)
  const likeState = new Map(feedItems.map((item) => [item.id, {
    liked: false,
    count: item.likes_count,
  }]))

  await page.route('**/api/config/roles', async (route) => {
    await fulfillJson(route, JSON.stringify({}))
  })

  await page.route('**/api/config/tabs', async (route) => {
    await fulfillJson(
      route,
      JSON.stringify({
        success: true,
        data: [
          {
            tab_id: 'dashboard',
            required_tier: 'core',
            is_active: true,
            is_required: true,
            mobile_visible: true,
            sort_order: 1,
            label: 'Dashboard',
            icon: 'home',
            path: '/members',
          },
          {
            tab_id: 'journal',
            required_tier: 'core',
            is_active: true,
            is_required: true,
            mobile_visible: true,
            sort_order: 2,
            label: 'Journal',
            icon: 'book',
            path: '/members/journal',
          },
          {
            tab_id: 'social',
            required_tier: 'core',
            is_active: true,
            is_required: false,
            mobile_visible: true,
            sort_order: 3,
            label: 'Social',
            icon: 'users',
            path: '/members/social',
          },
          {
            tab_id: 'profile',
            required_tier: 'core',
            is_active: true,
            is_required: true,
            mobile_visible: true,
            sort_order: 4,
            label: 'Profile',
            icon: 'user',
            path: '/members/profile',
          },
        ],
      }),
    )
  })

  await page.route('**/api/members/profile', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await fulfillJson(route, successBody(profile))
      return
    }

    if (request.method() === 'PATCH') {
      const patch = (request.postDataJSON() ?? {}) as MutableRecord
      profile = mergedSettings(profile, patch)
      await fulfillJson(route, successBody(profile))
      return
    }

    await route.fallback()
  })

  await page.route('**/api/members/profile/transcript**', async (route) => {
    await fulfillJson(route, successBody(transcript))
  })

  await page.route('**/api/members/affiliate**', async (route) => {
    await fulfillJson(route, successBody({
      stats: {
        total_referrals: 12,
        active_referrals: 4,
        total_earnings: 860,
        unpaid_earnings: 120,
        conversion_rate: 41.7,
      },
      recent_referrals: [],
    }))
  })

  await page.route('**/api/academy-v3/mastery**', async (route) => {
    await fulfillJson(route, successBody({
      items: [
        {
          competencyId: '22222222-2222-4222-8222-111111111111',
          competencyKey: 'risk_definition',
          competencyTitle: 'Risk Definition',
          currentScore: 84,
          confidence: 0.72,
          needsRemediation: false,
          lastEvaluatedAt: '2026-02-10T12:00:00.000Z',
        },
        {
          competencyId: '22222222-2222-4222-8222-222222222222',
          competencyKey: 'execution_discipline',
          competencyTitle: 'Execution Discipline',
          currentScore: 78,
          confidence: 0.67,
          needsRemediation: false,
          lastEvaluatedAt: '2026-02-10T12:00:00.000Z',
        },
      ],
    }))
  })

  await page.route('**/api/social/community-stats**', async (route) => {
    await fulfillJson(route, successBody({
      total_members: 128,
      trades_shared: 86,
      achievements_earned: 312,
    }))
  })

  await page.route('**/api/social/leaderboard**', async (route) => {
    const url = new URL(route.request().url())
    const period = url.searchParams.get('period') || 'weekly'
    const category = url.searchParams.get('category') || 'win_rate'

    await fulfillJson(route, successBody({
      period,
      category,
      snapshot_date: '2026-02-10',
      entries: [
        {
          id: 'lb-1',
          user_id: '00000000-0000-4000-8000-000000000001',
          period,
          category,
          rank: 1,
          value: 64.7,
          display_name: 'E2E Trader',
          discord_avatar: null,
          discord_username: 'e2e_member',
          membership_tier: 'pro',
          snapshot_date: '2026-02-10',
        },
        {
          id: 'lb-2',
          user_id: '00000000-0000-4000-8000-000000000002',
          period,
          category,
          rank: 2,
          value: 59.2,
          display_name: 'Momentum Mike',
          discord_avatar: null,
          discord_username: 'mike',
          membership_tier: 'core',
          snapshot_date: '2026-02-10',
        },
      ],
      user_entry: {
        id: 'lb-1',
        user_id: '00000000-0000-4000-8000-000000000001',
        period,
        category,
        rank: 1,
        value: 64.7,
        display_name: 'E2E Trader',
        discord_avatar: null,
        discord_username: 'e2e_member',
        membership_tier: 'pro',
        snapshot_date: '2026-02-10',
      },
    }))
  })

  await page.route('**/api/social/feed**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    const type = url.searchParams.get('type')
    const featuredOnly = url.searchParams.get('featured_only') === 'true'

    let items = [...feedItems]

    if (type && type !== 'all') {
      items = items.filter((item) => item.item_type === type)
    }

    if (featuredOnly) {
      items = items.filter((item) => item.is_featured)
    }

    const hydrated = items.map((item) => {
      const state = likeState.get(item.id)
      return {
        ...item,
        likes_count: state?.count ?? item.likes_count,
        user_has_liked: state?.liked ?? false,
      }
    })

    await fulfillJson(route, successBody({
      items: hydrated,
      next_cursor: null,
      has_more: false,
      total_count: hydrated.length,
    }))
  })

  await page.route('**/api/social/feed/*/like', async (route) => {
    const request = route.request()
    const itemId = request.url().split('/').slice(-2)[0]
    const state = likeState.get(itemId)

    if (!state) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Not found' }),
      })
      return
    }

    if (request.method() === 'POST') {
      if (!state.liked) {
        state.liked = true
        state.count += 1
      }
    }

    if (request.method() === 'DELETE') {
      if (state.liked) {
        state.liked = false
        state.count = Math.max(0, state.count - 1)
      }
    }

    await fulfillJson(route, successBody({ liked: state.liked, likes_count: state.count }))
  })
}

test.describe('Profile Hub + Trade Social', () => {
  test.beforeEach(async ({ page }) => {
    await enableMemberBypass(page)
    await setupProfileSocialMocks(page)
  })

  test('renders profile hub sections', async ({ page }) => {
    await page.goto('/members/profile', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('trader-identity-card')).toBeVisible()
    await expect(page.getByTestId('trader-avatar')).toBeVisible()
    await expect(page.getByTestId('tier-badge')).toBeVisible()
    await expect(page.getByTestId('trading-transcript')).toBeVisible()
    await expect(page.getByTestId('academy-progress')).toBeVisible()
  })

  test('opens settings sheet and saves settings', async ({ page }) => {
    await page.goto('/members/profile', { waitUntil: 'domcontentloaded' })

    await page.getByTestId('settings-button').click()
    await expect(page.getByTestId('settings-sheet')).toBeVisible()

    await page.locator('[data-testid="privacy-transcript-toggle"] button').click()
    await page.getByTestId('save-settings').click()

    await expect(page.getByTestId('settings-success-toast')).toBeVisible()
  })

  test('renders social feed and filters by trade cards', async ({ page }) => {
    await page.goto('/members/social', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('social-feed')).toBeVisible()
    await expect(page.getByTestId('feed-item').first()).toBeVisible()

    await page.getByTestId('filter-trade_card').click()

    const items = page.getByTestId('feed-item')
    await expect(items.first()).toBeVisible()

    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index += 1) {
      await expect(items.nth(index)).toHaveAttribute('data-item-type', 'trade_card')
    }
  })

  test('likes and unlikes a feed item with optimistic UI', async ({ page }) => {
    await page.goto('/members/social', { waitUntil: 'domcontentloaded' })

    const likeButton = page.getByTestId('like-button').first()
    await expect(likeButton).toHaveAttribute('data-liked', 'false')

    await likeButton.click()
    await expect(likeButton).toHaveAttribute('data-liked', 'true')

    await page.waitForTimeout(350)

    await likeButton.click()
    await expect(likeButton).toHaveAttribute('data-liked', 'false')
  })

  test('renders leaderboard sidebar', async ({ page }) => {
    await page.goto('/members/social', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('leaderboard')).toBeVisible()
    await expect(page.getByTestId('leaderboard-entry').first()).toBeVisible()
  })
})
