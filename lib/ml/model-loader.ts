import type { ConfidenceModelWeights } from '@/lib/ml/types'

const DEFAULT_MODEL_BUCKET = 'spx-ml-models'
const DEFAULT_MODEL_PATH = 'confidence-model/latest.json'
const DEFAULT_REFRESH_MS = 24 * 60 * 60 * 1000

interface LoadConfidenceModelWeightsOptions {
  forceRefresh?: boolean
  nowMs?: number
  fetchImpl?: typeof fetch
}

let cachedModel: ConfidenceModelWeights | null = null
let cachedAtMs = 0
let inflightLoad: Promise<ConfidenceModelWeights | null> | null = null

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function resolveRefreshMs(): number {
  const parsed = Number.parseInt(process.env.SPX_ML_CONFIDENCE_REFRESH_MS ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_REFRESH_MS
  return parsed
}

function resolveModelUrl(): string | null {
  const explicit = process.env.SPX_ML_CONFIDENCE_MODEL_URL?.trim()
  if (explicit) return explicit

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!supabaseUrl) return null

  const bucket = process.env.SPX_ML_CONFIDENCE_BUCKET?.trim() || DEFAULT_MODEL_BUCKET
  const path = process.env.SPX_ML_CONFIDENCE_MODEL_PATH?.trim() || DEFAULT_MODEL_PATH
  const encodedPath = path.split('/').map((part) => encodeURIComponent(part)).join('/')
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
}

function isConfidenceModelWeights(value: unknown): value is ConfidenceModelWeights {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<ConfidenceModelWeights>
  if (typeof candidate.version !== 'string' || candidate.version.trim().length === 0) return false
  if (safeNumber(candidate.intercept) == null) return false
  if (!candidate.features || typeof candidate.features !== 'object' || Array.isArray(candidate.features)) return false

  for (const rawWeight of Object.values(candidate.features)) {
    if (rawWeight == null) continue
    if (safeNumber(rawWeight) == null) return false
  }

  return true
}

async function fetchConfidenceModel(
  url: string,
  fetchImpl: typeof fetch,
): Promise<ConfidenceModelWeights | null> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
    },
  })

  if (!response.ok) return null

  const payload: unknown = await response.json()
  if (!isConfidenceModelWeights(payload)) return null

  return payload
}

export function getCachedConfidenceModelWeights(): ConfidenceModelWeights | null {
  return cachedModel
}

export async function loadConfidenceModelWeights(
  options: LoadConfidenceModelWeightsOptions = {},
): Promise<ConfidenceModelWeights | null> {
  const nowMs = options.nowMs ?? Date.now()
  const refreshMs = resolveRefreshMs()

  if (!options.forceRefresh && cachedModel && (nowMs - cachedAtMs) < refreshMs) {
    return cachedModel
  }

  if (inflightLoad) return inflightLoad

  const url = resolveModelUrl()
  if (!url) return cachedModel

  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return cachedModel

  inflightLoad = (async () => {
    try {
      const loaded = await fetchConfidenceModel(url, fetchImpl)
      if (!loaded) return cachedModel
      cachedModel = loaded
      cachedAtMs = nowMs
      return cachedModel
    } catch {
      return cachedModel
    } finally {
      inflightLoad = null
    }
  })()

  return inflightLoad
}

export function setCachedConfidenceModelWeightsForTest(
  model: ConfidenceModelWeights | null,
  loadedAtMs = Date.now(),
): void {
  cachedModel = model
  cachedAtMs = loadedAtMs
  inflightLoad = null
}

export function resetConfidenceModelCacheForTest(): void {
  cachedModel = null
  cachedAtMs = 0
  inflightLoad = null
}
