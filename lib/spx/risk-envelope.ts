import type { Setup } from '@/lib/types/spx-command-center'

export type SPXRiskEnvelopeReasonCode =
  | 'allow'
  | 'no_setup'
  | 'setup_not_actionable'
  | 'feed_trust_blocked'
  | 'entry_zone_too_wide'
  | 'stop_distance_too_wide'
  | 'low_confluence'
  | 'low_alignment'
  | 'low_confidence'

export interface SPXRiskEnvelopeGateInput {
  setup: Setup | null
  feedTrustBlocked: boolean
  maxEntryZoneWidthPoints?: number
  maxStopDistancePoints?: number
  minConfluenceScore?: number
  minAlignmentScore?: number
  minConfidencePercent?: number
}

export interface SPXRiskEnvelopeGateOutput {
  allowEntry: boolean
  reasonCode: SPXRiskEnvelopeReasonCode
  metrics: {
    entryZoneWidthPoints: number | null
    stopDistancePoints: number | null
    confluenceScore: number | null
    alignmentScore: number | null
    confidencePercent: number | null
  }
}

export const SPX_RISK_ENVELOPE_DEFAULTS = {
  maxEntryZoneWidthPoints: 8,
  maxStopDistancePoints: 18,
  minConfluenceScore: 3,
  minAlignmentScore: 0,
  minConfidencePercent: 0,
}

function isActionableStatus(status: Setup['status']): boolean {
  return status === 'ready' || status === 'triggered'
}

export function formatSPXRiskEnvelopeReason(reasonCode: SPXRiskEnvelopeReasonCode): string {
  switch (reasonCode) {
    case 'no_setup':
      return 'No setup selected'
    case 'setup_not_actionable':
      return 'Setup not actionable'
    case 'feed_trust_blocked':
      return 'Feed trust blocked'
    case 'entry_zone_too_wide':
      return 'Entry zone too wide'
    case 'stop_distance_too_wide':
      return 'Stop distance too wide'
    case 'low_confluence':
      return 'Confluence below floor'
    case 'low_alignment':
      return 'Alignment below floor'
    case 'low_confidence':
      return 'Confidence below floor'
    default:
      return 'Allowed'
  }
}

export function evaluateSPXRiskEnvelopeEntryGate(
  input: SPXRiskEnvelopeGateInput,
): SPXRiskEnvelopeGateOutput {
  const maxEntryZoneWidthPoints = input.maxEntryZoneWidthPoints ?? SPX_RISK_ENVELOPE_DEFAULTS.maxEntryZoneWidthPoints
  const maxStopDistancePoints = input.maxStopDistancePoints ?? SPX_RISK_ENVELOPE_DEFAULTS.maxStopDistancePoints
  const minConfluenceScore = input.minConfluenceScore ?? SPX_RISK_ENVELOPE_DEFAULTS.minConfluenceScore
  const minAlignmentScore = input.minAlignmentScore ?? SPX_RISK_ENVELOPE_DEFAULTS.minAlignmentScore
  const minConfidencePercent = input.minConfidencePercent ?? SPX_RISK_ENVELOPE_DEFAULTS.minConfidencePercent

  const setup = input.setup
  const entryZoneWidthPoints = setup ? Math.max(setup.entryZone.high - setup.entryZone.low, 0) : null
  const entryMid = setup ? (setup.entryZone.low + setup.entryZone.high) / 2 : null
  const stopDistancePoints = setup && entryMid != null ? Math.abs(entryMid - setup.stop) : null
  const alignmentScore = setup?.alignmentScore ?? null
  const confidencePercent = typeof setup?.pWinCalibrated === 'number'
    ? setup.pWinCalibrated * 100
    : setup?.probability ?? null

  const metrics = {
    entryZoneWidthPoints,
    stopDistancePoints,
    confluenceScore: setup?.confluenceScore ?? null,
    alignmentScore,
    confidencePercent,
  }

  if (!setup) {
    return { allowEntry: false, reasonCode: 'no_setup', metrics }
  }
  if (!isActionableStatus(setup.status)) {
    return { allowEntry: false, reasonCode: 'setup_not_actionable', metrics }
  }
  if (input.feedTrustBlocked) {
    return { allowEntry: false, reasonCode: 'feed_trust_blocked', metrics }
  }
  if (entryZoneWidthPoints != null && entryZoneWidthPoints > maxEntryZoneWidthPoints) {
    return { allowEntry: false, reasonCode: 'entry_zone_too_wide', metrics }
  }
  if (stopDistancePoints != null && stopDistancePoints > maxStopDistancePoints) {
    return { allowEntry: false, reasonCode: 'stop_distance_too_wide', metrics }
  }
  if (setup.confluenceScore < minConfluenceScore) {
    return { allowEntry: false, reasonCode: 'low_confluence', metrics }
  }
  if (minAlignmentScore > 0 && alignmentScore != null && alignmentScore < minAlignmentScore) {
    return { allowEntry: false, reasonCode: 'low_alignment', metrics }
  }
  if (minConfidencePercent > 0 && confidencePercent != null && confidencePercent < minConfidencePercent) {
    return { allowEntry: false, reasonCode: 'low_confidence', metrics }
  }

  return { allowEntry: true, reasonCode: 'allow', metrics }
}
