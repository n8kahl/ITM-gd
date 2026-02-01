'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { getSafeRedirect } from '@/lib/safe-redirect'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing authentication...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const handleCallback = async () => {
      try {
        // Create a fresh browser client that syncs to cookies
        const supabase = createBrowserSupabase()

        // First, check if we already have a session (from hash tokens in implicit flow)
        const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          throw sessionError
        }

        if (existingSession) {
          // Already have a session - proceed to redirect
          if (!isMounted) return

          setStatus('success')
          setMessage('Authentication successful! Redirecting...')

          // Use window.location.href for full page navigation to ensure cookies are sent
          setTimeout(() => {
            if (isMounted) {
              window.location.href = redirectTo
            }
          }, 1000)
          return
        }

        // No session yet - try to exchange the code (PKCE flow)
        // The code should be in the URL query params
        const code = new URLSearchParams(window.location.search).get('code')

        if (code) {
          console.log('Exchanging code for session...')
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (!isMounted) return

          if (exchangeError) {
            console.error('Code exchange error:', exchangeError)
            throw exchangeError
          }

          // Session should now be set - verify
          const { data: { session: newSession } } = await supabase.auth.getSession()

          if (!newSession) {
            throw new Error('Failed to create session after code exchange')
          }

          setStatus('success')
          setMessage('Authentication successful! Redirecting...')

          setTimeout(() => {
            if (isMounted) {
              window.location.href = redirectTo
            }
          }, 1000)
          return
        }

        // Check for tokens in hash (implicit flow fallback)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')

        if (accessToken) {
          // Implicit flow - session should already be set by getSession above
          // If we got here, something is wrong
          console.log('Found access token in hash but no session - retrying...')

          // Wait a moment and try again
          await new Promise(resolve => setTimeout(resolve, 500))
          const { data: { session: retrySession } } = await supabase.auth.getSession()

          if (retrySession) {
            if (!isMounted) return
            setStatus('success')
            setMessage('Authentication successful! Redirecting...')
            setTimeout(() => {
              if (isMounted) {
                window.location.href = redirectTo
              }
            }, 1000)
            return
          }

          throw new Error('Unable to establish session from access token')
        }

        // No code, no hash token, no session - this shouldn't happen
        throw new Error('No authentication credentials found')
      } catch (err) {
        // Ignore AbortError - happens during navigation
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Auth callback aborted (navigation)')
          return
        }

        console.error('Auth callback error:', err)
        if (isMounted) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Authentication failed')
          setMessage('Something went wrong during authentication')
        }
      }
    }

    handleCallback()

    return () => {
      isMounted = false
    }
  }, [redirectTo])

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <Image src="/logo.png" alt="TradeITM" fill className="object-contain" />
        </div>

        {/* Processing State */}
        {status === 'processing' && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Authenticating</h1>
            <p className="text-white/60">{message}</p>
            <p className="text-white/40 text-sm mt-4">
              Verifying your Discord account...
            </p>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Welcome!</h1>
            <p className="text-white/60">{message}</p>
          </>
        )}

        {/* Error State */}
        {status === 'error' && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Authentication Failed</h1>
            <p className="text-white/60 mb-2">{message}</p>
            {error && (
              <p className="text-red-400/70 text-sm mb-6">{error}</p>
            )}
            <div className="flex flex-col gap-3">
              <Button asChild className="bg-emerald-500 hover:bg-emerald-600 text-black">
                <Link href="/login">Try Again</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5">
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </>
        )}
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
