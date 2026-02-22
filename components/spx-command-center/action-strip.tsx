'use client'

import type { ChartTimeframe } from '@/lib/api/ai-coach'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import type { SPXOverlayPreset } from '@/lib/spx/overlay-presets'
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
  overlayPreset?: SPXOverlayPreset
  onSelectOverlayPreset?: (preset: SPXOverlayPreset) => void
  spatialThrottled?: boolean
  primaryActionMode: 'scan' | 'evaluate' | 'in_trade'
  primaryActionLabel: string
  guidedStatusLabel?: string | null
  primaryActionEnabled: boolean
  primaryActionBlockedReason?: string | null
  onPrimaryAction: () => void
  onShowWhy: () => void
  focusMode: 'decision' | 'execution' | 'risk_only'
  onFocusModeChange: (mode: 'decision' | 'execution' | 'risk_only') => void
  replayEnabled: boolean
  replayPlaying: boolean
  replayWindowMinutes: 30 | 60 | 120
  replaySpeed: 1 | 2 | 4
  onToggleReplay: () => void
  onToggleReplayPlayback: () => void
  onCycleReplayWindow: () => void
  onCycleReplaySpeed: () => void
  showViewModeToggle?: boolean
  desktopViewMode?: 'classic' | 'spatial'
  viewModeLabel?: string
  onToggleViewMode?: () => void
  overlayCapability?: {
    levels?: boolean
    cone?: boolean
    coach?: boolean
    gex?: boolean
  }
  sidebarToggleEnabled?: boolean
  immersiveToggleEnabled?: boolean
  showAdvancedHud: boolean
  onToggleAdvancedHud: () => void
}

const TIMEFRAMES: ChartTimeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D']
const OVERLAY_PRESETS: SPXOverlayPreset[] = ['execution', 'flow', 'spatial']
const FOCUS_MODES: Array<{ key: 'decision' | 'execution' | 'risk_only'; label: string }> = [
  { key: 'decision', label: 'Decision' },
  { key: 'execution', label: 'Execution' },
  { key: 'risk_only', label: 'Risk' },
]

export function ActionStrip(props: ActionStripProps) {
  const { selectedTimeframe, setChartTimeframe } = useSPXPriceContext()
  const overlayCapability = props.overlayCapability || {}
  const sidebarToggleEnabled = props.sidebarToggleEnabled ?? true
  const immersiveToggleEnabled = props.immersiveToggleEnabled ?? true
  const quickTimeframes: ChartTimeframe[] = (() => {
    const base: ChartTimeframe[] = ['1m', '5m', '15m']
    if (!base.includes(selectedTimeframe)) base.push(selectedTimeframe)
    return base
  })()
  const decisionStateLabel = props.primaryActionMode === 'in_trade'
    ? 'In Trade'
    : props.primaryActionMode === 'evaluate'
      ? (props.primaryActionEnabled ? 'Setup Ready' : 'Wait')
      : 'Scanning'

  const overlayButtons = [
    {
      label: 'Levels',
      key: 'M',
      testId: 'levels',
      active: props.showLevels,
      enabled: overlayCapability.levels ?? true,
      onClick: props.onToggleLevels,
      event: SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION,
    },
    {
      label: 'Cone',
      key: 'C',
      testId: 'cone',
      active: props.showCone,
      enabled: overlayCapability.cone ?? true,
      onClick: props.onToggleCone,
      event: SPX_TELEMETRY_EVENT.CONE_INTERACTION,
    },
    {
      label: 'Coach',
      key: 'A',
      testId: 'coach',
      active: props.showSpatialCoach,
      enabled: overlayCapability.coach ?? true,
      onClick: props.onToggleSpatialCoach,
      event: SPX_TELEMETRY_EVENT.SPATIAL_OVERLAY_TOGGLED,
    },
    {
      label: 'GEX',
      key: 'G',
      testId: 'gex',
      active: props.showGEXGlow,
      enabled: overlayCapability.gex ?? true,
      onClick: props.onToggleGEXGlow,
      event: SPX_TELEMETRY_EVENT.GEX_GLOW_TOGGLED,
    },
  ]

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 px-5 py-2.5"
      data-testid="spx-action-strip"
      style={{
        background: 'linear-gradient(0deg, rgba(10,10,11,0.88) 0%, rgba(10,10,11,0.4) 70%, transparent 100%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-2">
          {quickTimeframes.map((timeframe) => (
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

          <button
            type="button"
            disabled={!props.primaryActionEnabled}
            onClick={props.onPrimaryAction}
            data-testid="spx-action-primary-cta"
            title={!props.primaryActionEnabled ? (props.primaryActionBlockedReason || 'Action unavailable') : undefined}
            className={cn(
              'ml-1 min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.07em] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              props.primaryActionMode === 'in_trade'
                ? 'border-rose-300/40 bg-rose-500/16 text-rose-100 hover:bg-rose-500/24'
                : props.primaryActionMode === 'evaluate'
                  ? 'border-emerald-300/40 bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/24'
                  : 'border-champagne/40 bg-champagne/14 text-champagne hover:bg-champagne/20',
            )}
          >
            {props.primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={props.onShowWhy}
            data-testid="spx-action-primary-why"
            className="min-h-[36px] rounded-md border border-white/18 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.07em] text-white/72 transition-colors hover:text-white"
          >
            Why
          </button>
          <span
            data-testid="spx-action-decision-state"
            className="ml-1.5 rounded border border-white/18 bg-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.07em] text-white/78"
          >
            {decisionStateLabel}
          </span>
          {props.guidedStatusLabel && (
            <span
              data-testid="spx-action-guided-status"
              className="ml-1.5 rounded border border-white/18 bg-white/[0.04] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.07em] text-white/75"
            >
              {props.guidedStatusLabel}
            </span>
          )}
          {!props.primaryActionEnabled && props.primaryActionBlockedReason && (
            <span
              data-testid="spx-action-primary-cta-blocked-reason"
              className="ml-1.5 rounded border border-amber-300/35 bg-amber-500/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.07em] text-amber-100"
            >
              {props.primaryActionBlockedReason}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
              onClick={() => {
                const next = !props.showAdvancedHud
                props.onToggleAdvancedHud()
                trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                  surface: 'action_strip_advanced_hud',
                  action: next ? 'open' : 'close',
                })
              }}
            aria-expanded={props.showAdvancedHud}
            data-testid="spx-action-advanced-hud-toggle"
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              props.showAdvancedHud
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.02] text-white/55 hover:text-white/80',
            )}
          >
            Advanced HUD
          </button>

          {props.showViewModeToggle && props.onToggleViewMode && (
            <div
              className="inline-flex items-center rounded-lg border border-white/15 bg-white/[0.03] p-1"
              data-testid="spx-view-mode-toggle"
            >
              <button
                type="button"
                data-testid="spx-view-mode-classic"
                aria-pressed={props.desktopViewMode === 'classic'}
                onClick={() => {
                  if (props.desktopViewMode === 'spatial') props.onToggleViewMode?.()
                }}
                className={cn(
                  'min-h-[36px] rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
                  props.desktopViewMode === 'classic'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'text-white/55 hover:text-white/80',
                )}
              >
                Classic
              </button>
              <button
                type="button"
                data-testid="spx-view-mode-spatial"
                aria-pressed={props.desktopViewMode === 'spatial'}
                onClick={() => {
                  if (props.desktopViewMode !== 'spatial') props.onToggleViewMode?.()
                }}
                className={cn(
                  'min-h-[36px] rounded-md px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors',
                  props.desktopViewMode === 'spatial'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'text-white/55 hover:text-white/80',
                )}
              >
                Spatial HUD
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        data-testid="spx-action-advanced-hud-drawer"
        data-state={props.showAdvancedHud ? 'open' : 'closed'}
        className={cn(
          'absolute bottom-[54px] right-5 z-50 w-[min(760px,calc(100vw-40px))] rounded-xl border border-white/12 bg-[#0A0A0B]/95 p-2.5 shadow-2xl transition-all duration-150',
          props.showAdvancedHud ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.1em] text-white/55">Advanced Overlay HUD</span>
        </div>

        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1" data-testid="spx-action-focus-mode">
            {FOCUS_MODES.map((mode) => {
              const active = props.focusMode === mode.key
              return (
                <button
                  key={mode.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => props.onFocusModeChange(mode.key)}
                  data-testid={`spx-action-focus-mode-${mode.key}`}
                  className={cn(
                    'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
                    active
                      ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
                  )}
                >
                  {mode.label}
                </button>
              )
            })}
          </div>

          <div className="mx-2 h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1" data-testid="spx-action-replay-controls">
            <button
              type="button"
              aria-pressed={props.replayEnabled}
              onClick={props.onToggleReplay}
              data-testid="spx-action-replay-toggle"
              className={cn(
                'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
                props.replayEnabled
                  ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-100'
                  : 'border-white/10 bg-white/[0.02] text-white/52 hover:text-white/80',
              )}
            >
              {props.replayEnabled ? 'Replay On' : 'Replay'}
            </button>
            <button
              type="button"
              aria-pressed={props.replayPlaying}
              onClick={props.onToggleReplayPlayback}
              disabled={!props.replayEnabled}
              data-testid="spx-action-replay-playback"
              className={cn(
                'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                props.replayPlaying
                  ? 'border-champagne/35 bg-champagne/12 text-champagne'
                  : 'border-white/10 bg-white/[0.02] text-white/52 hover:text-white/80',
              )}
            >
              {props.replayPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={props.onCycleReplayWindow}
              disabled={!props.replayEnabled}
              data-testid="spx-action-replay-window"
              className="min-h-[36px] rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white/52 transition-colors hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {props.replayWindowMinutes}m
            </button>
            <button
              type="button"
              onClick={props.onCycleReplaySpeed}
              disabled={!props.replayEnabled}
              data-testid="spx-action-replay-speed"
              className="min-h-[36px] rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-white/52 transition-colors hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {props.replaySpeed}x
            </button>
          </div>

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
            {props.showAllLevels ? 'All Levels' : 'Key Levels'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {props.onSelectOverlayPreset && OVERLAY_PRESETS.map((preset) => {
            const active = props.overlayPreset === preset
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  props.onSelectOverlayPreset?.(preset)
                }}
                data-testid={`spx-action-preset-${preset}`}
                className={cn(
                  'min-h-[36px] rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
                  active
                    ? 'border-emerald-400/40 bg-emerald-500/12 text-emerald-200'
                    : 'border-white/10 bg-white/[0.02] text-white/50 hover:text-white/80',
                )}
              >
                {preset}
              </button>
            )
          })}

          {props.spatialThrottled && (
            <div
              data-testid="spx-action-strip-throttle-indicator"
              className="rounded-md border border-amber-300/40 bg-amber-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-amber-100"
            >
              Spatial throttle active
            </div>
          )}

          {overlayButtons.map((button) => (
            <button
              key={button.label}
              type="button"
              aria-pressed={button.active}
              disabled={!button.enabled}
              title={button.enabled ? undefined : 'Available in Spatial HUD view'}
              onClick={() => {
                if (!button.enabled) {
                  trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.OVERLAY_CONTROL_BLOCKED, {
                    surface: 'action_strip_overlay',
                    overlay: button.label.toLowerCase(),
                    reason: 'view_mode_unavailable',
                  })
                  return
                }
                button.onClick()
                trackSPXTelemetryEvent(button.event, {
                  surface: 'action_strip_overlay',
                  overlay: button.label.toLowerCase(),
                  nextState: !button.active,
                })
              }}
              data-testid={`spx-action-overlay-${button.testId}`}
              className={cn(
                'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
                button.active
                  ? 'border-champagne/30 bg-champagne/10 text-champagne'
                  : 'border-white/10 bg-white/[0.02] text-white/40 hover:text-white/70',
                !button.enabled && 'cursor-not-allowed border-white/10 bg-white/[0.015] text-white/25',
              )}
            >
              {button.label}
              <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">
                {button.key}
              </span>
            </button>
          ))}

          <button
            type="button"
            aria-pressed={props.sidebarOpen}
            disabled={!sidebarToggleEnabled}
            title={sidebarToggleEnabled ? undefined : 'Available in Spatial HUD view'}
            onClick={() => {
              if (!sidebarToggleEnabled) {
                trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.OVERLAY_CONTROL_BLOCKED, {
                  surface: 'action_strip',
                  overlay: 'sidebar',
                  reason: 'view_mode_unavailable',
                })
                return
              }
              props.onToggleSidebar()
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SIDEBAR_TOGGLED, {
                surface: 'action_strip',
                nextState: !props.sidebarOpen,
              })
            }}
            data-testid="spx-action-sidebar-toggle"
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              props.sidebarOpen
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.02] text-white/50',
              !sidebarToggleEnabled && 'cursor-not-allowed border-white/10 bg-white/[0.015] text-white/25',
            )}
          >
            Panel
            <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">S</span>
          </button>

          <button
            type="button"
            aria-pressed={props.immersiveMode}
            disabled={!immersiveToggleEnabled}
            title={immersiveToggleEnabled ? undefined : 'Available in Spatial HUD view'}
            onClick={() => {
              if (!immersiveToggleEnabled) {
                trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.OVERLAY_CONTROL_BLOCKED, {
                  surface: 'action_strip',
                  overlay: 'immersive',
                  reason: 'view_mode_unavailable',
                })
                return
              }
              props.onToggleImmersive()
              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.IMMERSIVE_MODE_TOGGLED, {
                surface: 'action_strip',
                nextState: !props.immersiveMode,
              })
            }}
            data-testid="spx-action-immersive-toggle"
            className={cn(
              'flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors',
              props.immersiveMode
                ? 'border-champagne/40 bg-champagne/12 text-champagne'
                : 'border-white/10 bg-white/[0.02] text-white/50',
              !immersiveToggleEnabled && 'cursor-not-allowed border-white/10 bg-white/[0.015] text-white/25',
            )}
          >
            Immersive
            <span className="rounded border border-white/15 px-1 py-0.5 text-[7px] text-white/30">I</span>
          </button>
        </div>
      </div>
    </div>
  )
}
