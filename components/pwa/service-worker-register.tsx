'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * Service Worker lifecycle manager.
 *
 * Responsibilities:
 *   1. Register /sw.js on mount
 *   2. Detect when a new version is installed (updatefound → installed)
 *   3. Show a persistent Sonner toast with an "Update" action
 *   4. On click: post SKIP_WAITING → new SW activates → controllerchange
 *   5. Auto-reload after 60 s of user inactivity once a new SW is waiting
 *   6. Guard against double-reload
 */
export function ServiceWorkerRegister() {
  const refreshingRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // ------------------------------------------------------------------
    // Show update toast
    // ------------------------------------------------------------------
    function showUpdateToast(newWorker: ServiceWorker) {
      toast('New version available', {
        description: 'TradeITM has been updated in the background.',
        action: {
          label: 'Update now',
          onClick: () => {
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          },
        },
        duration: Infinity,
      })
    }

    // ------------------------------------------------------------------
    // Auto-reload after 60 s of inactivity
    // ------------------------------------------------------------------
    function scheduleAutoReload(newWorker: ServiceWorker) {
      const IDLE_MS = 60_000
      let idleTimer: ReturnType<typeof setTimeout> | null = null

      const resetTimer = () => {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          newWorker.postMessage({ type: 'SKIP_WAITING' })
        }, IDLE_MS)
      }

      const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
      events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }))

      resetTimer()
    }

    // ------------------------------------------------------------------
    // Register service worker
    // ------------------------------------------------------------------
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        if (!registration) return

        // Already a waiting worker (from a previous page load)
        if (registration.waiting) {
          showUpdateToast(registration.waiting)
          scheduleAutoReload(registration.waiting)
          return
        }

        // Listen for future updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(newWorker)
              scheduleAutoReload(newWorker)
            }
          })
        })
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed:', error)
      })

    // ------------------------------------------------------------------
    // Controller change → reload (new SW took over)
    // ------------------------------------------------------------------
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshingRef.current) return
      refreshingRef.current = true
      window.location.reload()
    })
  }, [])

  return null
}
