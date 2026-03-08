'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ShieldX, LogOut, CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { AuroraBackground } from '@/components/ui/aurora-background'

type SyncState = 'idle' | 'checking' | 'synced' | 'not_member' | 'no_membership_role' | 'error'

export default function JoinDiscordPage() {
  const router = useRouter()
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const statusCopy = useMemo(() => {
    if (syncState === 'not_member') {
      return {
        title: 'Discord Server Membership Required',
        body: 'Your Discord account is not currently in the TradeITM Discord server. Join the server first, then retry sync.',
      }
    }

    if (syncState === 'no_membership_role') {
      return {
        title: 'Membership Role Not Found',
        body: 'Your Discord account was found in the server, but no qualifying membership role is assigned yet.',
      }
    }

    if (syncState === 'error') {
      return {
        title: 'Role Sync Failed',
        body: 'We could not complete Discord role sync right now. Please retry in a moment.',
      }
    }

    if (syncState === 'synced') {
      return {
        title: 'Access Restored',
        body: 'Discord roles synced successfully. Redirecting to Members area...',
      }
    }

    return {
      title: 'Active Membership Required',
      body: 'We could not verify your members-area access yet. Sync your Discord roles to continue.',
    }
  }, [syncState])

  const handleRefreshAccess = async () => {
    setSyncState('checking')
    setSyncMessage(null)

    try {
      const response = await fetch('/api/auth/sync-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const payload = await response.json()

      if (payload?.success && payload?.status === 'SYNCED') {
        setSyncState('synced')
        setSyncMessage(null)
        router.replace('/members')
        return
      }

      if (payload?.status === 'NOT_MEMBER') {
        setSyncState('not_member')
        setSyncMessage(payload?.error || 'Discord server membership is required.')
        return
      }

      if (payload?.status === 'NO_MEMBERSHIP_ROLE') {
        setSyncState('no_membership_role')
        setSyncMessage(payload?.error || 'No qualifying membership role found yet.')
        return
      }

      setSyncState('error')
      setSyncMessage(payload?.error || 'Discord role sync failed')
    } catch (err) {
      setSyncState('error')
      setSyncMessage(err instanceof Error ? err.message : 'Discord role sync failed')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  const showWarning = syncState !== 'synced'

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <AuroraBackground />

      <header className="p-6 relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-4 animate-pulse-subtle">
              {syncState === 'synced'
                ? <CheckCircle2 className="w-10 h-10 text-white" />
                : <ShieldX className="w-10 h-10 text-white" />}
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-[#F1E5AC] bg-clip-text text-transparent mb-2">
              {statusCopy.title}
            </h1>
            <p className="text-white/60 mt-2">
              {statusCopy.body}
            </p>
          </div>

          <div className="glass-card-heavy border-holo rounded-2xl p-6">
            {showWarning && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">Access Check</p>
                    <p className="text-sm text-red-400/70 mt-1">
                      {syncMessage || statusCopy.body}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              asChild
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-600 text-black py-7 text-lg font-semibold shadow-lg shadow-emerald-500/20"
            >
              <Link href="/#pricing">
                <CreditCard className="w-6 h-6 mr-3" />
                View Membership Plans
              </Link>
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0a0a0b] text-white/60">
                  Already purchased?
                </span>
              </div>
            </div>

            <Button
              onClick={handleRefreshAccess}
              disabled={syncState === 'checking'}
              variant="outline"
              className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 py-6"
            >
              {syncState === 'checking' ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Syncing Discord roles...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Retry Discord Sync
                </>
              )}
            </Button>

            <p className="text-center text-white/40 text-xs mt-3">
              Role changes may take up to 1-2 minutes to propagate from Discord.
            </p>

            <button
              onClick={handleSignOut}
              className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out and go back
            </button>
          </div>

          <p className="text-center text-white/40 text-xs mt-6">
            Need help?{' '}
            <a href="mailto:support@tradeitm.com" className="text-emerald-500 hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
