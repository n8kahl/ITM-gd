/**
 * Utility functions for detecting and handling PWA/standalone mode
 */

/**
 * Detects if the app is running in standalone mode (iOS "Add to Home Screen")
 * @returns true if running as standalone PWA
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false

  // Check iOS standalone mode
  const isIOSStandalone = ('standalone' in window.navigator) && (window.navigator as any).standalone === true

  // Check display-mode: standalone (works on Android and some iOS versions)
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches

  return isIOSStandalone || isDisplayStandalone
}

/**
 * Detects if running on iOS device
 * @returns true if iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false

  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

/**
 * Detects if running on iOS in standalone mode
 * @returns true if iOS standalone
 */
export function isIOSStandalone(): boolean {
  return isIOS() && isStandaloneMode()
}
