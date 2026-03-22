'use client'

import { LearningAnalytics } from '@/components/admin/academy/learning-analytics'

export default function AcademyAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Academy Analytics</h1>
        <p className="text-white/60 mt-1">Enrollment, completion, and engagement metrics</p>
      </div>
      <LearningAnalytics />
    </div>
  )
}
