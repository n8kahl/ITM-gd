import type { SPXRealtimeEvent } from '@/lib/spx/event-schema'

export interface SPXMarketDataOrchestratorOptions {
  sequenceGapTolerance: number
  heartbeatStaleMs: number
}

export interface SPXMarketDataTrustState {
  sequenceGapDetected: boolean
  heartbeatStale: boolean
  lastEventAtMs: number | null
  lastSequenceByChannel: Record<string, number>
}

const DEFAULT_OPTIONS: SPXMarketDataOrchestratorOptions = {
  sequenceGapTolerance: 0,
  heartbeatStaleMs: 15_000,
}

export function detectSPXSequenceGap(
  previousSequence: number | null,
  nextSequence: number | null,
  tolerance = DEFAULT_OPTIONS.sequenceGapTolerance,
): boolean {
  if (previousSequence == null || nextSequence == null) return false
  return nextSequence > previousSequence + tolerance + 1
}

export class SPXMarketDataOrchestrator {
  private readonly options: SPXMarketDataOrchestratorOptions

  private sequenceGapDetected = false

  private lastEventAtMs: number | null = null

  private readonly lastSequenceByChannel = new Map<string, number>()

  constructor(options?: Partial<SPXMarketDataOrchestratorOptions>) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...(options || {}),
    }
  }

  ingest(event: SPXRealtimeEvent): void {
    if (event.kind === 'unknown') return

    this.lastEventAtMs = event.receivedAtMs

    if (event.sequence == null) return

    const sequenceKey = event.channel || event.kind
    const previousSequence = this.lastSequenceByChannel.get(sequenceKey) ?? null
    if (detectSPXSequenceGap(previousSequence, event.sequence, this.options.sequenceGapTolerance)) {
      this.sequenceGapDetected = true
    }

    if (previousSequence == null || event.sequence >= previousSequence) {
      this.lastSequenceByChannel.set(sequenceKey, event.sequence)
    }
  }

  clearSequenceGap(): void {
    this.sequenceGapDetected = false
  }

  reset(): void {
    this.sequenceGapDetected = false
    this.lastEventAtMs = null
    this.lastSequenceByChannel.clear()
  }

  evaluate(nowMs = Date.now(), streamConnected = false): SPXMarketDataTrustState {
    const heartbeatStale = streamConnected
      && this.lastEventAtMs != null
      && (nowMs - this.lastEventAtMs) > this.options.heartbeatStaleMs

    return {
      sequenceGapDetected: this.sequenceGapDetected,
      heartbeatStale,
      lastEventAtMs: this.lastEventAtMs,
      lastSequenceByChannel: Object.fromEntries(this.lastSequenceByChannel.entries()),
    }
  }
}

export function createSPXMarketDataOrchestrator(
  options?: Partial<SPXMarketDataOrchestratorOptions>,
): SPXMarketDataOrchestrator {
  return new SPXMarketDataOrchestrator(options)
}

export const SPX_MARKET_DATA_ORCHESTRATOR_DEFAULTS = DEFAULT_OPTIONS
