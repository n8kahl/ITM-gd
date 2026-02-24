import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadConfidenceModelWeights,
  resetConfidenceModelCacheForTest,
} from '@/lib/ml/model-loader'

describe('loadConfidenceModelWeights', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousBucket = process.env.SPX_ML_CONFIDENCE_BUCKET
  const previousPath = process.env.SPX_ML_CONFIDENCE_MODEL_PATH
  const previousRefreshMs = process.env.SPX_ML_CONFIDENCE_REFRESH_MS
  const previousBrowserAutoload = process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BROWSER_AUTOLOAD
  const previousPublicModelUrl = process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_URL
  const previousPublicBucket = process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BUCKET
  const previousPublicPath = process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_PATH

  beforeEach(() => {
    resetConfidenceModelCacheForTest()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SPX_ML_CONFIDENCE_BUCKET = 'ml-models'
    process.env.SPX_ML_CONFIDENCE_MODEL_PATH = 'confidence/latest.json'
    process.env.SPX_ML_CONFIDENCE_REFRESH_MS = '60000'
    delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BROWSER_AUTOLOAD
    delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_URL
    delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BUCKET
    delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_PATH
  })

  afterEach(() => {
    resetConfidenceModelCacheForTest()

    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl

    if (previousBucket == null) delete process.env.SPX_ML_CONFIDENCE_BUCKET
    else process.env.SPX_ML_CONFIDENCE_BUCKET = previousBucket

    if (previousPath == null) delete process.env.SPX_ML_CONFIDENCE_MODEL_PATH
    else process.env.SPX_ML_CONFIDENCE_MODEL_PATH = previousPath

    if (previousRefreshMs == null) delete process.env.SPX_ML_CONFIDENCE_REFRESH_MS
    else process.env.SPX_ML_CONFIDENCE_REFRESH_MS = previousRefreshMs

    if (previousBrowserAutoload == null) delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BROWSER_AUTOLOAD
    else process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BROWSER_AUTOLOAD = previousBrowserAutoload

    if (previousPublicModelUrl == null) delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_URL
    else process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_URL = previousPublicModelUrl

    if (previousPublicBucket == null) delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BUCKET
    else process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_BUCKET = previousPublicBucket

    if (previousPublicPath == null) delete process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_PATH
    else process.env.NEXT_PUBLIC_SPX_ML_CONFIDENCE_MODEL_PATH = previousPublicPath
  })

  it('loads confidence model weights from Supabase storage URL', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v1',
        intercept: -0.2,
        features: {
          confluenceScore: 0.5,
          flowBias: 0.3,
        },
      }),
    } as Response)

    const model = await loadConfidenceModelWeights({
      forceRefresh: true,
      fetchImpl: fetchMock,
    })

    expect(model?.version).toBe('v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.supabase.co/storage/v1/object/public/ml-models/confidence/latest.json')
  })

  it('returns null when payload is invalid', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v1',
        intercept: 'invalid',
        features: {},
      }),
    } as Response)

    const model = await loadConfidenceModelWeights({
      forceRefresh: true,
      fetchImpl: fetchMock,
    })

    expect(model).toBeNull()
  })

  it('backs off after a failed fetch and avoids immediate refetch loops', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    } as Response)

    const firstAttempt = await loadConfidenceModelWeights({
      forceRefresh: true,
      fetchImpl: fetchMock,
      nowMs: 1_000,
    })
    const secondAttempt = await loadConfidenceModelWeights({
      fetchImpl: fetchMock,
      nowMs: 2_000,
    })

    expect(firstAttempt).toBeNull()
    expect(secondAttempt).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('skips browser-side model fetch unless explicitly enabled', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      value: {} as Window,
      configurable: true,
      writable: true,
    })

    try {
      const model = await loadConfidenceModelWeights({
        forceRefresh: true,
        fetchImpl: fetchMock,
      })

      expect(model).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        configurable: true,
        writable: true,
      })
    }
  })
})
