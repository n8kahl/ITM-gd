import type { CoachDecisionBrief, Setup } from '@/lib/types/spx-command-center'

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const line of lines) {
    const normalized = line.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    next.push(normalized)
  }
  return next
}

function buildDefaultInvalidation(setup: Setup): string {
  if (setup.direction === 'bullish') {
    return `Invalid if price loses ${setup.stop.toFixed(1)} with confirmation.`
  }
  return `Invalid if price reclaims ${setup.stop.toFixed(1)} with confirmation.`
}

export function enrichCoachDecisionExplainability(
  decision: CoachDecisionBrief,
  setup: Setup | null,
  nowMs = Date.now(),
): CoachDecisionBrief {
  if (!setup) return decision

  const drivers = (setup.decisionDrivers || []).slice(0, 3).map((line) => `Driver: ${line}`)
  const risks = (setup.decisionRisks || []).slice(0, 3).map((line) => `Risk: ${line}`)
  const setupTimestamp = setup.statusUpdatedAt || setup.triggeredAt || setup.createdAt
  const setupAgeMs = Math.max(nowMs - toEpoch(setupTimestamp), 0)
  const freshnessLine = setupAgeMs > 0 ? `Freshness: ${Math.floor(setupAgeMs / 1000)}s since setup update.` : null

  const why = uniqueLines([
    ...decision.why,
    ...drivers,
    ...risks,
    ...(freshnessLine ? [freshnessLine] : []),
  ]).slice(0, 6)

  const nextRiskPlan = {
    ...decision.riskPlan,
    stop: typeof decision.riskPlan?.stop === 'number' ? decision.riskPlan.stop : setup.stop,
    invalidation: decision.riskPlan?.invalidation || buildDefaultInvalidation(setup),
    positionGuidance: decision.riskPlan?.positionGuidance || (setup.decisionRisks?.[0] ?? undefined),
  }

  const whyChanged = why.length !== decision.why.length || why.some((line, index) => line !== decision.why[index])
  const riskPlanChanged = (
    nextRiskPlan.stop !== decision.riskPlan?.stop
    || nextRiskPlan.invalidation !== decision.riskPlan?.invalidation
    || nextRiskPlan.positionGuidance !== decision.riskPlan?.positionGuidance
  )
  if (!whyChanged && !riskPlanChanged) return decision

  return {
    ...decision,
    why,
    riskPlan: nextRiskPlan,
  }
}
