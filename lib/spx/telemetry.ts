'use client'

import * as Sentry from '@sentry/nextjs'
import { trackEvent } from '@/lib/analytics'

export const SPX_TELEMETRY_EVENT = {
  HEADER_ACTION_CLICK: 'spx_header_action_click',
  SETUP_SELECTED: 'spx_setup_selected',
  CONTRACT_REQUESTED: 'spx_contract_requested',
  CONTRACT_RESULT: 'spx_contract_result',
  COACH_ALERT_ACK: 'spx_coach_alert_ack',
  COACH_ALERT_SEEN: 'spx_coach_alert_seen',
  COACH_ALERT_SNOOZED: 'spx_coach_alert_snoozed',
  COACH_ALERT_MUTED: 'spx_coach_alert_muted',
  COACH_DOCK_OPENED: 'spx_coach_dock_opened',
  COACH_DOCK_COLLAPSED: 'spx_coach_dock_collapsed',
  COACH_TIMELINE_JUMP_LATEST: 'spx_coach_timeline_jump_latest',
  COACH_MESSAGE_ACTION_CLICKED: 'spx_coach_message_action_clicked',
  COACH_DECISION_GENERATED: 'spx_coach_decision_generated',
  COACH_DECISION_FALLBACK_USED: 'spx_coach_decision_fallback_used',
  COACH_VERDICT_RENDERED: 'spx_coach_verdict_rendered',
  COACH_PRIMARY_ACTION_CLICKED: 'spx_coach_primary_action_clicked',
  COACH_SECONDARY_ACTION_CLICKED: 'spx_coach_secondary_action_clicked',
  COACH_HISTORY_OPENED: 'spx_coach_history_opened',
  COACH_NO_CHANGE_SUPPRESSED: 'spx_coach_no_change_suppressed',
  COACH_FEEDBACK_SUBMITTED: 'spx_coach_feedback_submitted',
  COACH_MESSAGE_SENT: 'spx_coach_message_sent',
  FLOW_MODE_TOGGLED: 'spx_flow_mode_toggled',
  LEVEL_MAP_INTERACTION: 'spx_level_map_interaction',
  CHART_LEVEL_SET_CHANGED: 'spx_chart_level_set_changed',
  CHART_PRICE_COMMIT: 'spx_chart_price_commit',
  PAGE_VIEW: 'spx_page_view',
  PERF_MEASURED: 'spx_perf_measured',
  FIRST_ACTIONABLE_RENDER: 'spx_first_actionable_render',
  FIRST_SETUP_SELECT: 'spx_first_setup_select',
  DATA_HEALTH_CHANGED: 'spx_data_health_changed',
  SETUP_TRANSITION_RECEIVED: 'spx_setup_transition_received',
  SETUP_INVALIDATED: 'spx_setup_invalidated',
  UX_FLAGS_EVALUATED: 'spx_ux_flags_evaluated',
  UX_SHORTCUT_USED: 'spx_ux_shortcut_used',
  UX_ONE_CLICK_ENTRY: 'spx_ux_one_click_entry',
  UX_LAYOUT_MODE_CHANGED: 'spx_ux_layout_mode_changed',
  UX_VIEW_MODE_CHANGED: 'spx_ux_view_mode_changed',
  UX_MOBILE_FOCUS_CHANGED: 'spx_ux_mobile_focus_changed',
  SPATIAL_OVERLAY_TOGGLED: 'spx_spatial_overlay_toggled',
  SPATIAL_NODE_EXPANDED: 'spx_spatial_node_expanded',
  SPATIAL_NODE_DISMISSED: 'spx_spatial_node_dismissed',
  SPATIAL_NODE_ACTION: 'spx_spatial_node_action',
  IMMERSIVE_MODE_TOGGLED: 'spx_immersive_mode_toggled',
  SIDEBAR_TOGGLED: 'spx_sidebar_toggled',
  CONE_INTERACTION: 'spx_cone_interaction',
  GEX_GLOW_TOGGLED: 'spx_gex_glow_toggled',
  RR_SHADOW_RENDERED: 'spx_rr_shadow_rendered',
  SPATIAL_GHOST_INTERACTION: 'spx_spatial_ghost_interaction',
  SPATIAL_GHOST_STATE_CHANGED: 'spx_spatial_ghost_state_changed',
  SPATIAL_GHOST_ANCHOR_MODE: 'spx_spatial_ghost_anchor_mode',
  SETUP_LOCK_STATE_CHANGED: 'spx_setup_lock_state_changed',
  SETUP_LOCK_PULSE_PLAYED: 'spx_setup_lock_pulse_played',
} as const

export type SPXTelemetryEventName = (typeof SPX_TELEMETRY_EVENT)[keyof typeof SPX_TELEMETRY_EVENT]

type TelemetryLevel = 'info' | 'warning' | 'error'

interface TrackOptions {
  level?: TelemetryLevel
  persist?: boolean
}

interface SPXTelemetryRecord {
  event: SPXTelemetryEventName
  payload: Record<string, unknown>
  level: TelemetryLevel
  timestamp: string
  route: string
}

const CLIENT_EVENT_BUFFER_MAX = 300
const PERF_PREFIX = 'spx.command_center'
let perfCounter = 0

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function normalizePayload(payload?: Record<string, unknown>): Record<string, unknown> {
  return payload ? { ...payload } : {}
}

function trimValue(value: string, max = 220): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function serializePayload(payload: Record<string, unknown>): string {
  try {
    return trimValue(JSON.stringify(payload))
  } catch {
    return '[unserializable-payload]'
  }
}

function pushClientBuffer(record: SPXTelemetryRecord): void {
  if (!isClient()) return

  const current = window.__spxCommandCenterTelemetry || []
  const next = current.length >= CLIENT_EVENT_BUFFER_MAX
    ? [...current.slice(current.length - CLIENT_EVENT_BUFFER_MAX + 1), record]
    : [...current, record]

  window.__spxCommandCenterTelemetry = next

  window.dispatchEvent(new CustomEvent('spx:telemetry', { detail: record }))
}

function mark(name: string): void {
  if (!isClient() || typeof performance === 'undefined') return
  try {
    performance.mark(name)
  } catch {
    // Ignore browser performance API failures.
  }
}

function measure(measureName: string, startMark: string, endMark: string): number | null {
  if (!isClient() || typeof performance === 'undefined') return null

  try {
    performance.measure(measureName, startMark, endMark)
    const entries = performance.getEntriesByName(measureName, 'measure')
    const last = entries[entries.length - 1]
    const durationMs = typeof last?.duration === 'number' ? Math.round(last.duration) : null
    performance.clearMeasures(measureName)
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    return durationMs
  } catch {
    return null
  }
}

export function trackSPXTelemetryEvent(
  event: SPXTelemetryEventName,
  payload?: Record<string, unknown>,
  options?: TrackOptions,
): void {
  const level = options?.level || 'info'
  const normalizedPayload = normalizePayload(payload)

  const record: SPXTelemetryRecord = {
    event,
    payload: normalizedPayload,
    level,
    timestamp: new Date().toISOString(),
    route: isClient() ? window.location.pathname : '',
  }

  pushClientBuffer(record)

  Sentry.addBreadcrumb({
    category: 'spx.command-center',
    level,
    message: event,
    data: normalizedPayload,
  })

  if (options?.persist && isClient()) {
    void trackEvent('spx_command_center', `${event}:${serializePayload(normalizedPayload)}`)
  }
}

export function startSPXPerfTimer(metricName: string) {
  const timerId = `${metricName}.${Date.now()}.${perfCounter++}`
  const startMark = `${PERF_PREFIX}.${timerId}.start`
  mark(startMark)

  return (payload?: Record<string, unknown>) => {
    const endMark = `${PERF_PREFIX}.${timerId}.end`
    const measureName = `${PERF_PREFIX}.${metricName}`
    mark(endMark)
    const durationMs = measure(measureName, startMark, endMark)

    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.PERF_MEASURED, {
      metricName,
      durationMs,
      ...normalizePayload(payload),
    })

    return durationMs
  }
}

declare global {
  interface Window {
    __spxCommandCenterTelemetry?: SPXTelemetryRecord[]
  }
}
