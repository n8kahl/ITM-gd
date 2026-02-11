'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, Copy, Check, DollarSign, Users, TrendingUp } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface WhopAffiliateCardProps {
  affiliateUrl?: string
  stats?: {
    total_referrals: number
    active_referrals: number
    total_earnings: number
    unpaid_earnings: number
    conversion_rate: number | null
  } | null
  loading: boolean
  className?: string
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// ============================================
// COMPONENT
// ============================================

export function WhopAffiliateCard({
  affiliateUrl,
  stats,
  loading,
  className,
}: WhopAffiliateCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!affiliateUrl) return
    try {
      await navigator.clipboard.writeText(affiliateUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = affiliateUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Loading state
  if (loading) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.08]', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm text-[#9A9A9A]">Loading affiliate data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No affiliate URL
  if (!affiliateUrl) {
    return (
      <Card className={cn('glass-card-heavy border-white/[0.08]', className)}>
        <CardHeader className="pb-0">
          <CardTitle className="text-base text-[#F5F5F0] flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            Affiliate Program
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-4">
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm text-[#9A9A9A]">
              No affiliate link found
            </p>
            <p className="text-xs text-[#9A9A9A]/60">
              Contact support to join the affiliate program
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('glass-card-heavy border-white/[0.08]', className)}>
      <CardHeader className="pb-0">
        <CardTitle className="text-base text-[#F5F5F0] flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Affiliate Program
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        {/* Affiliate URL with Copy */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] mb-2">
            Your Referral Link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <p className="text-xs text-[#F5F5F0]/70 truncate font-mono">
                {affiliateUrl}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleCopy}
              className="shrink-0"
              aria-label="Copy affiliate URL"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {/* Total Referrals */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-3 h-3 text-[#9A9A9A]" />
                <span className="text-[10px] uppercase tracking-widest text-[#9A9A9A]">
                  Total
                </span>
              </div>
              <p className="text-lg font-semibold text-[#F5F5F0] font-mono-numbers">
                {stats.total_referrals.toLocaleString()}
              </p>
            </div>

            {/* Active Referrals */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] uppercase tracking-widest text-[#9A9A9A]">
                  Active
                </span>
              </div>
              <p className="text-lg font-semibold text-emerald-400 font-mono-numbers">
                {stats.active_referrals.toLocaleString()}
              </p>
            </div>

            {/* Total Earnings */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-[#F5EDCC]" />
                <span className="text-[10px] uppercase tracking-widest text-[#9A9A9A]">
                  Earned
                </span>
              </div>
              <p className="text-lg font-semibold text-[#F5EDCC] font-mono-numbers">
                {formatCurrency(stats.total_earnings)}
              </p>
            </div>

            {/* Unpaid Earnings */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="w-3 h-3 text-[#9A9A9A]" />
                <span className="text-[10px] uppercase tracking-widest text-[#9A9A9A]">
                  Unpaid
                </span>
              </div>
              <p className="text-lg font-semibold text-[#F5F5F0] font-mono-numbers">
                {formatCurrency(stats.unpaid_earnings)}
              </p>
            </div>
          </div>
        )}

        {/* Conversion Rate */}
        {stats?.conversion_rate != null && (
          <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-[#9A9A9A]">Conversion Rate</span>
            <span className="text-sm font-semibold text-emerald-400 font-mono-numbers">
              {stats.conversion_rate.toFixed(1)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
