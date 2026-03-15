import { createClient } from '@supabase/supabase-js'

export interface DependencyCheck {
  status: 'up' | 'down'
  message?: string
}

export interface HealthPayload {
  status: 'ok' | 'degraded'
  timestamp: string
  version: string
  checks: {
    app: DependencyCheck
    supabase?: DependencyCheck
  }
}

function buildBaseHealthPayload(): Pick<HealthPayload, 'timestamp' | 'version' | 'checks'> {
  return {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown',
    checks: {
      app: { status: 'up' },
    },
  }
}

function getSupabaseHealthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !key) {
    return null
  }

  return createClient(url, key)
}

async function checkSupabase(): Promise<DependencyCheck> {
  const supabase = getSupabaseHealthClient()
  if (!supabase) {
    return {
      status: 'down',
      message: 'Missing Supabase environment configuration',
    }
  }

  try {
    const { error } = await supabase
      .from('pricing_tiers')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) {
      throw new Error(error.message)
    }

    return { status: 'up' }
  } catch (error) {
    return {
      status: 'down',
      message: error instanceof Error ? error.message : 'Supabase readiness check failed',
    }
  }
}

export function buildLivenessPayload(): HealthPayload {
  return {
    status: 'ok',
    ...buildBaseHealthPayload(),
  }
}

export async function buildReadinessPayload(): Promise<HealthPayload> {
  const supabase = await checkSupabase()
  const degraded = supabase.status === 'down'
  const base = buildBaseHealthPayload()

  return {
    status: degraded ? 'degraded' : 'ok',
    timestamp: base.timestamp,
    version: base.version,
    checks: {
      ...base.checks,
      supabase,
    },
  }
}
