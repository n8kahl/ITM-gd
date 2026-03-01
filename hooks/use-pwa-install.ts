'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAndroid, isIOS, isStandaloneMode } from '@/lib/pwa-utils'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const INSTALL_DISMISSED_KEY = 'tradeitm:pwa-install-dismissed'
const INSTALL_DISMISSED_KEY_V2 = 'tradeitm:pwa-install-dismissed:v2'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [isAndroidDevice, setIsAndroidDevice] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const initializeTimer = window.setTimeout(() => {
      const initialStandalone = isStandaloneMode()
      setIsIOSDevice(isIOS())
      setIsAndroidDevice(isAndroid())
      setIsStandalone(initialStandalone)
      setIsInstalled(initialStandalone)
      const isDismissed = (
        window.localStorage.getItem(INSTALL_DISMISSED_KEY_V2) === '1'
        || window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'
      )
      setDismissed(isDismissed)
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
      window.localStorage.setItem(INSTALL_DISMISSED_KEY_V2, '1')
    }
    setDismissed(true)
  }, [])

  const shouldShow = useMemo(() => {
    if (!ready) return false
    if (isInstalled || dismissed) return false
    if (canInstall) return true
    return !isStandalone && (isIOSDevice || isAndroidDevice)
  }, [ready, isInstalled, dismissed, canInstall, isIOSDevice, isAndroidDevice, isStandalone])

  return {
    canInstall,
    isInstalled,
    isIOSDevice,
    isAndroidDevice,
    isStandalone,
    shouldShow,
    promptInstall,
    dismiss,
  }
}
