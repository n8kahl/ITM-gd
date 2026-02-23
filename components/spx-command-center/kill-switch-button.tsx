'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface KillSwitchButtonProps {
  isConnected: boolean
  isKilling: boolean
  onKill: () => Promise<void>
}

export function KillSwitchButton({ isConnected, isKilling, onKill }: KillSwitchButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleKill = useCallback(async () => {
    setConfirmOpen(false)
    try {
      await onKill()
    } catch {
      // Error surfaced via hook's killError
    }
  }, [onKill])

  if (!isConnected) return null

  return (
    <div>
      {!confirmOpen ? (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isKilling}
          data-testid="broker-kill-switch"
          className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-md border border-rose-300/35 bg-rose-500/12 px-3 py-1.5 text-[10px] uppercase tracking-[0.08em] text-rose-100 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isKilling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Killing...
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              Kill Switch
            </>
          )}
        </button>
      ) : (
        <div className="rounded border border-rose-300/30 bg-rose-500/10 p-2 text-[10px] text-rose-100">
          <p className="mb-1.5 font-mono uppercase tracking-[0.08em]">
            <AlertTriangle className="mr-1 inline-block h-3 w-3" />
            Confirm Kill Switch
          </p>
          <p className="text-rose-100/70">
            This will deactivate the broker, disable execution, and prevent all new orders.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleKill}
              disabled={isKilling}
              className="min-h-[30px] rounded border border-rose-300/40 bg-rose-500/20 px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
            >
              Confirm Kill
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="min-h-[30px] rounded border border-white/15 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-white/60 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
