'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { getSafeRedirect } from '@/lib/safe-redirect'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

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
    let cancelled = false
    const PKCE_RETRY_FLAG = 'oauth_pkce_retry_attempted'

    const run = async () => {
      // Forward to server-side callback handler
      // This preserves all query params (code, next, error, etc.)
      const apiUrl = new URL('/api/auth/callback', window.location.origin)

      // Copy all query params to API route
      searchParams.forEach((value, key) => {
        apiUrl.searchParams.set(key, value)
      })

      // If no explicit redirect was provided in the callback URL, fall back to the
      // pre-auth destination stored by the login page.
      const hasNext =
        apiUrl.searchParams.has('next') ||
        apiUrl.searchParams.has('redirect')

      if (!hasNext) {
        let stored: string | null = null
        try {
          stored = window.sessionStorage.getItem('post_auth_redirect')
        } catch { }

        if (!stored) {
          try {
            stored = window.localStorage.getItem('post_auth_redirect')
          } catch { }
        }

        if (stored) {
          const safe = getSafeRedirect(stored)
          apiUrl.searchParams.set('redirect', safe)
          try {
            window.sessionStorage.removeItem('post_auth_redirect')
          } catch { }
          try {
            window.localStorage.removeItem('post_auth_redirect')
          } catch { }
        }
      }

      const code = searchParams.get('code')
      if (code) {
        try {
          const supabase = createBrowserSupabase()
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (!exchangeError) {
            try {
              window.sessionStorage.removeItem(PKCE_RETRY_FLAG)
            } catch { }
            apiUrl.searchParams.set('skip_code_exchange', '1')
            if (!cancelled) {
              window.location.href = apiUrl.toString()
            }
            return
          }

          const isVerifierMissing = /code verifier not found/i.test(exchangeError.message)
          if (isVerifierMissing) {
            let alreadyRetried = false
            try {
              alreadyRetried = window.sessionStorage.getItem(PKCE_RETRY_FLAG) === '1'
            } catch { }

            if (!alreadyRetried) {
              try {
                window.sessionStorage.setItem(PKCE_RETRY_FLAG, '1')
              } catch { }

              const redirectForRetry = apiUrl.searchParams.get('redirect') || '/members'
              try {
                window.sessionStorage.setItem('post_auth_redirect', getSafeRedirect(redirectForRetry))
              } catch { }
              try {
                window.localStorage.setItem('post_auth_redirect', getSafeRedirect(redirectForRetry))
              } catch { }

              const { error: retrySignInError } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                  scopes: 'identify email guilds guilds.members.read',
                },
              })

              if (!retrySignInError) {
                return
              }
            }
          }
        } catch (clientExchangeError) {
          console.warn('[Auth Callback] Client-side exchange failed, falling back to server exchange:', clientExchangeError)
        }
      }

      if (!cancelled) {
        // Fallback to server exchange path
        window.location.href = apiUrl.toString()
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="64px" className="object-contain" />
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
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="64px" className="object-contain" />
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
