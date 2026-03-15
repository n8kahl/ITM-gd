'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, Lock } from 'lucide-react'
import { useMemberAccess, useMemberSession } from '@/contexts/MemberAuthContext'
import { hasSwingSniperTabAccess } from '@/lib/swing-sniper/access'

interface SwingSniperAccessGateProps {
  children: ReactNode
}

export function SwingSniperAccessGate({ children }: SwingSniperAccessGateProps) {
  const { isLoading } = useMemberSession()
  const { getVisibleTabs } = useMemberAccess()
  const hasAccess = hasSwingSniperTabAccess(getVisibleTabs())

  if (isLoading) {
    return (
      <div className="glass-card-heavy animate-pulse rounded-2xl border border-white/10 p-6">
        <div className="h-5 w-48 rounded bg-white/10" />
        <div className="mt-3 h-4 w-full rounded bg-white/5" />
        <div className="mt-2 h-4 w-2/3 rounded bg-white/5" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div
        data-testid="swing-sniper-access-denied"
        className="glass-card-heavy rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6 md:p-8"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
            <Lock className="h-5 w-5 text-red-300" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-wider">Access Required</p>
            </div>
            <h1 className="font-[family-name:var(--font-playfair)] text-2xl font-semibold text-white">
              Swing Sniper Access Required
            </h1>
            <p className="max-w-2xl text-sm text-white/65">
              Swing Sniper is currently restricted to Lead and Admin accounts.
              If this looks incorrect, ask support to verify your role assignment.
            </p>
            <div className="pt-1">
              <Link
                href="/members"
                className="inline-flex min-h-11 items-center rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
