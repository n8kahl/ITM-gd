export type SPXFeedHealth = 'healthy' | 'degraded' | 'stale'
export type SPXPriceFeedSource = 'tick' | 'poll' | 'snapshot' | null
export type SPXFeedFallbackStage = 'live_stream' | 'poll_fallback' | 'snapshot_fallback' | 'last_known_good'
export type SPXFeedFallbackReasonCode =
  | 'none'
  | 'snapshot_degraded'
  | 'snapshot_error'
  | 'snapshot_request_late'
  | 'sequence_gap_detected'
  | 'heartbeat_stale'
  | 'tick_source_stale'
  | 'poll_source_stale'
  | 'snapshot_source_stale'
  | 'poll_fallback_active'
  | 'snapshot_fallback_active'
  | 'stream_disconnected_snapshot'

export interface ResolveSPXFeedHealthInput {
  snapshotIsDegraded: boolean
  snapshotDegradedMessage?: string | null
  errorMessage?: string | null
  snapshotRequestLate: boolean
  snapshotAvailable: boolean
  streamConnected: boolean
  spxPriceSource: SPXPriceFeedSource
  spxPriceAgeMs: number | null
  sequenceGapDetected?: boolean
  heartbeatStale?: boolean
  tickFreshnessStaleMs?: number
  pollFreshnessStaleMs?: number
  snapshotFreshnessStaleMs?: number
}

export interface ResolveSPXFeedHealthResult {
  dataHealth: SPXFeedHealth
  dataHealthMessage: string | null
  fallbackPolicy: {
    stage: SPXFeedFallbackStage
    reasonCode: SPXFeedFallbackReasonCode
    blockTradeEntry: boolean
  }
  flags: {
    tickSourceStale: boolean
    pollSourceStale: boolean
    snapshotSourceStale: boolean
    usingPollFallback: boolean
    usingSnapshotFallback: boolean
    sequenceGapDetected: boolean
    heartbeatStale: boolean
  }
}

export const SPX_FEED_HEALTH_DEFAULTS = {
  tickFreshnessStaleMs: 7_500,
  pollFreshnessStaleMs: 90_000,
  snapshotFreshnessStaleMs: 300_000,
}

const BLOCK_TRADE_ENTRY_REASON_CODES: ReadonlySet<SPXFeedFallbackReasonCode> = new Set([
  'snapshot_degraded',
  'snapshot_error',
  'snapshot_request_late',
  'sequence_gap_detected',
  'heartbeat_stale',
  'tick_source_stale',
  'poll_source_stale',
  'snapshot_source_stale',
])

function ageSeconds(ageMs: number | null): string | null {
  if (ageMs == null || !Number.isFinite(ageMs)) return null
  return `${Math.floor(ageMs / 1000)}s`
}

export function doesSPXFeedReasonBlockTradeEntry(reasonCode: SPXFeedFallbackReasonCode): boolean {
  return BLOCK_TRADE_ENTRY_REASON_CODES.has(reasonCode)
}

export function formatSPXFeedFallbackReasonCode(reasonCode: SPXFeedFallbackReasonCode): string | null {
  switch (reasonCode) {
    case 'snapshot_degraded':
      return 'Snapshot degraded'
    case 'snapshot_error':
      return 'Snapshot error'
    case 'snapshot_request_late':
      return 'Snapshot delayed'
    case 'sequence_gap_detected':
      return 'Sequence gap'
    case 'heartbeat_stale':
      return 'Heartbeat stale'
    case 'tick_source_stale':
      return 'Tick lag'
    case 'poll_source_stale':
      return 'Poll stale'
    case 'snapshot_source_stale':
      return 'Snapshot stale'
    case 'poll_fallback_active':
      return 'Poll fallback'
    case 'snapshot_fallback_active':
      return 'Snapshot fallback'
    case 'stream_disconnected_snapshot':
      return 'Last known good'
    default:
      return null
  }
}

export function formatSPXFeedFallbackStage(stage: SPXFeedFallbackStage): string {
  switch (stage) {
    case 'poll_fallback':
      return 'Poll'
    case 'snapshot_fallback':
      return 'Snapshot'
    case 'last_known_good':
      return 'Cache'
    default:
      return 'Live'
  }
}

export function resolveSPXFeedHealth(
  input: ResolveSPXFeedHealthInput,
): ResolveSPXFeedHealthResult {
  const tickFreshnessStaleMs = input.tickFreshnessStaleMs ?? SPX_FEED_HEALTH_DEFAULTS.tickFreshnessStaleMs
  const pollFreshnessStaleMs = input.pollFreshnessStaleMs ?? SPX_FEED_HEALTH_DEFAULTS.pollFreshnessStaleMs
  const snapshotFreshnessStaleMs = input.snapshotFreshnessStaleMs ?? SPX_FEED_HEALTH_DEFAULTS.snapshotFreshnessStaleMs
  const sequenceGapDetected = Boolean(input.sequenceGapDetected)
  const heartbeatStale = Boolean(input.heartbeatStale)

  const tickSourceStale = input.spxPriceSource === 'tick'
    && input.spxPriceAgeMs != null
    && input.spxPriceAgeMs > tickFreshnessStaleMs
  const pollSourceStale = input.spxPriceSource === 'poll'
    && input.spxPriceAgeMs != null
    && input.spxPriceAgeMs > pollFreshnessStaleMs
  const snapshotSourceStale = input.spxPriceSource === 'snapshot'
    && input.spxPriceAgeMs != null
    && input.spxPriceAgeMs > snapshotFreshnessStaleMs

  let dataHealth: SPXFeedHealth
  if (input.snapshotIsDegraded || Boolean(input.errorMessage) || input.snapshotRequestLate) {
    dataHealth = 'degraded'
  } else if (
    sequenceGapDetected
    || heartbeatStale
    || (
      input.streamConnected
      && (
        input.spxPriceSource === 'poll'
        || input.spxPriceSource === 'snapshot'
        || tickSourceStale
        || pollSourceStale
        || snapshotSourceStale
      )
    )
    || (!input.streamConnected && input.snapshotAvailable)
  ) {
    dataHealth = 'stale'
  } else {
    dataHealth = 'healthy'
  }

  const fallbackStage: SPXFeedFallbackStage = !input.streamConnected && input.snapshotAvailable
    ? 'last_known_good'
    : input.spxPriceSource === 'poll'
      ? 'poll_fallback'
      : input.spxPriceSource === 'snapshot'
        ? 'snapshot_fallback'
        : 'live_stream'

  let fallbackReasonCode: SPXFeedFallbackReasonCode = 'none'
  if (input.snapshotIsDegraded) {
    fallbackReasonCode = 'snapshot_degraded'
  } else if (input.errorMessage) {
    fallbackReasonCode = 'snapshot_error'
  } else if (input.snapshotRequestLate && !input.snapshotAvailable) {
    fallbackReasonCode = 'snapshot_request_late'
  } else if (sequenceGapDetected) {
    fallbackReasonCode = 'sequence_gap_detected'
  } else if (heartbeatStale) {
    fallbackReasonCode = 'heartbeat_stale'
  } else if (tickSourceStale) {
    fallbackReasonCode = 'tick_source_stale'
  } else if (pollSourceStale) {
    fallbackReasonCode = 'poll_source_stale'
  } else if (snapshotSourceStale) {
    fallbackReasonCode = 'snapshot_source_stale'
  } else if (input.spxPriceSource === 'poll' && input.streamConnected) {
    fallbackReasonCode = 'poll_fallback_active'
  } else if (input.spxPriceSource === 'snapshot' && input.streamConnected) {
    fallbackReasonCode = 'snapshot_fallback_active'
  } else if (dataHealth === 'stale') {
    fallbackReasonCode = 'stream_disconnected_snapshot'
  }

  let dataHealthMessage: string | null = null
  switch (fallbackReasonCode) {
    case 'snapshot_degraded':
      dataHealthMessage = input.snapshotDegradedMessage || 'SPX service is running in degraded mode.'
      break
    case 'snapshot_error':
      dataHealthMessage = input.errorMessage || 'SPX snapshot request failed. Using fallback cache while retrying.'
      break
    case 'snapshot_request_late':
      dataHealthMessage = 'SPX snapshot request is delayed. Core chart stream is still active while analytics recover.'
      break
    case 'sequence_gap_detected':
      dataHealthMessage = 'Realtime sequence gap detected. Holding conservative feed trust until packet order recovers.'
      break
    case 'heartbeat_stale':
      dataHealthMessage = 'Realtime heartbeat stalled. Waiting for fresh packets while preserving last known state.'
      break
    case 'tick_source_stale':
      dataHealthMessage = `Tick stream lag detected (${ageSeconds(input.spxPriceAgeMs) || 'unknown'} behind). Falling back to last known price until feed recovers.`
      break
    case 'poll_source_stale':
      dataHealthMessage = 'Poll fallback data is stale. Waiting for fresher provider bars or tick feed recovery.'
      break
    case 'snapshot_source_stale':
      dataHealthMessage = 'Snapshot fallback data is stale. Waiting for fresher provider bars or tick feed recovery.'
      break
    case 'poll_fallback_active':
      dataHealthMessage = 'Live tick feed unavailable. Streaming over poll fallback, so chart and price updates may lag.'
      break
    case 'snapshot_fallback_active':
      dataHealthMessage = 'WebSocket connected but no live price packets received yet. Running on snapshot fallback.'
      break
    case 'stream_disconnected_snapshot':
      dataHealthMessage = 'Live stream disconnected and snapshot is stale. Reconnecting in background.'
      break
    default:
      dataHealthMessage = null
  }

  return {
    dataHealth,
    dataHealthMessage,
    fallbackPolicy: {
      stage: fallbackStage,
      reasonCode: fallbackReasonCode,
      blockTradeEntry: doesSPXFeedReasonBlockTradeEntry(fallbackReasonCode),
    },
    flags: {
      tickSourceStale,
      pollSourceStale,
      snapshotSourceStale,
      usingPollFallback: input.spxPriceSource === 'poll',
      usingSnapshotFallback: input.spxPriceSource === 'snapshot',
      sequenceGapDetected,
      heartbeatStale,
    },
  }
}
