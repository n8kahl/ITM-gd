'use client'

import { useEffect, useState } from 'react'
import { Monitor } from 'lucide-react'
import { StudioTabs } from '@/components/studio/studio-tabs'

// Hook to detect mobile devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export default function MembersStudioPage() {
  const isMobile = useIsMobile()

  // Show desktop-required message on mobile
  if (isMobile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="glass-card-heavy p-8 md:p-12 text-center rounded-2xl border border-white/10 max-w-md">
          <Monitor className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-serif text-white mb-3">
            Desktop Required
          </h2>
          <p className="text-white/60 text-base md:text-lg">
            The Studio Hub is optimized for desktop use with drag-and-drop controls. Please visit on a larger screen for the best experience.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <StudioTabs isAdmin={false} />
    </div>
  )
}
