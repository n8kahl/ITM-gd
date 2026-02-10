'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Failed to register service worker:', error)
    })
  }, [])

  return null
}
