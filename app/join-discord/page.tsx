'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, ExternalLink, RefreshCw, AlertTriangle, LogOut, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { AuroraBackground } from '@/components/ui/aurora-background'

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
    </svg>
  )
}

// Fallback Discord invite URL
const DEFAULT_DISCORD_INVITE_URL = 'https://discord.gg/tradeitm'

export default function JoinDiscordPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [discordInviteUrl, setDiscordInviteUrl] = useState(DEFAULT_DISCORD_INVITE_URL)

  // Fetch dynamic Discord invite URL from config
  useEffect(() => {
    fetch('/api/public/config')
      .then(res => res.json())
      .then(data => {
        if (data.discord_invite_url) {
          setDiscordInviteUrl(data.discord_invite_url)
        }
      })
      .catch(() => {
        // Keep fallback URL on error
      })
  }, [])

  const handleTryAgain = async () => {
    setIsLoading(true)
    // Clear the session and redirect to login
    // This forces a fresh Discord OAuth which will re-check membership
    try {
      await supabase.auth.signOut()
      router.push('/login?redirect=/members')
    } catch (err) {
      console.error('Error signing out:', err)
      setIsLoading(false)
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
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8962E] flex items-center justify-center mx-auto mb-4 animate-pulse-subtle">
              <Lock className="w-10 h-10 text-black" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#F1E5AC] bg-clip-text text-transparent mb-2">
              Membership Required
            </h1>
            <p className="text-white/60 mt-2">
              You must be a member of the TradeITM Discord server to access the member area.
            </p>
          </div>

          {/* Card - Holographic Border */}
          <div className="glass-card-heavy border-holo rounded-2xl p-6">
            {/* Warning Message */}
            <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-400 font-medium">Not a Server Member</p>
                  <p className="text-sm text-amber-400/70 mt-1">
                    Your Discord account is not connected to the TradeITM Discord server.
                    Please join the server first, then try logging in again.
                  </p>
                </div>
              </div>
            </div>

            {/* Join Discord Button */}
            <Button
              asChild
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-7 text-lg font-semibold shadow-lg shadow-[#5865F2]/20"
            >
              <a href={discordInviteUrl} target="_blank" rel="noopener noreferrer">
                <DiscordIcon className="w-6 h-6 mr-3" />
                Join TradeITM Discord
                <ExternalLink className="w-4 h-4 ml-2 opacity-60" />
              </a>
            </Button>

            {/* Steps */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-medium text-white/80">Steps to get access:</h3>
              <ol className="space-y-3 text-sm text-white/60">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <span>Click the button above to join the TradeITM Discord server</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <span>Accept the server invite with the same Discord account you used to log in</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <span>Return here and click "Try Again" below</span>
                </li>
              </ol>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0a0a0b] text-white/40">
                  Already joined?
                </span>
              </div>
            </div>

            {/* Try Again Button */}
            <Button
              onClick={handleTryAgain}
              disabled={isLoading}
              variant="outline"
              className="w-full border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 py-6"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Checking membership...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Try Again
                </>
              )}
            </Button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full mt-4 flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out and go back
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-white/40 text-xs mt-6">
            Need help?{' '}
            <a href="mailto:support@tradeitm.com" className="text-[#D4AF37] hover:underline">
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
