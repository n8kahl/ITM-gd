'use client'

import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SPXReplaySpeed } from '@/lib/spx/replay-engine'
import type { EnrichedTrade } from '@/lib/trade-day-replay/types'

const ET_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

interface ReplayControlsProps {
  playing: boolean
  speed: SPXReplaySpeed
  cursorIndex: number
  minCursorIndex: number
  maxCursorIndex: number
  progress: number
  currentTimestampSec: number | null
  trades: EnrichedTrade[]
  selectedTradeIndex: number | null
  disabled?: boolean
  onTogglePlay: () => void
  onSpeedChange: (speed: SPXReplaySpeed) => void
  onCursorIndexChange: (cursorIndex: number) => void
  onJumpToTrade: (tradeIndex: number | null) => void
}

function isReplaySpeed(value: number): value is SPXReplaySpeed {
  return value === 1 || value === 2 || value === 4
}

function formatCurrentEtTimestamp(timestampSec: number | null): string {
  if (timestampSec == null || !Number.isFinite(timestampSec)) {
    return '--:--:-- ET'
  }

  return `${ET_TIMESTAMP_FORMATTER.format(new Date(timestampSec * 1000))} ET`
}

function formatTradeOptionLabel(trade: EnrichedTrade): string {
  const tradeIndex = Number.isFinite(trade.tradeIndex) ? trade.tradeIndex : 0
  const strike = Number.isFinite(trade.contract?.strike) ? trade.contract.strike : null
  const strikeLabel = strike == null
    ? '?'
    : Number.isInteger(strike) ? String(strike) : strike.toFixed(1)
  const typeLabel = trade.contract?.type === 'put' ? 'Put' : 'Call'
  return `Trade ${tradeIndex}: ${strikeLabel} ${typeLabel}`
}

export function ReplayControls({
  playing,
  speed,
  cursorIndex,
  minCursorIndex,
  maxCursorIndex,
  progress,
  currentTimestampSec,
  trades,
  selectedTradeIndex,
  disabled = false,
  onTogglePlay,
  onSpeedChange,
  onCursorIndexChange,
  onJumpToTrade,
}: ReplayControlsProps) {
  const clampedProgress = Number.isFinite(progress)
    ? Math.min(Math.max(progress, 0), 1)
    : 0
  const canScrub = maxCursorIndex > minCursorIndex
  const isJumpDisabled = disabled || trades.length === 0

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 lg:p-4">
      <div className="grid gap-3 lg:grid-cols-[auto_140px_1fr_220px] lg:items-center">
        <Button
          type="button"
          size="sm"
          variant={playing ? 'outline' : 'default'}
          onClick={onTogglePlay}
          disabled={disabled}
          className="justify-center"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? 'Pause' : 'Play'}
        </Button>

        <Select
          value={String(speed)}
          onValueChange={(value) => {
            const parsed = Number(value)
            if (isReplaySpeed(parsed)) {
              onSpeedChange(parsed)
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Replay speed">
            <SelectValue placeholder="Speed" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1x</SelectItem>
            <SelectItem value="2">2x</SelectItem>
            <SelectItem value="4">4x</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Replay Progress</span>
            <span>{Math.round(clampedProgress * 100)}%</span>
          </div>
          <input
            type="range"
            min={minCursorIndex}
            max={maxCursorIndex}
            value={cursorIndex}
            onChange={(event) => onCursorIndexChange(Number(event.target.value))}
            disabled={disabled || !canScrub}
            className="h-2 w-full cursor-pointer accent-emerald-500 disabled:cursor-not-allowed"
            aria-label="Replay scrubber"
          />
        </div>

        <Select
          value={selectedTradeIndex == null ? 'none' : String(selectedTradeIndex)}
          onValueChange={(value) => {
            if (value === 'none') {
              onJumpToTrade(null)
              return
            }
            const parsed = Number(value)
            if (Number.isFinite(parsed)) {
              onJumpToTrade(parsed)
            }
          }}
          disabled={isJumpDisabled}
        >
          <SelectTrigger aria-label="Jump to trade">
            <SelectValue placeholder="Jump to Trade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Jump to Trade</SelectItem>
            {trades.map((trade) => (
              <SelectItem
                key={trade.tradeIndex}
                value={String(trade.tradeIndex)}
              >
                {formatTradeOptionLabel(trade)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mt-2 text-xs text-emerald-100/90">
        {formatCurrentEtTimestamp(currentTimestampSec)}
      </p>
    </div>
  )
}
