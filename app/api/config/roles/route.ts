import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRoleTierMapping, type MembershipTier } from '@/lib/role-tier-mapping'

const DEFAULT_ROLE_MAPPING: Record<string, MembershipTier> = {}

// Public endpoint to fetch role-to-tier mappings (Discord role ID -> tier)
// Source-of-truth preference:
// 1) pricing_tiers.discord_role_id
// 2) app_settings.role_tier_mapping (legacy fallback)
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(DEFAULT_ROLE_MAPPING)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const mapping = await fetchRoleTierMapping(supabase)
    if (!mapping || Object.keys(mapping).length === 0) {
      return NextResponse.json(DEFAULT_ROLE_MAPPING)
    }

    return NextResponse.json(mapping)
  } catch (error) {
    console.error('Error fetching role mapping:', error)
    return NextResponse.json(DEFAULT_ROLE_MAPPING)
  }
}
