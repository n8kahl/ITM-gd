// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const VALID_REFERRAL = '123e4567-e89b-12d3-a456-426614174000'

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
  delete window.Rewardful
  delete window.rewardful
  delete window._rwq
})

describe('rewardful helpers', () => {
  it('appends the referral UUID to LaunchPass URLs', async () => {
    const { withRewardfulReferral } = await import('@/lib/rewardful')

    expect(withRewardfulReferral('https://www.launchpass.com/tradeitm/core-sniper', VALID_REFERRAL))
      .toBe(`https://www.launchpass.com/tradeitm/core-sniper?referral=${VALID_REFERRAL}`)
  })

  it('does not overwrite an existing referral query parameter', async () => {
    const { withRewardfulReferral } = await import('@/lib/rewardful')

    expect(withRewardfulReferral(
      'https://www.launchpass.com/tradeitm/core-sniper?referral=existing-referral',
      VALID_REFERRAL,
    )).toBe('https://www.launchpass.com/tradeitm/core-sniper?referral=existing-referral')
  })

  it('reads the live Rewardful referral and persists it locally', async () => {
    const {
      getRewardfulReferral,
      REWARDFUL_REFERRAL_KEY,
    } = await import('@/lib/rewardful')

    window.Rewardful = {
      referral: VALID_REFERRAL,
    }

    expect(getRewardfulReferral()).toBe(VALID_REFERRAL)
    expect(window.localStorage.getItem(REWARDFUL_REFERRAL_KEY)).toBe(VALID_REFERRAL)
  })

  it('resolves queued ready callbacks before the timeout elapses', async () => {
    vi.useFakeTimers()

    const {
      waitForRewardfulReferral,
      REWARDFUL_REFERRAL_KEY,
    } = await import('@/lib/rewardful')

    let readyCallback: (() => void) | undefined
    window.rewardful = vi.fn((_event: 'ready', callback: () => void) => {
      readyCallback = callback
    })

    const referralPromise = waitForRewardfulReferral(1000)

    window.Rewardful = {
      referral: VALID_REFERRAL,
    }
    readyCallback?.()

    await expect(referralPromise).resolves.toBe(VALID_REFERRAL)
    expect(window.localStorage.getItem(REWARDFUL_REFERRAL_KEY)).toBe(VALID_REFERRAL)
  })
})
