'use client'

import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SPXPaletteCommand } from '@/components/spx-command-center/command-palette'
import type { SPXReplaySpeed, SPXReplayWindowMinutes } from '@/lib/spx/replay-engine'
import type { SPXRiskEnvelopeReasonCode } from '@/lib/spx/risk-envelope'
import type { Setup } from '@/lib/types/spx-command-center'
import {
  SPX_KEYBOARD_COMMAND_BINDINGS,
  SPX_OVERLAY_BLOCKED_META,
  type SPXCommandGroup,
  type SPXCommandId,
  type SPXCommandSource,
} from '@/lib/spx/commands'
import { SPX_SHORTCUT_EVENT } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

type SPXViewMode = 'classic' | 'spatial'
type SPXTradeMode = 'scan' | 'in_trade'
type SPXFocusMode = 'decision' | 'execution' | 'risk_only'

type InternalCommand = {
  id: SPXCommandId
  label: string
  group: SPXCommandGroup
  keywords: string[]
  shortcut?: string
  disabled?: boolean
  showInPalette?: boolean
  run: (source: SPXCommandSource, keyboardKey?: string) => void
}

interface UseSPXCommandRegistryInput {
  uxFlagsCommandPalette: boolean
  uxFlagsSpatialHudV1: boolean
  isMobile: boolean
  viewMode: SPXViewMode
  tradeMode: SPXTradeMode
  activeSetups: Setup[]
  actionableSetups: Setup[]
  selectedSetup: Setup | null
  selectedActionableSetup: Setup | null
  showLevelOverlay: boolean
  showCone: boolean
  showGEXGlow: boolean
  showSpatialCoach: boolean
  immersiveMode: boolean
  sidebarCollapsed: boolean
  showShortcutHelp: boolean
  selectSetup: (setup: Setup | null) => void
  enterTrade: (setup?: Setup | null) => void
  exitTrade: () => void
  setShowLevelOverlay: Dispatch<SetStateAction<boolean>>
  setShowCone: Dispatch<SetStateAction<boolean>>
  setShowSpatialCoach: Dispatch<SetStateAction<boolean>>
  setShowGEXGlow: Dispatch<SetStateAction<boolean>>
  setImmersiveMode: Dispatch<SetStateAction<boolean>>
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>
  setShowShortcutHelp: Dispatch<SetStateAction<boolean>>
  handleViewModeChange: (nextMode: SPXViewMode, source: 'toggle' | 'command' | 'shortcut') => void
  focusMode: SPXFocusMode
  setFocusMode: (nextMode: SPXFocusMode, source: 'command' | 'shortcut' | 'action_strip') => void
  replayEnabled: boolean
  replayPlaying: boolean
  replayWindowMinutes: SPXReplayWindowMinutes
  replaySpeed: SPXReplaySpeed
  toggleReplay: (source: 'command' | 'shortcut' | 'action_strip') => void
  toggleReplayPlayback: (source: 'command' | 'shortcut' | 'action_strip') => void
  cycleReplayWindow: (source: 'command' | 'shortcut' | 'action_strip') => void
  cycleReplaySpeed: (source: 'command' | 'shortcut' | 'action_strip') => void
  enterTradeBlocked: boolean
  enterTradeBlockedReasonCode: SPXRiskEnvelopeReasonCode
  enterTradeBlockedReasonLabel: string | null
}

function isActionable(setup: Setup | null): setup is Setup {
  if (!setup) return false
  return setup.status === 'ready' || setup.status === 'triggered'
}

export function useSPXCommandRegistry(input: UseSPXCommandRegistryInput): {
  commandPaletteCommands: SPXPaletteCommand[]
  runCommandById: (id: SPXCommandId, source?: SPXCommandSource, keyboardKey?: string) => boolean
  runKeyboardShortcut: (key: string) => boolean
} {
  const spatialOverlayControlsEnabled = !input.isMobile && input.uxFlagsSpatialHudV1 && input.viewMode === 'spatial'
  const topActionableSetup = input.actionableSetups[0] || null
  const enterTradeTarget = input.selectedActionableSetup || topActionableSetup

  const trackCommandAction = useCallback((
    source: SPXCommandSource,
    action: string,
    keyboardKey?: string,
    payload?: Record<string, unknown>,
  ) => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.UX_SHORTCUT_USED, {
      action: source === 'command_palette' ? `command_palette_${action}` : action,
      ...(source === 'keyboard_shortcut' && keyboardKey ? { key: keyboardKey } : {}),
      tradeMode: input.tradeMode,
      selectedSetupId: input.selectedSetup?.id || null,
      ...payload,
    })
  }, [input.selectedSetup?.id, input.tradeMode])

  const commands = useMemo<InternalCommand[]>(() => {
    const next: InternalCommand[] = []

    if (topActionableSetup) {
      next.push({
        id: 'select-top-setup',
        label: `Select top setup (${topActionableSetup.direction} ${topActionableSetup.regime})`,
        keywords: ['setup', 'select', 'top'],
        shortcut: 'J',
        group: 'Setups',
        run: (source, keyboardKey) => {
          input.selectSetup(topActionableSetup)
          trackCommandAction(source, 'select_top_setup', keyboardKey, { setupId: topActionableSetup.id })
        },
      })
    }

    if (input.activeSetups.length > 1) {
      next.push({
        id: 'cycle-next-setup',
        label: 'Cycle to next setup',
        keywords: ['setup', 'cycle', 'next'],
        shortcut: 'J',
        group: 'Setups',
        run: (source, keyboardKey) => {
          const currentIndex = input.selectedSetup
            ? input.activeSetups.findIndex((setup) => setup.id === input.selectedSetup?.id)
            : -1
          const nextIndex = (currentIndex + 1 + input.activeSetups.length) % input.activeSetups.length
          const setup = input.activeSetups[nextIndex]
          if (!setup) return
          input.selectSetup(setup)
          const action = source === 'keyboard_shortcut' ? 'cycle_setup' : 'cycle_next_setup'
          trackCommandAction(source, action, keyboardKey, {
            nextSetupId: setup.id,
            nextStatus: setup.status,
            setupId: setup.id,
          })
        },
      })

      next.push({
        id: 'cycle-prev-setup',
        label: 'Cycle to previous setup',
        keywords: ['setup', 'cycle', 'previous'],
        group: 'Setups',
        showInPalette: false,
        run: (source, keyboardKey) => {
          const currentIndex = input.selectedSetup
            ? input.activeSetups.findIndex((setup) => setup.id === input.selectedSetup?.id)
            : -1
          const baseline = currentIndex >= 0 ? currentIndex : 0
          const nextIndex = (baseline - 1 + input.activeSetups.length) % input.activeSetups.length
          const setup = input.activeSetups[nextIndex]
          if (!setup) return
          input.selectSetup(setup)
          trackCommandAction(source, 'cycle_setup', keyboardKey, {
            nextSetupId: setup.id,
            nextStatus: setup.status,
          })
        },
      })
    }

    next.push({
      id: 'select-current-setup',
      label: 'Select current setup',
      keywords: ['setup', 'select', 'current'],
      group: 'Setups',
      showInPalette: false,
      disabled: !input.selectedSetup,
      run: (source, keyboardKey) => {
        if (!input.selectedSetup) return
        input.selectSetup(input.selectedSetup)
        trackCommandAction(source, 'select_setup', keyboardKey, { setupId: input.selectedSetup.id })
      },
    })

    next.push({
      id: 'deselect-setup',
      label: 'Clear setup selection',
      keywords: ['setup', 'clear', 'deselect'],
      group: 'Setups',
      showInPalette: false,
      run: (source, keyboardKey) => {
        input.selectSetup(null)
        trackCommandAction(source, 'deselect_setup', keyboardKey)
      },
    })

    next.push({
      id: 'enter-trade-focus',
      label: input.enterTradeBlocked
        ? `Enter trade focus (blocked: ${input.enterTradeBlockedReasonLabel || 'risk envelope'})`
        : enterTradeTarget
          ? `Enter trade focus (${enterTradeTarget.direction} ${enterTradeTarget.regime})`
          : 'Enter trade focus',
      keywords: ['enter', 'trade', 'focus', 'execute'],
      shortcut: 'Enter',
      group: 'Execution',
      disabled: input.tradeMode === 'in_trade' || !enterTradeTarget || input.enterTradeBlocked,
      run: (source, keyboardKey) => {
        if (!enterTradeTarget) return
        input.selectSetup(enterTradeTarget)
        input.enterTrade(enterTradeTarget)
        trackCommandAction(source, 'enter_trade_focus', keyboardKey, { setupId: enterTradeTarget.id })
      },
    })

    next.push({
      id: 'exit-trade-focus',
      label: 'Exit trade focus',
      keywords: ['exit', 'close', 'trade', 'focus'],
      shortcut: 'Esc',
      group: 'Execution',
      disabled: input.tradeMode !== 'in_trade',
      run: (source, keyboardKey) => {
        input.exitTrade()
        trackCommandAction(source, 'exit_trade_focus', keyboardKey)
      },
    })

    next.push({
      id: 'toggle-level-overlay',
      label: input.showLevelOverlay ? 'Hide level overlay' : 'Show level overlay',
      keywords: ['level', 'overlay', 'matrix'],
      shortcut: 'L',
      group: 'View',
      run: (source, keyboardKey) => {
        input.setShowLevelOverlay((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_level_overlay', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-flow-panel',
      label: 'Toggle flow expansion',
      keywords: ['flow', 'ticker', 'toggle'],
      shortcut: 'F',
      group: 'View',
      run: (source, keyboardKey) => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.FLOW_TOGGLE))
        trackCommandAction(source, 'toggle_flow_panel', keyboardKey)
      },
    })

    next.push({
      id: 'toggle-immersive',
      label: input.immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode',
      keywords: ['immersive', 'fullscreen', 'hud', 'spatial'],
      shortcut: 'I',
      group: 'View',
      disabled: !spatialOverlayControlsEnabled,
      run: (source, keyboardKey) => {
        if (!spatialOverlayControlsEnabled) return
        input.setImmersiveMode((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_immersive', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-sidebar',
      label: input.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar',
      keywords: ['sidebar', 'panel', 'show', 'hide'],
      shortcut: 'S',
      group: 'View',
      disabled: !spatialOverlayControlsEnabled,
      run: (source, keyboardKey) => {
        if (!spatialOverlayControlsEnabled) return
        input.setSidebarCollapsed((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_sidebar', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-spatial-coach',
      label: input.showSpatialCoach ? 'Disable spatial coach' : 'Enable spatial coach',
      keywords: ['spatial', 'coach', 'anchor', 'nodes'],
      shortcut: 'A',
      group: 'Overlays',
      disabled: !spatialOverlayControlsEnabled,
      run: (source, keyboardKey) => {
        if (!spatialOverlayControlsEnabled) return
        input.setShowSpatialCoach((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_spatial_coach', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-probability-cone',
      label: input.showCone ? 'Hide probability cone' : 'Show probability cone',
      keywords: ['cone', 'probability', 'expected', 'move'],
      shortcut: 'C',
      group: 'Overlays',
      disabled: !spatialOverlayControlsEnabled,
      run: (source, keyboardKey) => {
        if (!spatialOverlayControlsEnabled) return
        input.setShowCone((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_cone', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-gex-glow',
      label: input.showGEXGlow ? 'Disable GEX glow' : 'Enable GEX glow',
      keywords: ['gex', 'ambient', 'glow'],
      shortcut: 'G',
      group: 'Overlays',
      disabled: !spatialOverlayControlsEnabled,
      run: (source, keyboardKey) => {
        if (!spatialOverlayControlsEnabled) return
        input.setShowGEXGlow((previous) => {
          const nextState = !previous
          trackCommandAction(source, 'toggle_gex_glow', keyboardKey, { nextState })
          return nextState
        })
      },
    })

    next.push({
      id: 'toggle-view-mode',
      label: input.viewMode === 'classic' ? 'Switch to spatial HUD view' : 'Switch to classic view',
      keywords: ['view', 'layout', 'spatial', 'classic', 'hud', 'toggle'],
      shortcut: 'V',
      group: 'View',
      disabled: input.isMobile || !input.uxFlagsSpatialHudV1,
      run: (source, keyboardKey) => {
        if (input.isMobile || !input.uxFlagsSpatialHudV1) return
        const nextMode: SPXViewMode = input.viewMode === 'classic' ? 'spatial' : 'classic'
        input.handleViewModeChange(nextMode, source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'toggle_view_mode', keyboardKey, { nextMode })
      },
    })

    next.push({
      id: 'toggle-replay',
      label: input.replayEnabled ? 'Disable replay mode' : 'Enable replay mode',
      keywords: ['replay', 'journal', 'playback'],
      shortcut: 'R',
      group: 'Replay',
      run: (source, keyboardKey) => {
        input.toggleReplay(source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'toggle_replay_mode', keyboardKey, { nextState: !input.replayEnabled })
      },
    })

    next.push({
      id: 'toggle-replay-playback',
      label: input.replayPlaying ? 'Pause replay playback' : 'Start replay playback',
      keywords: ['replay', 'play', 'pause'],
      shortcut: 'P',
      group: 'Replay',
      disabled: !input.replayEnabled,
      run: (source, keyboardKey) => {
        if (!input.replayEnabled) return
        input.toggleReplayPlayback(source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'toggle_replay_playback', keyboardKey, { nextState: !input.replayPlaying })
      },
    })

    next.push({
      id: 'cycle-replay-window',
      label: `Cycle replay window (${input.replayWindowMinutes}m)`,
      keywords: ['replay', 'window', '30m', '60m', '120m'],
      group: 'Replay',
      disabled: !input.replayEnabled,
      run: (source, keyboardKey) => {
        if (!input.replayEnabled) return
        input.cycleReplayWindow(source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'cycle_replay_window', keyboardKey)
      },
    })

    next.push({
      id: 'cycle-replay-speed',
      label: `Cycle replay speed (${input.replaySpeed}x)`,
      keywords: ['replay', 'speed', '1x', '2x', '4x'],
      group: 'Replay',
      disabled: !input.replayEnabled,
      run: (source, keyboardKey) => {
        if (!input.replayEnabled) return
        input.cycleReplaySpeed(source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'cycle_replay_speed', keyboardKey)
      },
    })

    next.push({
      id: 'focus-mode-decision',
      label: 'Focus mode: Decision',
      keywords: ['focus', 'decision', 'mode'],
      group: 'Execution',
      disabled: input.focusMode === 'decision',
      run: (source, keyboardKey) => {
        input.setFocusMode('decision', source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'focus_mode_decision', keyboardKey)
      },
    })

    next.push({
      id: 'focus-mode-execution',
      label: 'Focus mode: Execution',
      keywords: ['focus', 'execution', 'mode'],
      group: 'Execution',
      disabled: input.focusMode === 'execution',
      run: (source, keyboardKey) => {
        input.setFocusMode('execution', source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'focus_mode_execution', keyboardKey)
      },
    })

    next.push({
      id: 'focus-mode-risk-only',
      label: 'Focus mode: Risk',
      keywords: ['focus', 'risk', 'mode'],
      group: 'Execution',
      disabled: input.focusMode === 'risk_only',
      run: (source, keyboardKey) => {
        input.setFocusMode('risk_only', source === 'command_palette' ? 'command' : 'shortcut')
        trackCommandAction(source, 'focus_mode_risk_only', keyboardKey)
      },
    })

    next.push({
      id: 'show-shortcuts-help',
      label: 'Show keyboard shortcuts help',
      keywords: ['keyboard', 'help', 'shortcuts'],
      shortcut: '?',
      group: 'Help',
      run: (source, keyboardKey) => {
        input.setShowShortcutHelp(true)
        trackCommandAction(source, 'shortcut_help_open', keyboardKey)
      },
    })

    next.push({
      id: 'hide-shortcuts-help',
      label: 'Hide keyboard shortcuts help',
      keywords: ['keyboard', 'help', 'shortcuts'],
      group: 'Help',
      showInPalette: false,
      run: (source, keyboardKey) => {
        input.setShowShortcutHelp(false)
        trackCommandAction(source, 'shortcut_help_close', keyboardKey)
      },
    })

    next.push({
      id: 'coach-risk-check',
      label: 'Ask coach: Risk check',
      keywords: ['coach', 'risk', 'quick action'],
      shortcut: '2',
      group: 'Coach',
      run: (source, keyboardKey) => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
          detail: { index: 1, source: source === 'command_palette' ? 'command_palette' : 'keyboard' },
        }))
        trackCommandAction(source, 'coach_risk_check', keyboardKey)
      },
    })

    next.push({
      id: 'coach-exit-strategy',
      label: 'Ask coach: Exit strategy',
      keywords: ['coach', 'exit', 'quick action'],
      shortcut: '3',
      group: 'Coach',
      run: (source, keyboardKey) => {
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
          detail: { index: 2, source: source === 'command_palette' ? 'command_palette' : 'keyboard' },
        }))
        trackCommandAction(source, 'coach_exit_strategy', keyboardKey)
      },
    })

    ;['coach-quick-action-1', 'coach-quick-action-2', 'coach-quick-action-3', 'coach-quick-action-4'].forEach((id, index) => {
      next.push({
        id: id as SPXCommandId,
        label: `Coach quick action ${index + 1}`,
        keywords: ['coach', 'quick action'],
        group: 'Coach',
        showInPalette: false,
        run: (source, keyboardKey) => {
          window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_QUICK_ACTION, {
            detail: { index, source: 'keyboard' },
          }))
          trackCommandAction(source, 'coach_quick_action', keyboardKey, { quickActionIndex: index + 1 })
        },
      })
    })

    return next
  }, [
    enterTradeTarget,
    input,
    spatialOverlayControlsEnabled,
    topActionableSetup,
    trackCommandAction,
  ])

  const commandsById = useMemo(() => {
    return new Map(commands.map((command) => [command.id, command]))
  }, [commands])

  const executeCommand = useCallback((id: SPXCommandId, source: SPXCommandSource, keyboardKey?: string): boolean => {
    const command = commandsById.get(id)
    if (!command) return false

    if (command.disabled) {
      if (id === 'enter-trade-focus' && input.enterTradeBlocked) {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
          surface: source,
          action: 'enter_trade_focus_blocked',
          reason: 'risk_envelope',
          riskEnvelopeReasonCode: input.enterTradeBlockedReasonCode,
          reasonLabel: input.enterTradeBlockedReasonLabel,
          ...(keyboardKey ? { key: keyboardKey } : {}),
        }, { level: 'warning' })
        trackCommandAction(source, 'enter_trade_focus_blocked', keyboardKey, {
          reason: 'risk_envelope',
          riskEnvelopeReasonCode: input.enterTradeBlockedReasonCode,
          reasonLabel: input.enterTradeBlockedReasonLabel,
        })
      }
      if (source === 'keyboard_shortcut') {
        const blocked = SPX_OVERLAY_BLOCKED_META[id]
        if (blocked) {
          trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.OVERLAY_CONTROL_BLOCKED, {
            surface: 'keyboard_shortcut',
            overlay: blocked.overlay,
            reason: 'view_mode_unavailable',
            ...(keyboardKey ? { key: keyboardKey } : {}),
          })
          trackCommandAction(source, blocked.blockedAction, keyboardKey)
        }
      }
      return false
    }

    command.run(source, keyboardKey)
    return true
  }, [
    commandsById,
    input.enterTradeBlocked,
    input.enterTradeBlockedReasonCode,
    input.enterTradeBlockedReasonLabel,
    trackCommandAction,
  ])

  const commandPaletteCommands = useMemo<SPXPaletteCommand[]>(() => {
    if (!input.uxFlagsCommandPalette) return []

    return commands
      .filter((command) => command.showInPalette !== false)
      .map((command) => ({
        id: command.id,
        label: command.label,
        keywords: command.keywords,
        shortcut: command.shortcut,
        group: command.group,
        disabled: command.disabled,
        run: () => {
          void executeCommand(command.id, 'command_palette')
        },
      }))
  }, [commands, executeCommand, input.uxFlagsCommandPalette])

  const runKeyboardShortcut = useCallback((key: string): boolean => {
    const normalizedKey = key.toLowerCase()

    if (normalizedKey === '?') {
      return executeCommand('show-shortcuts-help', 'keyboard_shortcut', normalizedKey)
    }

    if (normalizedKey === 'escape') {
      if (input.showShortcutHelp) {
        return executeCommand('hide-shortcuts-help', 'keyboard_shortcut', normalizedKey)
      }
      if (input.tradeMode === 'in_trade') {
        return executeCommand('exit-trade-focus', 'keyboard_shortcut', normalizedKey)
      }
      return executeCommand('deselect-setup', 'keyboard_shortcut', normalizedKey)
    }

    if (normalizedKey === 'j') {
      return executeCommand('cycle-next-setup', 'keyboard_shortcut', normalizedKey)
    }

    if (normalizedKey === 'k') {
      return executeCommand('cycle-prev-setup', 'keyboard_shortcut', normalizedKey)
    }

    if (normalizedKey === 'enter') {
      if (!input.selectedSetup) return false
      if (input.tradeMode === 'scan' && isActionable(input.selectedSetup)) {
        return executeCommand('enter-trade-focus', 'keyboard_shortcut', normalizedKey)
      }
      return executeCommand('select-current-setup', 'keyboard_shortcut', normalizedKey)
    }

    if (normalizedKey >= '1' && normalizedKey <= '4') {
      return executeCommand(`coach-quick-action-${normalizedKey}` as SPXCommandId, 'keyboard_shortcut', normalizedKey)
    }

    const mapped = SPX_KEYBOARD_COMMAND_BINDINGS[normalizedKey]
    if (!mapped) return false
    return executeCommand(mapped, 'keyboard_shortcut', normalizedKey)
  }, [executeCommand, input.selectedSetup, input.showShortcutHelp, input.tradeMode])

  const runCommandById = useCallback((
    id: SPXCommandId,
    source: SPXCommandSource = 'keyboard_shortcut',
    keyboardKey?: string,
  ): boolean => {
    return executeCommand(id, source, keyboardKey)
  }, [executeCommand])

  return {
    commandPaletteCommands,
    runCommandById,
    runKeyboardShortcut,
  }
}
