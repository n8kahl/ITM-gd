import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Default role mapping fallback (Discord role ID -> tier)
// NOTE: These are placeholder IDs. Configure actual Discord role IDs in app_settings.
// To configure: INSERT INTO app_settings (key, value) VALUES ('role_tier_mapping', '{"YOUR_ROLE_ID": "execute", ...}')
const DEFAULT_ROLE_MAPPING: Record<string, 'core' | 'pro' | 'execute'> = {
  // Empty by default - must be configured in database with actual Discord role IDs
  // Example: '1234567890123456789': 'execute'
}

// Public endpoint to fetch role-to-tier mappings (Discord role ID -> tier)
// This allows the mapping to be configured in admin without redeploying
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // Return fallback if Supabase not configured
      return NextResponse.json(DEFAULT_ROLE_MAPPING)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Try to fetch role_tier_mapping from app_settings
    // Expected format: JSON object like {"role_name": "tier", ...}
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'role_tier_mapping')
      .single()

    if (error || !data?.value) {
      // Return default mapping if not configured in database
      return NextResponse.json(DEFAULT_ROLE_MAPPING)
    }

    // Parse the stored JSON value
    try {
      const mapping = typeof data.value === 'string'
        ? JSON.parse(data.value)
        : data.value

      // Validate it's an object with string values
      if (typeof mapping === 'object' && mapping !== null) {
        return NextResponse.json(mapping)
      }
    } catch {
      // JSON parse failed, return default
    }

    return NextResponse.json(DEFAULT_ROLE_MAPPING)
  } catch (error) {
    console.error('Error fetching role mapping:', error)
    return NextResponse.json(DEFAULT_ROLE_MAPPING)
  }
}
