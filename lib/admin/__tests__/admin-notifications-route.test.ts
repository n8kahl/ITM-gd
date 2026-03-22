import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateClient,
  mockIsAdminUser,
  mockLogAdminActivity,
  mockResolveTargetSubscriptions,
  mockSendBatchNotifications,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockIsAdminUser: vi.fn(),
  mockLogAdminActivity: vi.fn(),
  mockResolveTargetSubscriptions: vi.fn(),
  mockSendBatchNotifications: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/supabase-server', () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-user-id' } } })) },
  })),
}))

vi.mock('@/lib/admin/audit-log', () => ({
  logAdminActivity: (...args: unknown[]) => mockLogAdminActivity(...args),
}))

vi.mock('@/lib/web-push-service', () => ({
  resolveTargetSubscriptions: (...args: unknown[]) => mockResolveTargetSubscriptions(...args),
  sendBatchNotifications: (...args: unknown[]) => mockSendBatchNotifications(...args),
}))

import { POST } from '@/app/api/admin/notifications/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/notifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockIsAdminUser.mockResolvedValue(true)
    mockLogAdminActivity.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockIsAdminUser.mockResolvedValue(false)

    const response = await POST(makeRequest({
      title: 'Test',
      body: 'Test body',
      targetType: 'all',
    }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for missing title', async () => {
    const response = await POST(makeRequest({
      body: 'Test body',
      targetType: 'all',
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Required')
  })

  it('returns 400 for missing body', async () => {
    const response = await POST(makeRequest({
      title: 'Test',
      targetType: 'all',
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('Required')
  })

  it('returns 400 for invalid target type', async () => {
    const response = await POST(makeRequest({
      title: 'Test',
      body: 'Test body',
      targetType: 'invalid',
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBeTruthy()
  })

  it('returns 400 when tier target has no tiers selected', async () => {
    const response = await POST(makeRequest({
      title: 'Test',
      body: 'Test body',
      targetType: 'tier',
      targetTiers: [],
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('tier')
  })

  it('returns 400 when individual target has no users', async () => {
    const response = await POST(makeRequest({
      title: 'Test',
      body: 'Test body',
      targetType: 'individual',
      targetUserIds: [],
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain('user')
  })

  it('creates and sends notification for valid "all" target', async () => {
    const broadcastRecord = {
      id: 'broadcast-1',
      title: 'Test Notification',
      body: 'Test body text',
      url: '/members',
      tag: null,
      require_interaction: false,
    }

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: broadcastRecord, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { ...broadcastRecord, status: 'sent' }, error: null }),
            })),
          })),
        })),
      })),
    })

    mockResolveTargetSubscriptions.mockResolvedValue([
      { endpoint: 'https://push.example.com/1', keys: {} },
    ])
    mockSendBatchNotifications.mockResolvedValue({
      targeted: 1,
      delivered: 1,
      failed: 0,
    })

    const response = await POST(makeRequest({
      title: 'Test Notification',
      body: 'Test body text',
      targetType: 'all',
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockResolveTargetSubscriptions).toHaveBeenCalledWith('all', undefined, undefined)
    expect(mockSendBatchNotifications).toHaveBeenCalled()
    expect(mockLogAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'notification_broadcast' }),
    )
  })
})
