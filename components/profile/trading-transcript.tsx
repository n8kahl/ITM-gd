'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Lock } from 'lucide-react'
import { EquitySparkline } from '@/components/profile/equity-sparkline'
import type { TradingTranscript } from '@/lib/types/social'

// ============================================
// TYPES
// ============================================

interface TradingTranscriptProps {
  transcript: TradingTranscript | null
  isOwnProfile: boolean
  isPublic: boolean
  loading: boolean
  className?: string
}

// ============================================
// HELPERS
// ============================================

function formatPnl(value: number | null): string {
  if (value == null) return '--'
  const prefix = value >= 0 ? '+' : ''
  return `${prefix}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPercent(value: number | null): string {
  if (value == null) return '--'
  return `${value.toFixed(1)}%`
}

function formatNumber(value: number | null): string {
  if (value == null) return '--'
  return value.toLocaleString()
}

function formatScore(value: number | null): string {
  if (value == null) return '--'
  return value.toFixed(1)
}

const AI_GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-emerald-500',
  A: 'bg-emerald-500',
  'A-': 'bg-emerald-400',
  'B+': 'bg-blue-500',
  B: 'bg-blue-400',
  'B-': 'bg-blue-300',
  'C+': 'bg-yellow-500',
  C: 'bg-yellow-400',
  'C-': 'bg-yellow-300',
  D: 'bg-orange-400',
  F: 'bg-red-500',
}

// ============================================
// STAT ITEM
// ============================================

function StatItem({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-[#9A9A9A]">
        {label}
      </span>
      <span
        className={cn('text-lg font-semibold font-mono-numbers text-[#F5F5F0]', valueClass)}
      >
        {value}
      </span>
    </div>
  )
}

// ============================================
// COMPONENT
// ============================================

export function TradingTranscriptCard({
  transcript,
  isOwnProfile,
  isPublic,
  loading,
  className,
}: TradingTranscriptProps) {
  // Loading state
  if (loading) {
    return (
      <Card
        data-testid="trading-transcript"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-sm text-[#9A9A9A]">Loading transcript...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Private transcript for non-owner
  if (!isOwnProfile && !isPublic) {
    return (
      <Card
        data-testid="trading-transcript"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Lock className="w-8 h-8 text-[#9A9A9A]" />
            <p className="text-sm text-[#9A9A9A]">
              This trader&apos;s transcript is private
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // No data
  if (!transcript) {
    return (
      <Card
        data-testid="trading-transcript"
        className={cn('glass-card-heavy border-white/[0.08]', className)}
      >
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <p className="text-sm text-[#9A9A9A]">No trading data yet</p>
            <p className="text-xs text-[#9A9A9A]/60">
              Stats will appear once trades are logged
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pnlIsPositive = transcript.total_pnl >= 0
  const gradeEntries = Object.entries(transcript.ai_grade_distribution ?? {}).sort(
    (a, b) => b[1] - a[1]
  )
  const maxGradeCount = gradeEntries.length > 0
    ? Math.max(...gradeEntries.map(([, count]) => count))
    : 1

  return (
    <Card
      data-testid="trading-transcript"
      className={cn('glass-card-heavy border-white/[0.08]', className)}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-[#F5F5F0]">
            Trading Transcript
          </CardTitle>
          <Badge
            data-testid="verified-badge"
            variant="outline"
            className="gap-1 text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          >
            <CheckCircle2 className="w-3 h-3" />
            Verified Stats
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatItem
            label="Total Trades"
            value={formatNumber(transcript.total_trades)}
          />
          <StatItem
            label="Win Rate"
            value={formatPercent(transcript.win_rate)}
            valueClass={
              transcript.win_rate != null && transcript.win_rate >= 50
                ? 'text-emerald-400'
                : 'text-red-400'
            }
          />
          <StatItem
            label="Profit Factor"
            value={
              transcript.profit_factor != null
                ? transcript.profit_factor.toFixed(2)
                : '--'
            }
            valueClass={
              transcript.profit_factor != null && transcript.profit_factor >= 1
                ? 'text-emerald-400'
                : undefined
            }
          />
          <StatItem
            label="Total P&L"
            value={formatPnl(transcript.total_pnl)}
            valueClass={pnlIsPositive ? 'text-emerald-400' : 'text-red-400'}
          />
          <StatItem
            label="Best Month"
            value={transcript.best_month ?? '--'}
          />
          <StatItem
            label="Avg Discipline"
            value={formatScore(transcript.avg_discipline_score)}
          />
          <StatItem
            label="Avg AI Grade"
            value={transcript.avg_ai_grade ?? '--'}
            valueClass="text-emerald-400"
          />
        </div>

        {/* Mini Equity Curve Sparkline */}
        {transcript.equity_curve && transcript.equity_curve.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] mb-2">
              Equity Curve
            </p>
            <div className="rounded-lg border border-white/5 bg-white/[0.01] p-2">
              <EquitySparkline data={transcript.equity_curve} className="h-20" />
            </div>
          </div>
        )}

        {/* AI Grade Distribution */}
        {gradeEntries.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] uppercase tracking-widest text-[#9A9A9A] mb-3">
              AI Grade Distribution
            </p>
            <div className="space-y-2">
              {gradeEntries.map(([grade, count]) => (
                <div key={grade} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-medium text-[#F5F5F0] text-right font-mono-numbers">
                    {grade}
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        AI_GRADE_COLORS[grade] ?? 'bg-zinc-500'
                      )}
                      style={{
                        width: `${(count / maxGradeCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-xs text-[#9A9A9A] text-right font-mono-numbers">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
