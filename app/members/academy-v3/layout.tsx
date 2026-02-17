import type { ReactNode } from 'react'

import { AcademyV3SubNav } from '@/components/academy-v3/academy-v3-sub-nav'

export default function AcademyV3Layout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AcademyV3SubNav />
      {children}
    </div>
  )
}
