'use client'

import type { ChartTimeframe } from '@/lib/api/ai-coach'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import { cn } from '@/lib/utils'

interface ActionStripProps {
  showLevels: boolean
  onToggleLevels: () => void
  showCone: boolean
  onToggleCone: () => void
  showSpatialCoach: boolean
  onToggleSpatialCoach: () => void
  showGEXGlow: boolean
  onToggleGEXGlow: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
  immersiveMode: boolean
  onToggleImmersive: () => void
  showAllLevels: boolean
  onToggleAllLevels: () => void
  showViewModeToggle?: boolean
  viewModeLabel?: string
  onToggleViewMode?: () => void
}

const TIMEFRAMES: ChartTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D']

export function ActionStrip(props: ActionStripProps) {
  const { selectedTimeframe, setChartTimeframe } = useSPXPriceContext()

  const overlayButtons = [
    { label: 'Levels', key: 'L', active: props.showLevels, onClick: props.onToggleLevels, event: SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION },
    { label: 'Cone', key: 'C', active: props.showCone, onClick: props.onToggleCone, event: SPX_TELEMETRY_EVENT.CONE_INTERACTION },
    { label: 'Coach', key: 'A', active: props.showSpatialCoach, onClick: props.onToggleSpatialCoach, event: SPX_TELEMETRY_EVENT.SPATIAL_OVERLAY_TOGGLED },
    { label: 'GEX', key: 'G', active: props.showGEXGlow, onClick: props.onToggleGEXGlow, event: SPX_TELEMETRY_EVENT.GEX_GLOW_TOGGLED },
  ]

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 px-5 py-2.5"
      data-testid="spx-action-strip"
      style={{
        background: 'linear-gradient(0deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((timeframe) => (
          <button
            key={timeframe}
            type="button"
            onClick={() => {
              setChartTimeframe(timeframe)
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                surface: 'action_strip_timeframe',
                timeframe,
              })
            }}
            className={cn(
              'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              selectedTimeframe === timeframe
                ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200'
                : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
            )}
          >
            {timeframe}
          </button>
        ))}

        <div className="mx-2 h-4 w-px bg-white/10" />

        <button
          type="button"
          onClick={props.onToggleAllLevels}
          className={cn(
            'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.showAllLevels
              ? 'border-champagne/40 bg-champagne/12 text-champagne'
              : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
          )}
        >
          {props.showAllLevels ? 'All Levels' : 'Focus'}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {overlayButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={() => {
              button.onClick()
              trackSPXTelemetryEvent(button.event, {
                surface: 'action_strip_overlay',
                overlay: button.label.toLowerCase(),
                nextState: !button.active,
              })
            }}
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              button.active
                ? 'border-champagne/30 bg-champagne/10 text-champagne'
                : 'border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70',
            )}
          >
            {button.label}
            <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">
              {button.key}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            props.onToggleSidebar()
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SIDEBAR_TOGGLED, {
              surface: 'action_strip',
              nextState: !props.sidebarOpen,
            })
          }}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.sidebarOpen
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-white/10 bg-white/[0.02] text-white/50',
          )}
        >
          Panel
          <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">S</span>
        </button>
        <button
          type="button"
          onClick={() => {
            props.onToggleImmersive()
            trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.IMMERSIVE_MODE_TOGGLED, {
              surface: 'action_strip',
              nextState: !props.immersiveMode,
            })
          }}
          className={cn(
            'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
            props.immersiveMode
              ? 'border-champagne/40 bg-champagne/12 text-champagne'
              : 'border-white/10 bg-white/[0.02] text-white/50',
          )}
        >
          Immersive
          <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">I</span>
        </button>
        {props.showViewModeToggle && props.onToggleViewMode && (
          <button
            type="button"
            onClick={props.onToggleViewMode}
            className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white/50 transition-colors hover:text-white/80"
          >
            {props.viewModeLabel || 'Toggle View'}
            <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">V</span>
          </button>
        )}
      </div>
    </div>
  )
}
