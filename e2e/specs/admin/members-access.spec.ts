import { expect, test, type Page, type Route } from '@playwright/test'
import { authenticateAsAdmin } from '../../helpers/admin-auth'

const DIRECTORY_ROW = {
  discord_user_id: '123456789012345678',
  username: 'tradernate',
  global_name: 'Trader Nate',
  nickname: 'Nate',
  avatar: null,
  avatar_url: null,
  linked_user_id: '00000000-0000-4000-8000-000000000001',
  email: 'nate@example.com',
  link_status: 'linked',
  resolved_tier: 'pro',
  access_status: 'member',
  is_admin: false,
  is_privileged: false,
  has_members_access: true,
  active_override_count: 0,
  role_summary: [
    { role_id: 'role-member', role_name: 'Members' },
    { role_id: 'role-pro', role_name: 'Pro' },
  ],
  role_count: 2,
  last_synced_at: new Date().toISOString(),
  sync_error: null,
}

const DETAIL_RESPONSE = {
  success: true,
  data: {
    identity: {
      discord_user_id: DIRECTORY_ROW.discord_user_id,
      username: DIRECTORY_ROW.username,
      global_name: DIRECTORY_ROW.global_name,
      nickname: DIRECTORY_ROW.nickname,
      avatar: null,
      avatar_url: null,
      email: DIRECTORY_ROW.email,
      linked_user_id: DIRECTORY_ROW.linked_user_id,
      link_status: DIRECTORY_ROW.link_status,
      is_in_guild: true,
      sources: {
        roles: 'discord_guild_members',
        identity: 'discord_guild_members',
      },
    },
    discord_roles: [
      { role_id: 'role-member', role_name: 'Members' },
      { role_id: 'role-pro', role_name: 'Pro' },
    ],
    app_access: {
      resolved_tier: 'pro',
      is_admin: false,
      is_privileged: false,
      has_members_access: true,
      allowed_tabs: ['dashboard', 'journal'],
    },
    controls: {
      allow_discord_role_mutation: true,
      role_catalog: [
        { role_id: 'role-member', role_name: 'Members', managed: false, position: 10 },
        { role_id: 'role-pro', role_name: 'Pro', managed: false, position: 9 },
        { role_id: 'role-admin', role_name: 'Admin', managed: false, position: 8 },
      ],
    },
    tab_matrix: [
      {
        tabId: 'dashboard',
        label: 'Dashboard',
        path: '/members',
        requiredTier: 'core',
        requiredRoleIds: [],
        requiredRoleNames: [],
        allowed: true,
        reasonCode: 'tier_allowed',
        reason: 'Allowed for this tier.',
        overrideApplied: null,
      },
    ],
    profile_sync_health: {
      last_synced_at: new Date().toISOString(),
      warnings: [],
      guild_sync_error: null,
      linked_profile_last_synced_at: new Date().toISOString(),
      linked_auth_created_at: new Date().toISOString(),
      linked_auth_last_sign_in_at: new Date().toISOString(),
    },
    overrides: [],
    audit_history: [],
  },
}

const MEMBER_TRADES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: DIRECTORY_ROW.linked_user_id,
    trade_date: '2026-03-12T14:35:00.000Z',
    symbol: 'AAPL',
    direction: 'long',
    contract_type: 'call',
    entry_price: 2.15,
    exit_price: 3.4,
    position_size: 3,
    pnl: 375,
    pnl_percentage: 58.2,
    is_winner: true,
    is_open: false,
    entry_timestamp: '2026-03-12T14:35:00.000Z',
    exit_timestamp: '2026-03-12T15:16:00.000Z',
    stop_loss: 1.7,
    initial_target: 3.1,
    hold_duration_min: 41,
    mfe_percent: 62.4,
    mae_percent: -8.3,
    strike_price: 205,
    expiration_date: '2026-03-20',
    dte_at_entry: 8,
    iv_at_entry: 24.7,
    delta_at_entry: 0.42,
    theta_at_entry: -0.08,
    gamma_at_entry: 0.03,
    vega_at_entry: 0.12,
    underlying_at_entry: 203.9,
    underlying_at_exit: 205.4,
    mood_before: 'confident',
    mood_after: 'excited',
    discipline_score: 5,
    followed_plan: true,
    deviation_notes: null,
    strategy: 'Bullish breakout at open',
    setup_notes: 'Held above VWAP and reclaimed premarket high.',
    execution_notes: 'Scaled out into momentum and left a runner.',
    lessons_learned: 'The early confirmation reduced hesitation.',
    tags: ['breakout', 'opening-drive'],
    rating: 5,
    screenshot_url: null,
    screenshot_storage_path: null,
    ai_analysis: {
      grade: 'A',
      entry_quality: 'Entered at confirmation.',
      exit_quality: 'Scaled out efficiently.',
      risk_management: 'Risk was defined before entry.',
      lessons: ['Keep waiting for confirmation'],
      scored_at: '2026-03-12T16:00:00.000Z',
    },
    market_context: null,
    import_id: null,
    is_favorite: true,
    setup_type: 'Opening Breakout',
    is_draft: false,
    draft_status: null,
    draft_expires_at: null,
    coach_review_status: 'completed',
    coach_review_requested_at: '2026-03-12T15:20:00.000Z',
    created_at: '2026-03-12T15:20:00.000Z',
    updated_at: '2026-03-12T16:00:00.000Z',
    member_display_name: 'Trader Nate',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: DIRECTORY_ROW.linked_user_id,
    trade_date: '2026-03-11T16:05:00.000Z',
    symbol: 'TSLA',
    direction: 'short',
    contract_type: 'put',
    entry_price: 4.8,
    exit_price: 3.9,
    position_size: 2,
    pnl: -180,
    pnl_percentage: -18.75,
    is_winner: false,
    is_open: false,
    entry_timestamp: '2026-03-11T16:05:00.000Z',
    exit_timestamp: '2026-03-11T17:02:00.000Z',
    stop_loss: 5.4,
    initial_target: 3.6,
    hold_duration_min: 57,
    mfe_percent: 11.2,
    mae_percent: -20.4,
    strike_price: 180,
    expiration_date: '2026-03-20',
    dte_at_entry: 9,
    iv_at_entry: 38.1,
    delta_at_entry: -0.35,
    theta_at_entry: -0.11,
    gamma_at_entry: 0.04,
    vega_at_entry: 0.18,
    underlying_at_entry: 182.4,
    underlying_at_exit: 184.1,
    mood_before: 'neutral',
    mood_after: 'frustrated',
    discipline_score: 2,
    followed_plan: false,
    deviation_notes: 'Held after invalidation instead of stopping out.',
    strategy: 'Fade failed bounce',
    setup_notes: 'Countertrend setup into resistance.',
    execution_notes: 'Missed the stop and let the trade extend.',
    lessons_learned: 'Respect invalidation levels immediately.',
    tags: ['fade'],
    rating: 2,
    screenshot_url: null,
    screenshot_storage_path: null,
    ai_analysis: null,
    market_context: null,
    import_id: null,
    is_favorite: false,
    setup_type: 'Failed Bounce',
    is_draft: false,
    draft_status: null,
    draft_expires_at: null,
    coach_review_status: 'pending',
    coach_review_requested_at: '2026-03-11T17:10:00.000Z',
    created_at: '2026-03-11T17:10:00.000Z',
    updated_at: '2026-03-11T17:10:00.000Z',
    member_display_name: 'Trader Nate',
  },
]

async function setupMembersAccessMocks(page: Page) {
  await page.route('/api/admin/members/directory*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [DIRECTORY_ROW],
        meta: { resultCount: 1 },
      }),
    })
  })

  await page.route(`/api/admin/members/directory/${DIRECTORY_ROW.discord_user_id}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL_RESPONSE),
    })
  })

  await page.route('/api/admin/trade-review/browse*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: MEMBER_TRADES,
        meta: { total: MEMBER_TRADES.length },
      }),
    })
  })

  await page.route(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/sync`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { evaluation: DETAIL_RESPONSE.data.app_access } }),
    })
  })

  await page.route('/api/admin/members/sync-bulk', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { syncedCount: 1, missingCount: 0 } }),
    })
  })

  await page.route(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/overrides`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  await page.route(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/roles`, async (route: Route) => {
    const request = route.request()
    const body = request.postDataJSON() as { action?: string } | null
    const payload = body?.action === 'preview'
      ? {
          success: true,
          data: {
            mutation_enabled: true,
            manageable: true,
            manageability_reason: null,
            role: { id: 'role-admin', name: 'Admin' },
            preview_evaluation: {
              resolvedTier: 'pro',
              isAdmin: true,
              hasMembersAccess: true,
              allowedTabs: ['dashboard', 'journal', 'admin'],
            },
          },
        }
      : {
          success: true,
          data: {
            role: { id: 'role-admin', name: 'Admin' },
            evaluation: {
              resolvedTier: 'pro',
              isAdmin: true,
              hasMembersAccess: true,
              allowedTabs: ['dashboard', 'journal', 'admin'],
            },
          },
        }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })

  await page.route(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/link`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: DETAIL_RESPONSE.data.app_access }),
    })
  })

  await page.route(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/unlink`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: DETAIL_RESPONSE.data.app_access }),
    })
  })
}

test.describe('Admin: Member Access Control Center', () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticateAsAdmin(context)
    await setupMembersAccessMocks(page)
  })

  test('loads the guild directory and member detail workspace', async ({ page }) => {
    await page.goto('/admin/members-access')

    await expect(page.getByRole('heading', { name: /Member Access Control Center/i })).toBeVisible()
    await expect(page.getByTestId(`member-directory-row-${DIRECTORY_ROW.discord_user_id}`)).toBeVisible()
    await expect(page.getByText(/Member Detail Workspace/i)).toBeVisible()
    await expect(page.getByText(DIRECTORY_ROW.email)).toBeVisible()
  })

  test('creates an override from the detail workspace', async ({ page }) => {
    await page.goto('/admin/members-access')
    await page.getByRole('tab', { name: 'Overrides' }).click()
    const overridesRequest = page.waitForResponse((response) =>
      response.url().includes(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/overrides`)
      && response.request().method() === 'POST',
    )
    await page.getByTestId('member-override-reason').fill('E2E override test')
    await page.getByTestId('member-override-create-button').click()
    await overridesRequest

    await page.getByRole('tab', { name: 'Overrides' }).click()
    await expect(page.getByTestId('member-overrides-panel')).toBeVisible()
    await expect(page.getByTestId('member-overrides-empty')).toBeVisible()
  })

  test('previews a Discord role change before apply', async ({ page }) => {
    await page.goto('/admin/members-access')
    await page.getByRole('tab', { name: 'Roles' }).click()
    const rolesPanel = page.getByTestId('member-roles-panel')

    await page.getByTestId('member-role-operation-trigger').click()
    await page.getByRole('option', { name: 'Add role' }).click()

    await page.getByTestId('member-role-select-trigger').click()
    await page.getByRole('option', { name: 'Admin' }).click()

    await page.getByTestId('member-role-reason').fill('E2E preview')
    const previewRequest = page.waitForResponse((response) =>
      response.url().includes(`/api/admin/members/${DIRECTORY_ROW.discord_user_id}/roles`)
      && response.request().method() === 'POST',
    )
    await page.getByTestId('member-role-preview-button').click()
    await previewRequest

    await expect(page.getByTestId('member-role-preview')).toBeVisible()
    await expect(page.getByTestId('member-role-preview')).toContainText('Role Change Preview')
    await expect(page.getByTestId('member-role-preview')).toContainText('Admin')
  })

  test('shows member logged trades and trade detail in the workspace', async ({ page }) => {
    await page.goto('/admin/members-access')
    await page.getByRole('tab', { name: 'Trades' }).click()

    await expect(page.getByTestId('member-trades-panel')).toBeVisible()
    await expect(page.getByText('Logged Trades')).toBeVisible()
    await expect(page.getByTestId(`member-trade-row-${MEMBER_TRADES[0].id}`)).toBeVisible()
    await expect(page.getByTestId('member-trade-detail-link')).toHaveAttribute('href', `/admin/trade-review/${MEMBER_TRADES[0].id}`)
    await expect(page.getByText('Bullish breakout at open')).toBeVisible()
  })
})
