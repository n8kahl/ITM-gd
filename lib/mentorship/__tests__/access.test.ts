import { describe, expect, it } from 'vitest'

import { hasMentorshipTabAccess } from '@/lib/mentorship/access'

describe('hasMentorshipTabAccess', () => {
  it('returns false when mentorship tab is missing', () => {
    expect(
      hasMentorshipTabAccess([
        { tab_id: 'dashboard', is_active: true },
        { tab_id: 'journal', is_active: true },
      ]),
    ).toBe(false)
  })

  it('returns true when mentorship tab is active', () => {
    expect(
      hasMentorshipTabAccess([
        { tab_id: 'mentorship', is_active: true },
      ]),
    ).toBe(true)
  })

  it('returns false when mentorship tab is inactive', () => {
    expect(
      hasMentorshipTabAccess([
        { tab_id: 'mentorship', is_active: false },
      ]),
    ).toBe(false)
  })
})
