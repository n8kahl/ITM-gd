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
})
