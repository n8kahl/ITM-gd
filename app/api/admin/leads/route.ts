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

// GET - Fetch cohort applications
export async function GET(request: NextRequest) {
  // Check admin auth
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '1000')
    const offset = parseInt(searchParams.get('offset') || '0')

    let supabaseAdmin
    try {
      supabaseAdmin = getSupabaseAdmin()
    } catch (envError) {
      console.error('Environment error:', envError)
      return NextResponse.json({
        error: envError instanceof Error ? envError.message : 'Missing environment variables'
      }, { status: 500 })
    }

    let query = supabaseAdmin
      .from('cohort_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch cohort applications:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Error fetching cohort applications:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update application status
export async function PATCH(request: NextRequest) {
  // Check admin auth
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, status, notes, reviewed_by } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing application ID' }, { status: 400 })
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
      .from('cohort_applications')
      .update({
        status,
        notes: notes || null,
        reviewed_by: reviewed_by || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('Failed to update application:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: `Application '${id}' not found` }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
