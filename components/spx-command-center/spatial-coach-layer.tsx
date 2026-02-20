'use client'

import { useCallback, useMemo, useState, type RefObject } from 'react'
import { useSPXCoachContext } from '@/contexts/spx/SPXCoachContext'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'
import type { CoachMessage } from '@/lib/types/spx-command-center'
import type { ChartCoordinateAPI } from '@/hooks/use-chart-coordinates'
import { SpatialCoachNode } from '@/components/spx-command-center/spatial-coach-node'

const MAX_SPATIAL_NODES = 5
const PRICE_PATTERN = /\b(5[5-9]\d{2}|6[0-2]\d{2})\b/

interface SpatialCoachLayerProps {
  coordinatesRef: RefObject<ChartCoordinateAPI>
}

interface SpatialAnchorMessage {
  message: CoachMessage
  anchorPrice: number
}

export function SpatialCoachLayer({ coordinatesRef }: SpatialCoachLayerProps) {
  const { coachMessages } = useSPXCoachContext()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const getCoordinates = useCallback(() => coordinatesRef.current, [coordinatesRef])

  const spatialMessages = useMemo<SpatialAnchorMessage[]>(() => {
    const sorted = [...coachMessages].sort(
      (left, right) => (Date.parse(right.timestamp || '') || 0) - (Date.parse(left.timestamp || '') || 0),
    )
    const anchored: SpatialAnchorMessage[] = []

    for (const message of sorted) {
      if (dismissedIds.has(message.id)) continue
      const match = message.content.match(PRICE_PATTERN)
      if (!match) continue
      const anchorPrice = Number.parseFloat(match[0])
      if (!Number.isFinite(anchorPrice)) continue
      anchored.push({ message, anchorPrice })
      if (anchored.length >= MAX_SPATIAL_NODES) break
    }

    return anchored
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

  const handleExpand = useCallback((messageId: string, expanded: boolean) => {
    if (!expanded) return
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.SPATIAL_NODE_EXPANDED, {
      messageId,
      surface: 'spatial_coach_node',
    })
  }, [])

  return (
    <>
      {spatialMessages.map(({ message, anchorPrice }) => (
        <SpatialCoachNode
          key={message.id}
          message={message}
          anchorPrice={anchorPrice}
          getCoordinates={getCoordinates}
          onDismiss={handleDismiss}
          onAction={handleAction}
          onExpand={handleExpand}
        />
      ))}
    </>
  )
}
