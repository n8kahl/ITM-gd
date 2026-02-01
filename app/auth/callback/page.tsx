'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/members'

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing authentication...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from the URL hash (Supabase handles this)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          // Try to exchange the code for a session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href.split('?')[1] || ''
          )

          if (exchangeError) {
            throw exchangeError
          }

          // Get the new session
          const { data: { session: newSession }, error: newSessionError } = await supabase.auth.getSession()

          if (newSessionError || !newSession) {
            throw newSessionError || new Error('Failed to create session')
          }
        }

        setStatus('success')
        setMessage('Authentication successful! Redirecting...')

        // Redirect after a short delay
        setTimeout(() => {
          router.push(redirectTo)
        }, 1500)
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setMessage('Something went wrong during authentication')
      }
    }

    handleCallback()
  }, [router, redirectTo])

  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-8 h-8 text-black" />
        </div>

        {/* Processing State */}
        {status === 'processing' && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/20" />
              <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37] border-t-transparent animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Authenticating</h1>
            <p className="text-white/60">{message}</p>
            <p className="text-white/40 text-sm mt-4">
              Verifying your Discord account and syncing roles...
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
              <Button asChild className="bg-[#D4AF37] hover:bg-[#B8962E] text-black">
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-black" />
          </div>
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/20" />
            <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37] border-t-transparent animate-spin" />
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
