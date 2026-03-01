'use client'

import { StudioTabs } from '@/components/studio/studio-tabs'

export default function MembersStudioPage() {
  return (
    <div className="container py-8">
      <StudioTabs isAdmin={false} />
    </div>
  )
}
