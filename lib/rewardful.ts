const REWARDFUL_REFERRAL_KEY = 'titm_rewardful_referral'
const REWARDFUL_REFERRAL_PARAM = 'referral'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const LAUNCHPASS_URLS = {
  trial: 'https://www.launchpass.com/tradeitm/7-day-trial',
  core: 'https://www.launchpass.com/tradeitm/core-sniper',
  pro: 'https://www.launchpass.com/tradeitm/pro-sniper',
  executive: 'https://www.launchpass.com/tradeitm/executive-sniper',
  cohort: 'https://www.launchpass.com/tradeitm/cohort',
  mentorship: 'https://www.launchpass.com/tradeitm/1x1-mentorship',
} as const

type RewardfulReadyCallback = () => void

type RewardfulQueue = {
  (event: 'ready', callback: RewardfulReadyCallback): void
  q?: unknown[]
}

declare global {
  interface Window {
    Rewardful?: {
      referral?: string | null
    }
    rewardful?: RewardfulQueue
    _rwq?: string
  }
}

function normalizeRewardfulReferral(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  if (!UUID_PATTERN.test(trimmed)) return undefined

  return trimmed
}

function getRewardfulStorage(): Storage | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function storeRewardfulReferral(referral: string | null | undefined) {
  const normalizedReferral = normalizeRewardfulReferral(referral)
  if (!normalizedReferral) return

  const storage = getRewardfulStorage()
  if (!storage) return

  try {
    storage.setItem(REWARDFUL_REFERRAL_KEY, normalizedReferral)
  } catch {
    // Ignore storage failures and continue without persistence.
  }
}

export function getStoredRewardfulReferral(): string | undefined {
  const storage = getRewardfulStorage()
  if (!storage) return undefined

  try {
    return normalizeRewardfulReferral(storage.getItem(REWARDFUL_REFERRAL_KEY))
  } catch {
    return undefined
  }
}

export function getRewardfulReferral(): string | undefined {
  if (typeof window === 'undefined') return undefined

  const liveReferral = normalizeRewardfulReferral(window.Rewardful?.referral)
  if (liveReferral) {
    storeRewardfulReferral(liveReferral)
    return liveReferral
  }

  return getStoredRewardfulReferral()
}

export function withRewardfulReferral(url: string, referral = getRewardfulReferral()): string {
  const normalizedReferral = normalizeRewardfulReferral(referral)
  if (!normalizedReferral) return url

  try {
    const baseUrl = typeof window === 'undefined' ? 'https://tradeitm.com' : window.location.origin
    const parsedUrl = new URL(url, baseUrl)

    if (!parsedUrl.searchParams.get(REWARDFUL_REFERRAL_PARAM)) {
      parsedUrl.searchParams.set(REWARDFUL_REFERRAL_PARAM, normalizedReferral)
    }

    return parsedUrl.toString()
  } catch {
    return url
  }
}

export async function waitForRewardfulReferral(timeoutMs = 1200): Promise<string | undefined> {
  const currentReferral = getRewardfulReferral()
  if (currentReferral) return currentReferral
  if (typeof window === 'undefined') return undefined

  const rewardful = window.rewardful
  if (typeof rewardful !== 'function') {
    return getStoredRewardfulReferral()
  }

  return await new Promise((resolve) => {
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true

      const referral = getRewardfulReferral()
      if (referral) {
        storeRewardfulReferral(referral)
      }

      resolve(referral)
    }

    const timeoutId = window.setTimeout(finish, timeoutMs)

    try {
      rewardful('ready', () => {
        window.clearTimeout(timeoutId)
        finish()
      })
    } catch {
      window.clearTimeout(timeoutId)
      finish()
    }
  })
}

export {
  REWARDFUL_REFERRAL_KEY,
  REWARDFUL_REFERRAL_PARAM,
}
