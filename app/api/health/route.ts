import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment configuration')
  }

  return createClient(url, key)
}

export async function GET() {
  const timestamp = new Date().toISOString()
  const version = process.env.npm_package_version ?? 'unknown'

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('journal_entries')
      .select('id', { head: true, count: 'exact' })
      .limit(1)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ status: 'ok', timestamp, version })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp,
        version,
        error: error instanceof Error ? error.message : 'Supabase connectivity check failed',
      },
      { status: 503 },
    )
  }
}
