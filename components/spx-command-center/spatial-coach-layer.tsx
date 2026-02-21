'use client'

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { useSPXAnalyticsContext } from '@/contexts/spx/SPXAnalyticsContext'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { useSPXPriceContext } from '@/contexts/spx/SPXPriceContext'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { evaluateSPXRiskEnvelopeEntryGate } from '@/lib/spx/risk-envelope'
import { SPX_SHORTCUT_EVENT } from '@/lib/spx/shortcut-events'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { SpatialCoachNode } from '@/components/spx-command-center/spatial-coach-node'
import {
  DEFAULT_MAX_SPATIAL_COACH_NODES,
  extractSpatialCoachAnchors,
  parseIsoToUnixSeconds,
  type SpatialAnchorMode,
} from '@/lib/spx/spatial-hud'

interface SpatialCoachLayerProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
  onRequestSidebarOpen?: () => void
}

interface SpatialAnchorMessage {
  message: CoachMessage
  anchorPrice: number
  anchorTimeSec: number | null
}

const NODE_COLLISION_MIN_GAP_PX = 34
const NODE_REFRESH_INTERVAL_MS = 140

export function SpatialCoachLayer({ coordinatesRef, onRequestSidebarOpen }: SpatialCoachLayerProps) {
  const { blockTradeEntryByFeedTrust, feedFallbackReasonCode } = useSPXAnalyticsContext()
  const { coachMessages } = useSPXCoachContext()
  const { spxPrice } = useSPXPriceContext()
  const { activeSetups, inTradeSetup, selectedSetup, selectSetup, enterTrade, tradeMode } = useSPXSetupContext()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [nodeLayout, setNodeLayout] = useState<Map<string, { yOffsetPx: number; popoverLane: number }>>(new Map())
  const getCoordinates = useCallback(() => coordinatesRef.current, [coordinatesRef])

  const setupById = useMemo(() => {
    return new Map(activeSetups.map((setup) => [setup.id, setup]))
  }, [activeSetups])

  const semanticFallbackAnchor = useCallback((message: CoachMessage): number | null => {
    const payload = message.structuredData
    const reason = payload && typeof payload === 'object' && typeof payload.reason === 'string'
      ? payload.reason
      : null
    const stopPrice = payload
      && typeof payload === 'object'
      && typeof payload.stopPrice === 'number'
      && Number.isFinite(payload.stopPrice)
      ? payload.stopPrice
      : null
    const scopedSetup = (message.setupId ? setupById.get(message.setupId) : null) || inTradeSetup || selectedSetup
    if (reason === 'stop_proximity') {
      if (stopPrice != null) return stopPrice
      if (!scopedSetup) return null
      return Number.isFinite(scopedSetup.stop) ? scopedSetup.stop : null
    }
    if (!scopedSetup) return null
    if (reason === 'status_triggered' || reason === 'flow_divergence') {
      const entryMid = (scopedSetup.entryZone.low + scopedSetup.entryZone.high) / 2
      return Number.isFinite(entryMid) ? entryMid : null
    }
    return null
  }, [inTradeSetup, selectedSetup, setupById])

  const spatialMessages = useMemo<SpatialAnchorMessage[]>(() => {
    return extractSpatialCoachAnchors(coachMessages, {
      dismissedIds,
      maxNodes: DEFAULT_MAX_SPATIAL_COACH_NODES,
      referencePrice: spxPrice,
      fallbackAnchorPrice: semanticFallbackAnchor,
    }).map((anchor) => ({
      ...anchor,
      anchorTimeSec: parseIsoToUnixSeconds(anchor.message.timestamp),
    }))
  }, [coachMessages, dismissedIds, semanticFallbackAnchor, spxPrice])

  useEffect(() => {
    const mapsEqual = (
      left: Map<string, { yOffsetPx: number; popoverLane: number }>,
      right: Map<string, { yOffsetPx: number; popoverLane: number }>,
    ) => {
      if (left.size !== right.size) return false
      for (const [id, leftValue] of left.entries()) {
        const rightValue = right.get(id)
        if (!rightValue) return false
        if (leftValue.yOffsetPx !== rightValue.yOffsetPx || leftValue.popoverLane !== rightValue.popoverLane) {
          return false
        }
      }
      return true
    }

    const computeLayout = () => {
      const coordinates = coordinatesRef.current
      if (!coordinates?.ready) {
        setNodeLayout((previous) => (previous.size === 0 ? previous : new Map()))
        return
      }
      const sortable = spatialMessages
        .map((item) => ({
          id: item.message.id,
          y: coordinates.priceToPixel(item.anchorPrice),
        }))
        .filter((item): item is { id: string; y: number } => item.y != null && Number.isFinite(item.y))
        .sort((left, right) => left.y - right.y)

      const next = new Map<string, { yOffsetPx: number; popoverLane: number }>()
      let lane = 0
      let previousY = -Infinity
      for (const item of sortable) {
        let adjustedY = item.y
        if (adjustedY < previousY + NODE_COLLISION_MIN_GAP_PX) {
          adjustedY = previousY + NODE_COLLISION_MIN_GAP_PX
        }
        if (adjustedY > coordinates.chartDimensions.height - 52) {
          adjustedY = coordinates.chartDimensions.height - 52
        }
        next.set(item.id, {
          yOffsetPx: adjustedY - item.y,
          popoverLane: lane,
        })
        previousY = adjustedY
        lane += 1
      }

      setNodeLayout((previous) => (mapsEqual(previous, next) ? previous : next))
    }

    let rafId = 0
    const schedule = () => {
      rafId = window.requestAnimationFrame(computeLayout)
    }
    schedule()
    const intervalId = window.setInterval(schedule, NODE_REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(intervalId)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [coordinatesRef, spatialMessages])

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((previous) => {
      const next = new Set(previous)
      next.add(id)
      return next
    })
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_DISMISSED, {
      surface: 'spatial_coach_node',
      messageId: id,
    })
  }, [])

  const handleAction = useCallback((actionId: string, messageId: string) => {
    const sourceMessage = coachMessages.find((message) => message.id === messageId) || null
    const targetSetup = (sourceMessage?.setupId ? setupById.get(sourceMessage.setupId) : null)
      || inTradeSetup
      || selectedSetup
      || activeSetups[0]
      || null

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_ACTION, {
      actionId,
      messageId,
      setupId: targetSetup?.id || sourceMessage?.setupId || null,
      surface: 'spatial_coach_node',
    })

    if (actionId === 'stage_trade') {
      if (!targetSetup) {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
          surface: 'spatial_coach_node',
          action: 'stage_trade_blocked',
          reason: 'no_setup_context',
          messageId,
        }, { level: 'warning' })
        return
      }

      const entryGate = evaluateSPXRiskEnvelopeEntryGate({
        setup: targetSetup,
        feedTrustBlocked: blockTradeEntryByFeedTrust,
      })
      if (tradeMode !== 'in_trade' && !entryGate.allowEntry) {
        trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
          surface: 'spatial_coach_node',
          action: 'stage_trade_blocked',
          reason: 'risk_envelope',
          messageId,
          setupId: targetSetup.id,
          riskEnvelopeReasonCode: entryGate.reasonCode,
          feedFallbackReasonCode,
        }, { level: 'warning' })
        onRequestSidebarOpen?.()
        window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_OPEN_DETAILS, {
          detail: {
            messageId,
            setupId: targetSetup.id,
            source: 'spatial_node',
          },
        }))
        return
      }

      selectSetup(targetSetup)
      if (tradeMode !== 'in_trade') {
        enterTrade(targetSetup)
      }
      onRequestSidebarOpen?.()
      return
    }

    if (actionId === 'details') {
      onRequestSidebarOpen?.()
      window.dispatchEvent(new CustomEvent(SPX_SHORTCUT_EVENT.COACH_OPEN_DETAILS, {
        detail: {
          messageId,
          setupId: targetSetup?.id || sourceMessage?.setupId || null,
          source: 'spatial_node',
        },
      }))
    }
  }, [
    activeSetups,
    blockTradeEntryByFeedTrust,
    coachMessages,
    enterTrade,
    feedFallbackReasonCode,
    inTradeSetup,
    onRequestSidebarOpen,
    selectSetup,
    selectedSetup,
    setupById,
    tradeMode,
  ])

  const handleExpand = useCallback((messageId: string, expanded: boolean, anchorMode: 'time' | 'fallback') => {
    if (!expanded) return
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_EXPANDED, {
      messageId,
      surface: 'spatial_coach_node',
      anchorMode,
    })
  }, [])

  const handleAnchorModeChange = useCallback((messageId: string, anchorMode: SpatialAnchorMode) => {
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_ANCHOR_MODE, {
      messageId,
      anchorMode,
      surface: 'spatial_coach_node',
    })
    if (anchorMode === 'fallback') {
      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_FALLBACK_ANCHOR_USED, {
        messageId,
        surface: 'spatial_coach_node',
        reason: 'time_coordinate_unavailable',
      })
    }
  }, [])

  return (
    <>
      {spatialMessages.map(({ message, anchorPrice, anchorTimeSec }, index) => (
        <SpatialCoachNode
          key={message.id}
          message={message}
          anchorPrice={anchorPrice}
          anchorTimeSec={anchorTimeSec}
          fallbackIndex={index}
          yOffsetPx={nodeLayout.get(message.id)?.yOffsetPx || 0}
          popoverLane={nodeLayout.get(message.id)?.popoverLane || 0}
          getCoordinates={getCoordinates}
          onDismiss={handleDismiss}
          onAction={handleAction}
          onExpand={handleExpand}
          onAnchorModeChange={handleAnchorModeChange}
        />
      ))}
    </>
  )
}
