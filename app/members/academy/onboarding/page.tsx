'use client'

import Image from 'next/image'
import { OnboardingWizard } from '@/components/academy/onboarding-wizard'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

export default function AcademyOnboardingPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center py-8 px-4">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="relative w-10 h-10 mx-auto mb-3">
          <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill className="object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-white">
          TITM Academy
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Let&apos;s personalize your learning experience
        </p>
      </div>

      {/* Wizard */}
      <OnboardingWizard />
    </div>
  )
}
