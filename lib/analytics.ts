import { trackPageView, trackClick, trackConversion, upsertSession } from './supabase'
import { UAParser } from 'ua-parser-js'

// ============================================
// SESSION MANAGEMENT
// ============================================

const SESSION_KEY = 'titm_session_id'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

let memorySessionId: string | null = null
let memoryLastActivity = 0
let memoryHasVisited = false

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>

function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function getBrowserStorage(): BrowserStorage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function safeStorageGet(storage: BrowserStorage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(storage: BrowserStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  const now = Date.now()
  const storage = getBrowserStorage()

  if (!storage) {
    if (!memorySessionId || now - memoryLastActivity > SESSION_DURATION) {
      memorySessionId = createSessionId()
      memoryLastActivity = now
    } else {
      memoryLastActivity = now
    }

    return memorySessionId
  }

  let sessionId = safeStorageGet(storage, SESSION_KEY)
  const lastActivityRaw = safeStorageGet(storage, 'titm_last_activity')
  const lastActivity = Number.parseInt(lastActivityRaw ?? '', 10)
  const hasValidLastActivity = Number.isFinite(lastActivity)
  const effectiveLastActivity = hasValidLastActivity ? lastActivity : memoryLastActivity

  if (!sessionId && memorySessionId) {
    sessionId = memorySessionId
  }

  // Create new session if doesn't exist or expired
  if (!sessionId || !effectiveLastActivity || now - effectiveLastActivity > SESSION_DURATION) {
    sessionId = createSessionId()
    memorySessionId = sessionId
    memoryLastActivity = now
    if (!safeStorageSet(storage, SESSION_KEY, sessionId)) {
      memorySessionId = sessionId
    }
    safeStorageSet(storage, 'titm_is_new_session', 'true')
  } else {
    memorySessionId = sessionId
    memoryLastActivity = now
  }

  if (!safeStorageSet(storage, 'titm_last_activity', now.toString())) {
    memoryLastActivity = now
    memorySessionId = sessionId
  }

  return sessionId
}

export function isReturningVisitor(): boolean {
  const storage = getBrowserStorage()
  if (!storage) return memoryHasVisited
  return safeStorageGet(storage, 'titm_has_visited') === 'true' || memoryHasVisited
}

export function markAsVisited() {
  const storage = getBrowserStorage()
  if (!storage) {
    memoryHasVisited = true
    return
  }

  if (!safeStorageSet(storage, 'titm_has_visited', 'true')) {
    memoryHasVisited = true
  }
}

// ============================================
// DEVICE & BROWSER DETECTION
// ============================================

export function getDeviceInfo() {
  if (typeof window === 'undefined') {
    return {
      device_type: 'unknown',
      browser: 'unknown',
      os: 'unknown',
      screen_width: 0,
      screen_height: 0,
    }
  }

  const parser = new UAParser(navigator.userAgent)
  const device = parser.getDevice()
  const browser = parser.getBrowser()
  const os = parser.getOS()

  let deviceType = 'desktop'
  if (device.type === 'mobile') deviceType = 'mobile'
  else if (device.type === 'tablet') deviceType = 'tablet'

  return {
    device_type: deviceType,
    browser: `${browser.name || 'Unknown'} ${browser.version || ''}`.trim(),
    os: `${os.name || 'Unknown'} ${os.version || ''}`.trim(),
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    user_agent: navigator.userAgent,
  }
}

// ============================================
// TRACKING FUNCTIONS
// ============================================

export async function initializeSession() {
  if (typeof window === 'undefined') return

  try {
    const sessionId = getSessionId()
    const isReturning = isReturningVisitor()
    await upsertSession({
      session_id: sessionId,
      last_seen: new Date().toISOString(),
      is_returning: isReturning,
    })

    markAsVisited()
  } catch (error) {
    console.error('Failed to initialize session:', error)
  }
}

export async function trackPage(pagePath?: string) {
  if (typeof window === 'undefined') return

  try {
    const sessionId = getSessionId()
    const deviceInfo = getDeviceInfo()
    await trackPageView({
      session_id: sessionId,
      page_path: pagePath || window.location.pathname,
      referrer: document.referrer || undefined,
      ...deviceInfo,
    })
  } catch (error) {
    console.error('Failed to track page view:', error)
  }
}

export async function trackButtonClick(
  elementType: string,
  elementLabel?: string,
  elementValue?: string
) {
  if (typeof window === 'undefined') return

  try {
    const sessionId = getSessionId()
    await trackClick({
      session_id: sessionId,
      element_type: elementType,
      element_label: elementLabel,
      element_value: elementValue,
      page_path: window.location.pathname,
    })
  } catch (error) {
    console.error('Failed to track click:', error)
  }
}

export async function trackEvent(eventType: string, eventValue?: string) {
  if (typeof window === 'undefined') return

  try {
    const sessionId = getSessionId()
    await trackConversion({
      session_id: sessionId,
      event_type: eventType,
      event_value: eventValue,
    })
  } catch (error) {
    console.error('Failed to track event:', error)
  }
}

type MemberNavLifecycleStage = 'start' | 'success' | 'stall' | 'retry'

type MemberNavLifecyclePayload = {
  from?: string
  to?: string
  target?: string
  label?: string
  durationMs?: number
}

function serializeMemberNavLifecyclePayload(payload: MemberNavLifecyclePayload): string {
  const normalizedPayload = {
    ...payload,
    durationMs: typeof payload.durationMs === 'number' ? Math.round(payload.durationMs) : undefined,
  }

  return JSON.stringify(normalizedPayload)
}

// ============================================
// CONVENIENCE TRACKING FUNCTIONS
// ============================================

export const Analytics = {
  // Page tracking
  trackPageView: trackPage,

  // Button clicks
  trackCTAClick: (label: string) => trackButtonClick('cta_button', label),
  trackPricingClick: (plan: string) => trackButtonClick('pricing_card', plan),
  trackNavClick: (label: string) => trackButtonClick('nav_link', label),
  trackSocialClick: (platform: string) => trackButtonClick('social_link', platform),
  trackMemberNavItem: (label: string) => {
    try {
      void trackButtonClick('nav_item', label)
    } catch (error) {
      console.error('Failed to track member nav item:', error)
    }
  },
  trackMemberNavLifecycle: (stage: MemberNavLifecycleStage, payload: MemberNavLifecyclePayload) => {
    try {
      void trackEvent(`member_nav_${stage}`, serializeMemberNavLifecyclePayload(payload))
    } catch (error) {
      console.error('Failed to track member nav lifecycle event:', error)
    }
  },
  trackJournalAction: (label: string) => trackButtonClick('journal_action', label),
  trackAICoachAction: (label: string) => trackButtonClick('ai_coach_action', label),
  trackMembersSocialAction: (label: string) => trackButtonClick('social_action', label),
  trackAcademyAction: (label: string) => trackButtonClick('academy_action', label),

  // Conversion events
  trackModalOpen: (modalName: string) => trackEvent('modal_opened', modalName),
  trackModalClose: (modalName: string) => trackEvent('modal_closed', modalName),
  trackFormStart: (formName: string) => trackEvent('form_started', formName),
  trackFormSubmit: (formName: string) => trackEvent('form_submitted', formName),
  trackSubscribe: (plan?: string) => trackEvent('subscription', plan),

  // Session
  initialize: initializeSession,
}
