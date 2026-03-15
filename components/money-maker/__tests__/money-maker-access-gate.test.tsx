/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseMemberAuth } = vi.hoisted(() => ({
  mockUseMemberAuth: vi.fn(),
}))

vi.mock('@/contexts/MemberAuthContext', () => ({
  useMemberSession: (...args: unknown[]) => mockUseMemberAuth(...args),
  useMemberAccess: (...args: unknown[]) => mockUseMemberAuth(...args),
}))

import { MoneyMakerAccessGate } from '../money-maker-access-gate'

describe('MoneyMakerAccessGate', () => {
  beforeEach(() => {
    mockUseMemberAuth.mockReset()
  })

  it('blocks direct access when the admin-only tab is unavailable', () => {
    mockUseMemberAuth.mockReturnValue({
      isLoading: false,
      getVisibleTabs: () => [],
    })

    render(
      <MoneyMakerAccessGate>
        <div>Protected Money Maker Content</div>
      </MoneyMakerAccessGate>,
    )

    expect(screen.getByTestId('money-maker-access-denied')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Money Maker Access Required' })).toBeInTheDocument()
    expect(screen.queryByText('Protected Money Maker Content')).not.toBeInTheDocument()
  })

  it('renders children for users with the Money Maker tab', () => {
    mockUseMemberAuth.mockReturnValue({
      isLoading: false,
      getVisibleTabs: () => [{ tab_id: 'money-maker', is_active: true }],
    })

    render(
      <MoneyMakerAccessGate>
        <div>Protected Money Maker Content</div>
      </MoneyMakerAccessGate>,
    )

    expect(screen.getByText('Protected Money Maker Content')).toBeInTheDocument()
    expect(screen.queryByTestId('money-maker-access-denied')).not.toBeInTheDocument()
  })
})
