'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getSafeRedirect } from '@/lib/safe-redirect'
import { AuroraBackground } from '@/components/ui/aurora-background'
import SparkleLog from '@/components/ui/sparkle-logo'

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
    </svg>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          // Already logged in, redirect
          router.push(redirectTo)
        }
      } catch (err) {
        console.error('Auth check error:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router, redirectTo])

  // Handle OAuth callback errors
  useEffect(() => {
    const errorDescription = searchParams.get('error_description')
    if (errorDescription) {
      setError(decodeURIComponent(errorDescription))
    }
  }, [searchParams])

  const handleDiscordLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          scopes: 'identify email guilds guilds.members.read',
        },
      })

      if (signInError) {
        throw signInError
      }

      // User will be redirected to Discord
    } catch (err) {
      console.error('Discord login error:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to Discord')
      setIsLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center relative overflow-hidden">
        <AuroraBackground />
        <div className="text-center relative z-10">
          <div className="mx-auto mb-4">
            <SparkleLog
              src="/logo.png"
              alt="TradeITM"
              width={48}
              height={48}
              sparkleCount={8}
              enableFloat={false}
              enableGlow={true}
              glowIntensity="medium"
            />
          </div>
          <p className="text-white/60">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Aurora Background */}
      <AuroraBackground />

      {/* Header */}
      <header className="p-6 relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex justify-center">
              <SparkleLog
                src="/logo.png"
                alt="TradeITM"
                width={80}
                height={80}
                sparkleCount={12}
                enableFloat={true}
                enableGlow={true}
                glowIntensity="medium"
              />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent mb-2">
              Welcome Back
            </h1>
            <p className="text-white/60 mt-2">
              Sign in with Discord to access your member dashboard
            </p>
          </div>

          {/* Login Card - Holographic Border */}
          <div className="glass-card-heavy border-holo rounded-2xl p-6">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400 font-medium">Authentication Failed</p>
                    <p className="text-sm text-red-400/70 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Discord Login Button */}
            <Button
              onClick={handleDiscordLogin}
              disabled={isLoading}
              className="w-full h-14 bg-[#5865F2] hover:bg-[#4752C4] text-white text-lg font-semibold shadow-[0_0_30px_-10px_#5865F2]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Connecting to Discord...
                </>
              ) : (
                <>
                  <DiscordIcon className="w-6 h-6 mr-3" />
                  Log in with Discord
                </>
              )}
            </Button>

            {/* Discord Server Requirement */}
            <p className="text-center text-white/50 text-sm mt-4">
              Must be a member of the TradeITM Discord Server to access.
            </p>

            {/* Info */}
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/60">
                  Your Discord roles will sync automatically
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/60">
                  Access courses based on your membership tier
                </p>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-white/60">
                  Track your trading journal and progress
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0a0a0b] text-white/40">
                  Not a member yet?
                </span>
              </div>
            </div>

            {/* Join Link */}
            <Button asChild variant="outline" className="w-full border-white/20 text-white hover:bg-white/5">
              <Link href="/#pricing">
                View Membership Plans
              </Link>
            </Button>
          </div>

          {/* Footer */}
          <div className="mt-6 space-y-3">
            {/* System Status */}
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-emerald-500/50 text-[10px] font-medium tracking-wider uppercase">
                All Systems Operational
              </p>
            </div>

            {/* Legal Links */}
            <p className="text-center text-white/40 text-xs">
              By continuing, you agree to our{' '}
              <Link href="/terms-of-service" className="text-emerald-500 hover:underline">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link href="/privacy-policy" className="text-emerald-500 hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <AuroraBackground />
        <div className="text-center relative z-10">
          <div className="mx-auto mb-4">
            <SparkleLog
              src="/logo.png"
              alt="TradeITM"
              width={48}
              height={48}
              sparkleCount={8}
              enableFloat={false}
              enableGlow={true}
              glowIntensity="medium"
            />
          </div>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
