import {
  formatSPXFeedFallbackReasonCode,
  type SPXFeedFallbackReasonCode,
  type SPXFeedFallbackStage,
} from '@/lib/spx/feed-health'

interface ResolveExecutionEntryGateInput {
  blockTradeEntryByFeedTrust: boolean
  dataHealthMessage: string | null
  feedFallbackReasonCode: SPXFeedFallbackReasonCode
  feedFallbackStage: SPXFeedFallbackStage
  brokerConnected: boolean
  executionMode: 'off' | 'manual' | 'auto'
  brokerErrorMessage: string | null
}

export interface ExecutionEntryGate {
  blocked: boolean
  feedBlocked: boolean
  brokerBlocked: boolean
  message: string | null
}

export function resolveExecutionEntryGate(input: ResolveExecutionEntryGateInput): ExecutionEntryGate {
  const feedBlocked = input.blockTradeEntryByFeedTrust
  const brokerBlocked = !input.brokerConnected || input.executionMode === 'off'
  const blocked = feedBlocked || brokerBlocked

  if (!blocked) {
    return {
      blocked,
      feedBlocked,
      brokerBlocked,
      message: null,
    }
  }

  const message = feedBlocked
    ? (
      input.dataHealthMessage
      || `Feed trust guard active (${formatSPXFeedFallbackReasonCode(input.feedFallbackReasonCode) || input.feedFallbackStage}).`
    )
    : (
      input.brokerErrorMessage
      || (!input.brokerConnected ? 'Broker disconnected.' : 'Broker execution mode is off.')
    )

  return {
    blocked,
    feedBlocked,
    brokerBlocked,
    message,
  }
}
