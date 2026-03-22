import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockCreateClient,
  mockIsAdminUser,
  mockLogAdminActivity,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockIsAdminUser: vi.fn(),
  mockLogAdminActivity: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/supabase-server', () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
}))

vi.mock('@/lib/admin/audit-log', () => ({
  logAdminActivity: (...args: unknown[]) => mockLogAdminActivity(...args),
}))

import { PATCH } from '@/app/api/admin/leads/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/leads', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockIsAdminUser.mockResolvedValue(true)
    mockLogAdminActivity.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockIsAdminUser.mockResolvedValue(false)

    const response = await PATCH(makeRequest({
      id: '00000000-0000-4000-8000-000000000001',
      status: 'approved',
    }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for missing application ID', async () => {
    const response = await PATCH(makeRequest({
      status: 'approved',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('returns 400 for invalid UUID', async () => {
    const response = await PATCH(makeRequest({
      id: 'not-a-uuid',
      status: 'approved',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('UUID')
  })

  it('returns 400 for invalid status value', async () => {
    const response = await PATCH(makeRequest({
      id: '00000000-0000-4000-8000-000000000001',
      status: 'invalid-status',
    }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it('updates application status when valid', async () => {
    const updatedRecord = {
      id: '00000000-0000-4000-8000-000000000001',
      status: 'approved',
      notes: 'Good candidate',
      reviewed_by: 'admin',
      reviewed_at: '2026-03-22T00:00:00Z',
    }

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn().mockResolvedValue({ data: [updatedRecord], error: null }),
          })),
        })),
      })),
    })

    const response = await PATCH(makeRequest({
      id: '00000000-0000-4000-8000-000000000001',
      status: 'approved',
      notes: 'Good candidate',
      reviewed_by: 'admin',
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('approved')
    expect(mockLogAdminActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'lead_status_changed',
        targetId: '00000000-0000-4000-8000-000000000001',
      }),
    )
  })
})
