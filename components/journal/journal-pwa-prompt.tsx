'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, BellOff, Download } from 'lucide-react'
import { toast } from 'sonner'
import { isStandaloneMode } from '@/lib/pwa-utils'
import {
  checkPushSubscription,
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications'

const VISIT_COUNT_KEY = 'journal-pwa-visit-count'
const INSTALL_DISMISSED_KEY = 'journal-pwa-install-dismissed'
const INSTALL_ACCEPTED_KEY = 'journal-pwa-install-accepted'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function JournalPwaPrompt() {
  const [visitCount, setVisitCount] = useState(0)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPushSupportedBrowser, setIsPushSupportedBrowser] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const showInstallPrompt = useMemo(() => {
    if (isStandaloneMode()) return false
    if (!installEvent) return false
    if (visitCount < 3) return false
    if (typeof window === 'undefined') return false
    if (window.localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true') return false
    if (window.localStorage.getItem(INSTALL_ACCEPTED_KEY) === 'true') return false
    return true
  }, [installEvent, visitCount])

  const refreshPushState = useCallback(async () => {
    const supported = await isPushSupported()
    setIsPushSupportedBrowser(supported)
    if (!supported) {
      setPushEnabled(false)
      return
    }
    setPushEnabled(await checkPushSubscription())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const nextCount = Number.parseInt(window.localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1
    window.localStorage.setItem(VISIT_COUNT_KEY, String(nextCount))
    setVisitCount(nextCount)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }

    const handleInstalled = () => {
      window.localStorage.setItem(INSTALL_ACCEPTED_KEY, 'true')
      setInstallEvent(null)
      toast.success('TradeITM installed successfully')
    }

    void registerServiceWorker()
    void refreshPushState()

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [refreshPushState])

  const handleInstall = useCallback(async () => {
    if (!installEvent) return

    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      window.localStorage.setItem(INSTALL_ACCEPTED_KEY, 'true')
      toast.success('Installing TradeITM...')
    } else {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
    }
    setInstallEvent(null)
  }, [installEvent])

  const handleDismissInstall = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, 'true')
    }
    setInstallEvent(null)
  }, [])

  const handleTogglePush = useCallback(async () => {
    setPushLoading(true)
    try {
      if (!pushEnabled) {
        const ok = await subscribeToPush()
        if (!ok) {
          toast.error('Unable to enable push alerts')
          return
        }
        setPushEnabled(true)
        toast.success('Push alerts enabled')
      } else {
        const ok = await unsubscribeFromPush()
        if (!ok) {
          toast.error('Unable to disable push alerts')
          return
        }
        setPushEnabled(false)
        toast.success('Push alerts disabled')
      }
    } finally {
      setPushLoading(false)
    }
  }, [pushEnabled])

  if (!showInstallPrompt && !isPushSupportedBrowser) return null

  return (
    <section className="glass-card rounded-xl border border-emerald-500/15 p-4">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-ivory">Mobile App Enhancements</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Install TradeITM for a full-screen journal and enable push alerts for end-of-day draft reminders.
          </p>
        </div>

        {showInstallPrompt && (
          <div className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-ivory">Add TradeITM to your home screen for faster journal access.</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => { void handleInstall() }}
                className="focus-champagne inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
              <button
                type="button"
                onClick={handleDismissInstall}
                className="focus-champagne inline-flex h-9 items-center rounded-lg border border-white/[0.12] px-3 text-xs text-muted-foreground hover:text-ivory hover:bg-white/[0.05]"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {isPushSupportedBrowser && (
          <div className="flex items-center justify-between rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2">
            <div>
              <p className="text-xs font-medium text-ivory">Journal Push Alerts</p>
              <p className="text-[11px] text-muted-foreground">
                {pushEnabled ? 'Enabled for this browser' : 'Disabled for this browser'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void handleTogglePush() }}
              disabled={pushLoading}
              className="focus-champagne inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 text-xs text-ivory hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={pushEnabled ? 'Disable journal push alerts' : 'Enable journal push alerts'}
            >
              {pushEnabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {pushLoading ? 'Saving...' : pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
