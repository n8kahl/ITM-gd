import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateClient,
  mockRequireAdminAccess,
  mockLogAdminActivity,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockRequireAdminAccess: vi.fn(),
  mockLogAdminActivity: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/access-control/admin-access', () => ({
  requireAdminAccess: (...args: unknown[]) => mockRequireAdminAccess(...args),
}))

vi.mock('@/lib/admin/audit-log', () => ({
  logAdminActivity: (...args: unknown[]) => mockLogAdminActivity(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

import { PUT } from '@/app/api/admin/tabs/route'

function makePutRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/tabs', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'

    mockRequireAdminAccess.mockResolvedValue({
      authorized: true,
      user: { id: '00000000-0000-4000-8000-000000000001' },
    })
  })

  it('deletes removed tabs, upserts incoming tabs, and revalidates config paths', async () => {
    const deleteInMock = vi.fn(async () => ({ error: null }))
    const deleteMock = vi.fn(() => ({
      in: deleteInMock,
    }))
    const upsertMock = vi.fn(async () => ({ error: null }))
    const tabSelectMock = vi.fn((columns: string) => {
      if (columns === 'tab_id') {
        return Promise.resolve({
          data: [{ tab_id: 'dashboard' }, { tab_id: 'legacy-tab' }],
          error: null,
        })
      }

      return {
        order: vi.fn(async () => ({
          data: [
            { tab_id: 'dashboard', sort_order: 0 },
            { tab_id: 'profile', sort_order: 99 },
          ],
          error: null,
        })),
      }
    })
    const guildRoleSelectMock = vi.fn(() => ({
      in: vi.fn(async () => ({
        data: [],
        error: null,
      })),
    }))

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tab_configurations') {
          return {
            select: tabSelectMock,
            delete: deleteMock,
            upsert: upsertMock,
          }
        }

        if (table === 'discord_guild_roles') {
          return {
            select: guildRoleSelectMock,
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await PUT(
      makePutRequest({
        tabs: [
          {
            tab_id: 'dashboard',
            label: 'Command Center',
            icon: 'LayoutDashboard',
            path: '/members',
            required_tier: 'core',
            sort_order: 0,
            is_required: true,
            is_active: true,
            mobile_visible: true,
            required_discord_role_ids: [],
          },
          {
            tab_id: 'profile',
            label: 'Profile',
            icon: 'UserCircle',
            path: '/members/profile',
            required_tier: 'core',
            sort_order: 99,
            is_required: true,
            is_active: true,
            mobile_visible: true,
            required_discord_role_ids: [],
          },
        ],
      }),
    )

    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)

    expect(deleteMock).toHaveBeenCalledTimes(1)
    expect(deleteInMock).toHaveBeenCalledWith('tab_id', ['legacy-tab'])
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(mockLogAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tabs_updated',
        details: expect.objectContaining({
          tabs_updated: ['dashboard', 'profile'],
          tabs_deleted: ['legacy-tab'],
        }),
      }),
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/members')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/api/config/tabs')
  })

  it('rejects duplicate tab IDs before database writes', async () => {
    mockCreateClient.mockReturnValue({
      from: vi.fn(),
    })

    const response = await PUT(
      makePutRequest({
        tabs: [
          {
            tab_id: 'dashboard',
            label: 'Dashboard',
            icon: 'LayoutDashboard',
            path: '/members',
            required_tier: 'core',
            sort_order: 0,
          },
          {
            tab_id: 'dashboard',
            label: 'Dashboard Duplicate',
            icon: 'LayoutDashboard',
            path: '/members-alt',
            required_tier: 'core',
            sort_order: 1,
          },
        ],
      }),
    )

    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('Duplicate tab_id')
    expect(mockLogAdminActivity).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns schema error when required_tier check constraint is outdated', async () => {
    const deleteInMock = vi.fn(async () => ({ error: null }))
    const deleteMock = vi.fn(() => ({
      in: deleteInMock,
    }))
    const upsertMock = vi.fn(async () => ({
      error: {
        message:
          'new row for relation "tab_configurations" violates check constraint "tab_configurations_required_tier_check"',
      },
    }))
    const tabSelectMock = vi.fn((columns: string) => {
      if (columns === 'tab_id') {
        return Promise.resolve({
          data: [{ tab_id: 'dashboard' }],
          error: null,
        })
      }
      return {
        order: vi.fn(async () => ({ data: [], error: null })),
      }
    })

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tab_configurations') {
          return {
            select: tabSelectMock,
            delete: deleteMock,
            upsert: upsertMock,
          }
        }

        if (table === 'discord_guild_roles') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
            })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    })

    const response = await PUT(
      makePutRequest({
        tabs: [
          {
            tab_id: 'dashboard',
            label: 'Dashboard',
            icon: 'LayoutDashboard',
            path: '/members',
            required_tier: 'core',
            sort_order: 0,
            is_required: true,
            is_active: true,
            mobile_visible: true,
            required_discord_role_ids: [],
          },
          {
            tab_id: 'trade-day-replay',
            label: 'Trade Day Replay',
            icon: 'Play',
            path: '/members/trade-day-replay',
            required_tier: 'admin',
            sort_order: 8,
            is_required: false,
            is_active: true,
            mobile_visible: true,
            required_discord_role_ids: [],
          },
        ],
      }),
    )

    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('SCHEMA_OUTDATED')
    expect(body.error.message).toContain('required_tier=admin')
    expect(mockLogAdminActivity).not.toHaveBeenCalled()
  })
})
