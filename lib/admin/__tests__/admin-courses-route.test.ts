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

import { GET, POST, PATCH, DELETE } from '@/app/api/admin/courses/route'

function makeRequest(method: string, body?: unknown, query?: string) {
  const url = `http://localhost/api/admin/courses${query ? `?${query}` : ''}`
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

function mockSupabaseChain(overrides: Record<string, unknown> = {}) {
  const selectResult = overrides.selectResult ?? { data: [], error: null }
  const insertResult = overrides.insertResult ?? { data: { id: 'new-id', title: 'Test', slug: 'test', position: 1, is_published: false, created_at: '2026-01-01', updated_at: '2026-01-01', metadata: {} }, error: null }
  const updateResult = overrides.updateResult ?? { data: [{ id: 'existing-id', title: 'Updated', slug: 'updated', position: 1, is_published: true, created_at: '2026-01-01', updated_at: '2026-01-01', metadata: {}, academy_lessons: [] }], error: null }
  const deleteResult = overrides.deleteResult ?? { error: null }
  const singleTrackResult = overrides.singleTrackResult ?? { data: { id: 'track-1' }, error: null }

  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
    maybeSingle: vi.fn().mockResolvedValue(singleTrackResult),
  }

  // Override terminal methods for specific operations
  chain.select.mockImplementation(() => {
    const inner = { ...chain }
    inner.order = vi.fn(() => {
      const o = { ...chain }
      o.limit = vi.fn(() => {
        const l = { ...chain }
        l.single = vi.fn().mockResolvedValue({ data: { position: 5 }, error: null })
        l.maybeSingle = vi.fn().mockResolvedValue(singleTrackResult)
        return l
      })
      return o
    })
    // Direct resolve for selects without chaining
    return Object.assign(Promise.resolve(selectResult), inner)
  })
  chain.insert.mockImplementation(() => ({
    select: vi.fn(() => ({
      single: vi.fn().mockResolvedValue(insertResult),
    })),
  }))
  chain.update.mockImplementation(() => ({
    eq: vi.fn(() => ({
      select: vi.fn().mockResolvedValue(updateResult),
    })),
  }))
  chain.delete.mockImplementation(() => ({
    eq: vi.fn().mockResolvedValue(deleteResult),
  }))

  mockCreateClient.mockReturnValue({
    from: vi.fn(() => chain),
  })

  return chain
}

describe('Admin Courses API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockIsAdminUser.mockResolvedValue(true)
    mockLogAdminActivity.mockResolvedValue(undefined)
  })

  describe('GET /api/admin/courses', () => {
    it('returns courses list when authenticated as admin', async () => {
      const selectMock = vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: [{ id: '1', title: 'Course 1', slug: 'course-1', position: 1, is_published: true, created_at: '2026-01-01', updated_at: '2026-01-01', metadata: {}, academy_lessons: [] }],
          error: null,
        }),
      }))

      mockCreateClient.mockReturnValue({
        from: vi.fn(() => ({ select: selectMock })),
      })

      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
    })

    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/admin/courses', () => {
    it('creates a course with valid input', async () => {
      mockSupabaseChain()

      const response = await POST(makeRequest('POST', {
        title: 'New Course',
        slug: 'new-course',
        description: 'A test course',
        is_published: false,
      }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(mockLogAdminActivity).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'course_created' }),
      )
    })

    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await POST(makeRequest('POST', { title: 'Test', slug: 'test' }))
      expect(response.status).toBe(401)
    })

    it('returns 400 for invalid input (missing title)', async () => {
      const response = await POST(makeRequest('POST', { slug: 'test' }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Required')
    })

    it('returns 400 for invalid slug format', async () => {
      const response = await POST(makeRequest('POST', {
        title: 'Test',
        slug: 'Invalid Slug With Spaces',
      }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Slug must be lowercase')
    })
  })

  describe('PATCH /api/admin/courses', () => {
    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await PATCH(makeRequest('PATCH', { id: '00000000-0000-4000-8000-000000000001' }))
      expect(response.status).toBe(401)
    })

    it('returns 400 for invalid UUID', async () => {
      const response = await PATCH(makeRequest('PATCH', { id: 'not-a-uuid' }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('UUID')
    })
  })

  describe('DELETE /api/admin/courses', () => {
    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await DELETE(makeRequest('DELETE', undefined, 'id=some-id'))
      expect(response.status).toBe(401)
    })

    it('returns 400 when ID is missing', async () => {
      const response = await DELETE(makeRequest('DELETE'))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Course ID is required')
    })
  })
})
