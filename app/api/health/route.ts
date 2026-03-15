import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface DependencyCheck {
  status: 'up' | 'down'
  message?: string
}

interface HealthPayload {
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

function isStrictReadinessProbe(request: Request): boolean {
  const strict = new URL(request.url).searchParams.get('strict')?.trim().toLowerCase()
  return strict === '1' || strict === 'true' || strict === 'yes'
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

export async function GET(request: Request) {
  const timestamp = new Date().toISOString()
  const version = process.env.npm_package_version ?? 'unknown'
  const supabase = await checkSupabase()
  const degraded = supabase.status === 'down'
  const payload: HealthPayload = {
    status: degraded ? 'degraded' : 'ok',
    timestamp,
    version,
    checks: {
      app: { status: 'up' },
      supabase,
    },
  }

  return NextResponse.json(
    payload,
    { status: degraded && isStrictReadinessProbe(request) ? 503 : 200 },
  )
}
