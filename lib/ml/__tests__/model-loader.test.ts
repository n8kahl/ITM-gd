import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadConfidenceModelWeights,
  resetConfidenceModelCacheForTest,
} from '@/lib/ml/model-loader'

describe('loadConfidenceModelWeights', () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousBucket = process.env.SPX_ML_CONFIDENCE_BUCKET
  const previousPath = process.env.SPX_ML_CONFIDENCE_MODEL_PATH

  beforeEach(() => {
    resetConfidenceModelCacheForTest()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SPX_ML_CONFIDENCE_BUCKET = 'ml-models'
    process.env.SPX_ML_CONFIDENCE_MODEL_PATH = 'confidence/latest.json'
  })

  afterEach(() => {
    resetConfidenceModelCacheForTest()

    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl

    if (previousBucket == null) delete process.env.SPX_ML_CONFIDENCE_BUCKET
    else process.env.SPX_ML_CONFIDENCE_BUCKET = previousBucket

    if (previousPath == null) delete process.env.SPX_ML_CONFIDENCE_MODEL_PATH
    else process.env.SPX_ML_CONFIDENCE_MODEL_PATH = previousPath
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
})
