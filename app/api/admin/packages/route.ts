import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

// Create admin client lazily to avoid build-time errors
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - add it to Railway environment variables')
  }

  return createClient(url, key)
}

// GET - Fetch all pricing tiers
export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('Environment error:', envError)
      return NextResponse.json({
        error: envError instanceof Error ? envError.message : 'Missing environment variables'
      }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_tiers')
      .select('*')
      .order('monthly_price', { ascending: true })

    if (error) {
      console.error('Failed to fetch pricing tiers:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tiers: data || [] })
  } catch (error) {
    console.error('Error fetching pricing tiers:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update a pricing tier
export async function PATCH(request: NextRequest) {
  // Check admin auth
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing tier ID' }, { status: 400 })
    }

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('Environment error:', envError)
      return NextResponse.json({
        error: envError instanceof Error ? envError.message : 'Missing environment variables'
      }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('pricing_tiers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Failed to update pricing tier:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: `Tier '${id}' not found` }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error updating pricing tier:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
