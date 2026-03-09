import { describe, expect, it } from 'vitest'
import { hasSwingSniperTabAccess } from '@/lib/swing-sniper/access'

describe('hasSwingSniperTabAccess', () => {
  it('returns true when swing-sniper tab is active', () => {
    expect(hasSwingSniperTabAccess([
      { tab_id: 'dashboard', is_active: true },
      { tab_id: 'swing-sniper', is_active: true },
    ])).toBe(true)
  })

  it('returns false when swing-sniper tab is missing or inactive', () => {
    expect(hasSwingSniperTabAccess([
      { tab_id: 'dashboard', is_active: true },
    ])).toBe(false)

    expect(hasSwingSniperTabAccess([
      { tab_id: 'swing-sniper', is_active: false },
    ])).toBe(false)
  })
})
