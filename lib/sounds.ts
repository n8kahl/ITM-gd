// Sound effects for chat notifications
// Using a subtle, luxury-sounding notification

// Base64 encoded short "plink" sound (very small, ~1KB)
// This is a soft, premium-sounding notification tone
const NOTIFICATION_SOUND_BASE64 = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoGAACAgICAgICAgICAgICAgICAgICAgICAgH1+foCCg4WGh4mJiouLjIyMjIuLioqJiIeGhYOCgH9+fXx8e3t7e3t7fHx9fn+AgYKDhIWGh4iIiYmJiYmJiIiHhoWEg4KBgH9+fn19fX19fX1+fn+AgIGCg4SEhYaGhoaGhoaGhYWEhIOCgoGAgH9/fn5+fn5+fn9/gICBgYKCg4ODhISEhISEhIODg4KCgYGAgIB/f39/f39/f3+AgICAgYGBgoKCgoKCgoKCgoGBgYGAgICAgH9/f39/f4CAgICAgIGBgYGBgYGBgYGBgYGBgICAgICAgH+AgICAgICAgICAgYGBgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgYGBgYGBgYGBgYGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

let audioContext: AudioContext | null = null
let notificationBuffer: AudioBuffer | null = null

// Initialize audio on first user interaction (required by browsers)
async function initAudio(): Promise<boolean> {
  if (audioContext) return true

  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Decode the base64 sound
    const response = await fetch(NOTIFICATION_SOUND_BASE64)
    const arrayBuffer = await response.arrayBuffer()
    notificationBuffer = await audioContext.decodeAudioData(arrayBuffer)

    return true
  } catch (error) {
    console.warn('Audio initialization failed:', error)
    return false
  }
}

// Play notification sound
export async function playNotificationSound(volume: number = 0.3): Promise<void> {
  try {
    // Initialize if needed
    if (!audioContext || !notificationBuffer) {
      const initialized = await initAudio()
      if (!initialized) return
    }

    if (!audioContext || !notificationBuffer) return

    // Resume context if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Create and play the sound
    const source = audioContext.createBufferSource()
    const gainNode = audioContext.createGain()

    source.buffer = notificationBuffer
    gainNode.gain.value = Math.max(0, Math.min(1, volume))

    source.connect(gainNode)
    gainNode.connect(audioContext.destination)

    source.start(0)
  } catch (error) {
    console.warn('Failed to play notification sound:', error)
  }
}

// Alternative: Use HTML5 Audio with a generated tone
export function playSimpleTone(frequency: number = 800, duration: number = 0.1, volume: number = 0.2): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = frequency
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(volume, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)

    // Cleanup
    setTimeout(() => ctx.close(), duration * 1000 + 100)
  } catch (error) {
    console.warn('Failed to play tone:', error)
  }
}

// Luxury "plink" sound - two quick tones
export function playLuxuryPlink(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // First tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 1200
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.15, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
    osc1.start(ctx.currentTime)
    osc1.stop(ctx.currentTime + 0.08)

    // Second tone (slightly higher, delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 1500
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.05)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    osc2.start(ctx.currentTime + 0.05)
    osc2.stop(ctx.currentTime + 0.15)

    // Cleanup
    setTimeout(() => ctx.close(), 200)
  } catch (error) {
    console.warn('Failed to play plink:', error)
  }
}

// Check if sound is enabled (respects user preference)
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('chat_sound_enabled') !== 'false'
}

// Toggle sound preference
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('chat_sound_enabled', enabled ? 'true' : 'false')
}
