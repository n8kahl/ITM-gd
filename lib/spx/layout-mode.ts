import type { Setup, SetupStatus } from '@/lib/types/spx-command-center'

export type SPXLayoutMode = 'legacy' | 'scan' | 'evaluate' | 'in_trade'

interface ResolveSPXLayoutModeInput {
  enabled: boolean
  tradeMode: 'scan' | 'in_trade'
  selectedSetup: Setup | null
}

const EVALUATION_STATUSES: ReadonlySet<SetupStatus> = new Set(['ready', 'triggered'])

export function resolveSPXLayoutMode(input: ResolveSPXLayoutModeInput): SPXLayoutMode {
  if (!input.enabled) return 'legacy'
  if (input.tradeMode === 'in_trade') return 'in_trade'
  if (input.selectedSetup && EVALUATION_STATUSES.has(input.selectedSetup.status)) {
    return 'evaluate'
  }
  return 'scan'
}
