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
    supabase: DependencyCheck
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

export async function buildHealthPayload(): Promise<HealthPayload> {
  const timestamp = new Date().toISOString()
  const version = process.env.npm_package_version ?? 'unknown'
  const supabase = await checkSupabase()
  const degraded = supabase.status === 'down'

  return {
    status: degraded ? 'degraded' : 'ok',
    timestamp,
    version,
    checks: {
      app: { status: 'up' },
      supabase,
    },
  }
}

