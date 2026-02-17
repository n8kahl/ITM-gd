import { describe, expect, it } from 'vitest'
import {
  getMemberFallbackTitle,
  getMemberSectionPath,
  getMemberTabHref,
  isMemberTabActive,
  resolveMemberTabLabel,
} from '@/lib/member-navigation'

describe('member navigation academy mapping', () => {
  it('renames Library tab label to Academy', () => {
    expect(resolveMemberTabLabel({ tab_id: 'library', label: 'Library' })).toBe('Academy')
  })

  it('maps library tab href to academy plan route', () => {
    expect(getMemberTabHref({ tab_id: 'library', path: '/members/library' })).toBe('/members/academy-v3')
    expect(getMemberTabHref({ tab_id: 'library', path: '/members/academy-v3/modules' })).toBe(
      '/members/academy-v3'
    )
  })

  it('marks academy routes active for library tab', () => {
    const tab = { tab_id: 'library', path: '/members/library' }
    expect(isMemberTabActive('/members/academy-v3', tab)).toBe(true)
    expect(isMemberTabActive('/members/academy-v3/modules', tab)).toBe(true)
    expect(isMemberTabActive('/members/academy-v3/review', tab)).toBe(true)
  })

  it('normalizes section path and fallback title for academy routes', () => {
    expect(getMemberSectionPath('/members/academy-v3/progress')).toBe('/members/academy-v3')
    expect(getMemberFallbackTitle('/members/academy-v3/progress')).toBe('Academy')
  })
})
