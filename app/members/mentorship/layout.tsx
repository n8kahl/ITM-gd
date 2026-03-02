import type { ReactNode } from 'react'

import { MentorshipAccessGate } from '@/components/mentorship/mentorship-access-gate'
import { MentorshipSubNav } from '@/components/mentorship/mentorship-sub-nav'

export default function MentorshipLayout({ children }: { children: ReactNode }) {
  return (
    <MentorshipAccessGate>
      <div className="space-y-4">
        <MentorshipSubNav />
        {children}
      </div>
    </MentorshipAccessGate>
  )
}
