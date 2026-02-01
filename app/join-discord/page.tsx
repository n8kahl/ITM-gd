'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, ShieldX, LogOut, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function JoinDiscordPage() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefreshAccess = () => {
    setIsRefreshing(true)
    // Reload the page to trigger sync-discord-roles check again
    window.location.reload()
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
    <div className="min-h-screen bg-[#0f0f10] flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Icon & Headline */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Active Membership Required</h1>
            <p className="text-white/60 mt-2">
              We could not verify your access. You must purchase a TradeITM Sniper membership to access this terminal and the Discord server.
            </p>
          </div>

          {/* Card */}
          <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl p-6">
            {/* Warning Message */}
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-start gap-3">
                <ShieldX className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Access Denied</p>
                  <p className="text-sm text-red-400/70 mt-1">
                    Your Discord account does not have an active TradeITM membership role.
                    Please purchase a membership plan to gain access.
                  </p>
                </div>
              </div>
            </div>

            {/* View Membership Plans Button */}
            <Button
              asChild
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8962E] hover:from-[#E5C048] hover:to-[#C9A73F] text-black py-7 text-lg font-semibold shadow-lg shadow-[#D4AF37]/20"
            >
              <Link href="/#pricing">
                <CreditCard className="w-6 h-6 mr-3" />
                View Membership Plans
              </Link>
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[#0a0a0b] text-white/40">
                  Already purchased?
                </span>
              </div>
            </div>

            {/* Refresh Access Button */}
            <Button
              onClick={handleRefreshAccess}
              disabled={isRefreshing}
              variant="outline"
              className="w-full border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 py-6"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Checking access...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Refresh Access
                </>
              )}
            </Button>

            {/* Helper text */}
            <p className="text-center text-white/40 text-xs mt-3">
              Just purchased? It may take 1-2 minutes for Whop to sync your roles.
            </p>

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
