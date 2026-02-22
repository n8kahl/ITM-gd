import type { CoachDecisionAction, CoachDecisionBrief, CoachDecisionVerdict } from '@/lib/types/spx-command-center'

export type CoachDecisionMode = 'scan' | 'evaluate' | 'in_trade'

function normalizeVerdictForMode(
  verdict: CoachDecisionVerdict,
  mode: CoachDecisionMode,
): CoachDecisionVerdict {
  if (mode === 'scan' && verdict === 'ENTER') return 'WAIT'
  if (mode === 'in_trade' && verdict === 'ENTER') return 'WAIT'
  if (mode !== 'in_trade' && verdict === 'EXIT') return 'WAIT'
  return verdict
}

function normalizePrimaryTextForMode(
  primaryText: string,
  verdict: CoachDecisionVerdict,
  normalizedVerdict: CoachDecisionVerdict,
  mode: CoachDecisionMode,
): string {
  if (mode === 'in_trade' && verdict === 'ENTER' && normalizedVerdict === 'WAIT') {
    return 'Trade focus is already active. Manage risk and exits based on current flow and structure.'
  }
  if (mode === 'scan' && verdict === 'ENTER' && normalizedVerdict === 'WAIT') {
    return 'No actionable setup yet. Continue scanning and wait for a confirmed setup.'
  }
  if (mode !== 'in_trade' && verdict === 'EXIT' && normalizedVerdict === 'WAIT') {
    return 'No active trade is open. Wait for confirmation before entering or continue scanning.'
  }
  return primaryText
}

export function normalizeCoachDecisionForMode(
  decision: CoachDecisionBrief | null,
  mode: CoachDecisionMode,
  options?: { scopedSetupId?: string | null },
): CoachDecisionBrief | null {
  if (!decision) return null

  const filteredActions = decision.actions.filter((action) => {
    if (mode === 'in_trade') return action.id !== 'ENTER_TRADE_FOCUS'
    if (mode === 'scan') return action.id !== 'ENTER_TRADE_FOCUS' && action.id !== 'EXIT_TRADE_FOCUS'
    return action.id !== 'EXIT_TRADE_FOCUS'
  })

  const scopedSetupId = options?.scopedSetupId || decision.setupId || null
  const hasExitAction = filteredActions.some((action) => action.id === 'EXIT_TRADE_FOCUS')
  const actions = mode === 'in_trade' && !hasExitAction && scopedSetupId
    ? [
      ...filteredActions,
      {
        id: 'EXIT_TRADE_FOCUS',
        label: 'Exit Trade Focus',
        style: 'secondary',
        payload: { setupId: scopedSetupId },
      } satisfies CoachDecisionAction,
    ]
    : filteredActions

  const normalizedVerdict = normalizeVerdictForMode(decision.verdict, mode)
  const primaryText = normalizePrimaryTextForMode(
    decision.primaryText,
    decision.verdict,
    normalizedVerdict,
    mode,
  )

  const changed = (
    normalizedVerdict !== decision.verdict
    || primaryText !== decision.primaryText
    || actions.length !== decision.actions.length
    || actions.some((action, index) => action !== decision.actions[index])
  )

  if (!changed) return decision

  return {
    ...decision,
    verdict: normalizedVerdict,
    primaryText,
    actions,
  }
}
