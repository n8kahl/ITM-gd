'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isIOS, isStandaloneMode } from '@/lib/pwa-utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_DISMISSED_KEY = 'tradeitm:pwa-install-dismissed'
const INSTALL_VISIT_COUNT_KEY = 'tradeitm:pwa-install-visit-count'
const INSTALL_VISIT_SESSION_KEY = 'tradeitm:pwa-install-visit-counted'

function parseCount(raw: string | null): number {
  const value = Number.parseInt(raw || '0', 10)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [visitCount, setVisitCount] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializeTimer = window.setTimeout(() => {
      const initialStandalone = isStandaloneMode()
      setIsIOSDevice(isIOS())
      setIsStandalone(initialStandalone)
      setIsInstalled(initialStandalone)
      setDismissed(window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1')

      const storedVisitCount = parseCount(window.localStorage.getItem(INSTALL_VISIT_COUNT_KEY))
      const shouldIncrementVisit = !window.sessionStorage.getItem(INSTALL_VISIT_SESSION_KEY)
      const nextVisitCount = shouldIncrementVisit ? storedVisitCount + 1 : storedVisitCount
      if (shouldIncrementVisit) {
        window.localStorage.setItem(INSTALL_VISIT_COUNT_KEY, String(nextVisitCount))
        window.sessionStorage.setItem(INSTALL_VISIT_SESSION_KEY, '1')
      }
      setVisitCount(nextVisitCount)
      setReady(true)
    }, 0)

    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      const standalone = isStandaloneMode()
      setIsStandalone(standalone)
      if (standalone) {
        setIsInstalled(true)
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent
      installEvent.preventDefault()
      setDeferredPrompt(installEvent)
      setCanInstall(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setCanInstall(false)
      setDeferredPrompt(null)
    }

    displayModeQuery.addEventListener('change', handleDisplayModeChange)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.clearTimeout(initializeTimer)
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    await deferredPrompt.prompt()
    const userChoice = await deferredPrompt.userChoice
    const accepted = userChoice.outcome === 'accepted'

    if (accepted) {
      setIsInstalled(true)
    }

    setCanInstall(false)
    setDeferredPrompt(null)
    return accepted
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    }
    setDismissed(true)
  }, [])

  const shouldShow = useMemo(() => {
    if (!ready) return false
    if (isInstalled || dismissed) return false
    if (visitCount < 2) return false
    if (canInstall) return true
    return isIOSDevice && !isStandalone
  }, [ready, isInstalled, dismissed, visitCount, canInstall, isIOSDevice, isStandalone])

  return {
    canInstall,
    isInstalled,
    isIOSDevice,
    isStandalone,
    shouldShow,
    visitCount,
    promptInstall,
    dismiss,
  }
}
