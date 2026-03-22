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

import { POST, PATCH, DELETE } from '@/app/api/admin/lessons/route'

function makeRequest(method: string, body?: unknown, query?: string) {
  const url = `http://localhost/api/admin/lessons${query ? `?${query}` : ''}`
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

describe('Admin Lessons API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockIsAdminUser.mockResolvedValue(true)
    mockLogAdminActivity.mockResolvedValue(undefined)
  })

  describe('POST /api/admin/lessons', () => {
    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await POST(makeRequest('POST', {
        course_id: '00000000-0000-4000-8000-000000000001',
        title: 'Test Lesson',
        slug: 'test-lesson',
      }))

      expect(response.status).toBe(401)
    })

    it('returns 400 for missing required fields', async () => {
      const response = await POST(makeRequest('POST', {
        title: 'Test Lesson',
        // missing course_id and slug
      }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toBeTruthy()
    })

    it('returns 400 for invalid course_id UUID', async () => {
      const response = await POST(makeRequest('POST', {
        course_id: 'not-a-uuid',
        title: 'Test Lesson',
        slug: 'test-lesson',
      }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('UUID')
    })

    it('returns 400 for invalid slug format', async () => {
      const response = await POST(makeRequest('POST', {
        course_id: '00000000-0000-4000-8000-000000000001',
        title: 'Test',
        slug: 'INVALID Slug',
      }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Slug must be lowercase')
    })
  })

  describe('PATCH /api/admin/lessons', () => {
    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await PATCH(makeRequest('PATCH', {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Updated',
      }))

      expect(response.status).toBe(401)
    })

    it('returns 400 for invalid lesson ID', async () => {
      const response = await PATCH(makeRequest('PATCH', {
        id: 'bad-id',
        title: 'Updated',
      }))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('UUID')
    })
  })

  describe('DELETE /api/admin/lessons', () => {
    it('returns 401 when not authenticated', async () => {
      mockIsAdminUser.mockResolvedValue(false)

      const response = await DELETE(makeRequest('DELETE', undefined, 'id=some-id'))
      expect(response.status).toBe(401)
    })

    it('returns 400 when ID is missing', async () => {
      const response = await DELETE(makeRequest('DELETE'))
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body.error).toContain('Lesson ID is required')
    })
  })
})
