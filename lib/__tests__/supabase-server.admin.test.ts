import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockIsCurrentUserAdmin,
} = vi.hoisted(() => ({
  mockIsCurrentUserAdmin: vi.fn(),
}))

vi.mock('@/lib/access-control/admin-access', () => ({
  isCurrentUserAdmin: (...args: unknown[]) => mockIsCurrentUserAdmin(...args),
}))

import { isAdminUser } from '@/lib/supabase-server'

describe('isAdminUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the canonical admin-access decision', async () => {
    mockIsCurrentUserAdmin.mockResolvedValue(true)

    await expect(isAdminUser()).resolves.toBe(true)
    expect(mockIsCurrentUserAdmin).toHaveBeenCalledTimes(1)
  })

  it('returns false when the canonical admin-access decision denies access', async () => {
    mockIsCurrentUserAdmin.mockResolvedValue(false)

    await expect(isAdminUser()).resolves.toBe(false)
    expect(mockIsCurrentUserAdmin).toHaveBeenCalledTimes(1)
  })

  it('returns false when the canonical admin-access evaluation throws', async () => {
    mockIsCurrentUserAdmin.mockRejectedValue(new Error('boom'))

    await expect(isAdminUser()).resolves.toBe(false)
    expect(mockIsCurrentUserAdmin).toHaveBeenCalledTimes(1)
  })
})
