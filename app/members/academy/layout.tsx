import type { ReactNode } from 'react'

import { AcademySubNav } from '@/components/academy/academy-sub-nav'

export default function AcademyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AcademySubNav />
      {children}
    </div>
  )
}
