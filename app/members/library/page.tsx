'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LibraryPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/members/academy')
  }, [router])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-white/40 text-sm">Redirecting to Academy...</div>
    </div>
  )
}
