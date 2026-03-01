import type { ReactNode } from 'react'

import { MentorshipSubNav } from '@/components/mentorship/mentorship-sub-nav'

export default function MentorshipLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <MentorshipSubNav />
      {children}
    </div>
  )
}
