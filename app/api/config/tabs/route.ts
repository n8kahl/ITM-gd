import { NextResponse } from 'next/server'
import { createServiceRoleSupabaseClient } from '@/lib/server-supabase'

export async function GET() {
  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Tab configuration unavailable' },
      { status: 503 },
    )
  }

  const { data, error } = await supabase
    .from('tab_configurations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    )
  }

  if (!Array.isArray(data) || data.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No active tab configuration found' },
      { status: 503 },
    )
  }

  return NextResponse.json(
    { success: true, data },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}
