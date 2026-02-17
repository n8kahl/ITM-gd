import { trackPageView, trackClick, trackConversion, upsertSession } from './supabase'
import { UAParser } from 'ua-parser-js'

// ============================================
// SESSION MANAGEMENT
// ============================================

const SESSION_KEY = 'titm_session_id'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem(SESSION_KEY)
  const lastActivity = localStorage.getItem('titm_last_activity')
  const now = Date.now()

  // Create new session if doesn't exist or expired
  if (!sessionId || !lastActivity || now - parseInt(lastActivity) > SESSION_DURATION) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(SESSION_KEY, sessionId)
    localStorage.setItem('titm_is_new_session', 'true')
  }

  localStorage.setItem('titm_last_activity', now.toString())
  return sessionId
}

export function isReturningVisitor(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('titm_has_visited') === 'true'
}

export function markAsVisited() {
  if (typeof window === 'undefined') return
  localStorage.setItem('titm_has_visited', 'true')
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

  const sessionId = getSessionId()
  const isReturning = isReturningVisitor()

  try {
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

  const sessionId = getSessionId()
  const deviceInfo = getDeviceInfo()

  try {
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

  const sessionId = getSessionId()

  try {
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

  const sessionId = getSessionId()

  try {
    await trackConversion({
      session_id: sessionId,
      event_type: eventType,
      event_value: eventValue,
    })
  } catch (error) {
    console.error('Failed to track event:', error)
  }
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
  trackMemberNavItem: (label: string) => trackButtonClick('nav_item', label),
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
