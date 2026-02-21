import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateServerSupabaseClient,
  mockCreateClient,
  mockLogAdminActivity,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockCreateServerSupabaseClient: vi.fn(),
  mockCreateClient: vi.fn(),
  mockLogAdminActivity: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabaseClient: (...args: unknown[]) =>
    mockCreateServerSupabaseClient(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
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

    mockCreateServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: '00000000-0000-4000-8000-000000000001',
              app_metadata: { is_admin: true },
            },
          },
          error: null,
        })),
      },
      from: vi.fn(),
    })
  })

  it('deletes removed tabs, upserts incoming tabs, and revalidates config paths', async () => {
    const deleteInMock = vi.fn(async () => ({ error: null }))
    const deleteMock = vi.fn(() => ({
      in: deleteInMock,
    }))
    const upsertMock = vi.fn(async (rows: unknown[]) => {
      void rows
      return { error: null }
    })
    const orderMock = vi.fn(async () => ({
      data: [
        { tab_id: 'dashboard', sort_order: 0 },
        { tab_id: 'profile', sort_order: 99 },
      ],
      error: null,
    }))
    const selectMock = vi.fn((columns: string) => {
      if (columns === 'tab_id') {
        return Promise.resolve({
          data: [{ tab_id: 'dashboard' }, { tab_id: 'legacy-tab' }],
          error: null,
        })
      }
      return {
        order: orderMock,
      }
    })

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== 'tab_configurations') {
          throw new Error(`Unexpected table: ${table}`)
        }
        return {
          select: selectMock,
          delete: deleteMock,
          upsert: upsertMock,
        }
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
    expect(upsertMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ tab_id: 'dashboard' }),
      expect.objectContaining({ tab_id: 'profile' }),
    ]))

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
})
