'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

/**
 * Client-side OAuth callback page
 *
 * This page forwards all OAuth callbacks to the server-side API route
 * at /api/auth/callback which handles code exchange, role sync, and smart redirects.
 *
 * This approach ensures:
 * - Code exchange happens server-side with proper cookie setting
 * - No race conditions with cookie propagation
 * - Middleware immediately sees authenticated session
 * - Discord roles are synced before redirect
 * - JWT claims are refreshed to include latest permissions
 */
function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Forward to server-side callback handler
    // This preserves all query params (code, next, error, etc.)
    const apiUrl = new URL('/api/auth/callback', window.location.origin)

    // Copy all query params to API route
    searchParams.forEach((value, key) => {
      apiUrl.searchParams.set(key, value)
    })

    console.log('Forwarding OAuth callback to server-side handler:', apiUrl.pathname)

    // Immediate redirect to server-side handler
    // Server will exchange code, sync roles, refresh session, and redirect appropriately
    window.location.href = apiUrl.toString()
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
        </div>

        {/* Processing State */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Authenticating</h1>
        <p className="text-white/60">Redirecting to secure authentication...</p>
        <p className="text-white/40 text-sm mt-4">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
          </div>
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Loading</h1>
          <p className="text-white/60">Preparing authentication...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
