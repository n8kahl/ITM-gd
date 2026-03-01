'use client'

import { useState } from 'react'
import { Download, Plus, Share, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePwaInstall } from '@/hooks/use-pwa-install'

interface InstallCtaProps {
  immersive?: boolean
}

export function InstallCta({ immersive = false }: InstallCtaProps) {
  const { canInstall, isIOSDevice, isAndroidDevice, isStandalone, shouldShow, promptInstall, dismiss } = usePwaInstall()
  const [installing, setInstalling] = useState(false)

  if (!shouldShow) return null

  const handleInstall = async () => {
    setInstalling(true)
    try {
      await promptInstall()
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div
      className={cn(
        'fixed left-4 right-4 z-40 lg:hidden',
        immersive ? 'bottom-4' : 'bottom-[calc(var(--members-bottomnav-h)+0.75rem)]',
      )}
    >
      <div className="glass-card-heavy rounded-xl border border-emerald-500/20 bg-[#0A0A0B]/95 p-3 shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2 text-emerald-300">
            <Download className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ivory">Install TradeITM</p>
            {canInstall ? (
              <p className="mt-1 text-xs text-white/60">
                Add TradeITM to your Home Screen for faster launch and a native-style layout.
              </p>
            ) : isIOSDevice && !isStandalone ? (
              <div className="mt-1 text-xs text-white/60 space-y-1">
                <p>On iOS, install is manual:</p>
                <p className="flex items-center gap-1.5 text-white/70">
                  <Share className="h-3.5 w-3.5 text-emerald-300" />
                  Tap Share, then
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <Plus className="h-3.5 w-3.5" />
                    Add to Home Screen
                  </span>
                </p>
              </div>
            ) : isAndroidDevice && !isStandalone ? (
              <div className="mt-1 text-xs text-white/60 space-y-1">
                <p>On Android, install from browser menu:</p>
                <p className="text-white/70">
                  Open the browser menu, then tap <span className="text-emerald-300">Add to Home screen</span> or <span className="text-emerald-300">Install app</span>.
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              {canInstall ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleInstall()
                  }}
                  disabled={installing}
                  className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {installing ? 'Opening...' : 'Install'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 hover:text-white"
              >
                Don&apos;t show again
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md p-1 text-white/50 hover:bg-white/5 hover:text-white/80"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
