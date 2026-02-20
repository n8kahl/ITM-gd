'use client'

import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
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
}

interface SpatialAnchorMessage {
  message: CoachMessage
  anchorPrice: number
  anchorTimeSec: number | null
}

export function SpatialCoachLayer({ coordinatesRef }: SpatialCoachLayerProps) {
  const { coachMessages } = useSPXCoachContext()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const getCoordinates = useCallback(() => coordinatesRef.current, [coordinatesRef])

  const spatialMessages = useMemo<SpatialAnchorMessage[]>(() => {
    return extractSpatialCoachAnchors(coachMessages, {
      dismissedIds,
      maxNodes: DEFAULT_MAX_SPATIAL_COACH_NODES,
    }).map((anchor) => ({
      ...anchor,
      anchorTimeSec: parseIsoToUnixSeconds(anchor.message.timestamp),
    }))
  }, [coachMessages, dismissedIds])

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
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_ACTION, {
      actionId,
      messageId,
      surface: 'spatial_coach_node',
    })
  }, [])

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
