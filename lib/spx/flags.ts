'use client'

export interface SPXUXFlags {
  oneClickEntry: boolean
  mobileFullTradeFocus: boolean
  keyboardShortcuts: boolean
  layoutStateMachine: boolean
  mobileSmartStack: boolean
  coachProactive: boolean
  contextSplitV1: boolean
  commandPalette: boolean
}

export const DEFAULT_SPX_UX_FLAGS: Readonly<SPXUXFlags> = Object.freeze({
  oneClickEntry: true,
  mobileFullTradeFocus: true,
  keyboardShortcuts: true,
  layoutStateMachine: true,
  mobileSmartStack: true,
  coachProactive: true,
  contextSplitV1: true,
  commandPalette: true,
})

const FLAG_ENV_KEYS: Record<keyof SPXUXFlags, string[]> = {
  oneClickEntry: ['NEXT_PUBLIC_SPX_UX_ONE_CLICK_ENTRY', 'SPX_UX_ONE_CLICK_ENTRY'],
  mobileFullTradeFocus: ['NEXT_PUBLIC_SPX_UX_MOBILE_FULL_TRADE_FOCUS', 'SPX_UX_MOBILE_FULL_TRADE_FOCUS'],
  keyboardShortcuts: ['NEXT_PUBLIC_SPX_UX_KEYBOARD_SHORTCUTS', 'SPX_UX_KEYBOARD_SHORTCUTS'],
  layoutStateMachine: ['NEXT_PUBLIC_SPX_UX_LAYOUT_STATE_MACHINE', 'SPX_UX_LAYOUT_STATE_MACHINE'],
  mobileSmartStack: ['NEXT_PUBLIC_SPX_UX_MOBILE_SMART_STACK', 'SPX_UX_MOBILE_SMART_STACK'],
  coachProactive: ['NEXT_PUBLIC_SPX_UX_COACH_PROACTIVE', 'SPX_UX_COACH_PROACTIVE'],
  contextSplitV1: ['NEXT_PUBLIC_SPX_UX_CONTEXT_SPLIT_V1', 'SPX_UX_CONTEXT_SPLIT_V1'],
  commandPalette: ['NEXT_PUBLIC_SPX_UX_COMMAND_PALETTE', 'SPX_UX_COMMAND_PALETTE'],
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveFlagFromEnv(flag: keyof SPXUXFlags): boolean | null {
  const envKeys = FLAG_ENV_KEYS[flag]
  for (const key of envKeys) {
    const parsed = parseBooleanFlag(process.env[key])
    if (parsed != null) return parsed
  }
  return null
}

function resolveWindowOverrides(): Partial<SPXUXFlags> {
  if (typeof window === 'undefined') return {}
  const candidate = window.__spxUxFlags
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {}
  return candidate
}

export function getSPXUXFlags(overrides?: Partial<SPXUXFlags>): SPXUXFlags {
  const envResolved: SPXUXFlags = {
    oneClickEntry: resolveFlagFromEnv('oneClickEntry') ?? DEFAULT_SPX_UX_FLAGS.oneClickEntry,
    mobileFullTradeFocus: resolveFlagFromEnv('mobileFullTradeFocus') ?? DEFAULT_SPX_UX_FLAGS.mobileFullTradeFocus,
    keyboardShortcuts: resolveFlagFromEnv('keyboardShortcuts') ?? DEFAULT_SPX_UX_FLAGS.keyboardShortcuts,
    layoutStateMachine: resolveFlagFromEnv('layoutStateMachine') ?? DEFAULT_SPX_UX_FLAGS.layoutStateMachine,
    mobileSmartStack: resolveFlagFromEnv('mobileSmartStack') ?? DEFAULT_SPX_UX_FLAGS.mobileSmartStack,
    coachProactive: resolveFlagFromEnv('coachProactive') ?? DEFAULT_SPX_UX_FLAGS.coachProactive,
    contextSplitV1: resolveFlagFromEnv('contextSplitV1') ?? DEFAULT_SPX_UX_FLAGS.contextSplitV1,
    commandPalette: resolveFlagFromEnv('commandPalette') ?? DEFAULT_SPX_UX_FLAGS.commandPalette,
  }

  return {
    ...envResolved,
    ...resolveWindowOverrides(),
    ...(overrides || {}),
  }
}

export function getEnabledSPXUXFlagKeys(flags: SPXUXFlags): Array<keyof SPXUXFlags> {
  return (Object.keys(flags) as Array<keyof SPXUXFlags>).filter((key) => flags[key])
}

declare global {
  interface Window {
    __spxUxFlags?: Partial<SPXUXFlags>
  }
}
