import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public config endpoint - returns non-sensitive configuration values
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // Return fallback values if Supabase is not configured
      return NextResponse.json({
        discord_invite_url: 'https://discord.gg/tradeitm',
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Fetch only non-sensitive public config keys
    const publicKeys = ['discord_invite_url', 'discord_guild_id']

    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', publicKeys)

    if (error) {
      console.error('Error fetching public config:', error)
      // Return fallback values on error
      return NextResponse.json({
        discord_invite_url: 'https://discord.gg/tradeitm',
      })
    }

    // Build config object from database values
    const config: Record<string, string> = {
      discord_invite_url: 'https://discord.gg/tradeitm', // fallback
    }

    if (data) {
      for (const setting of data) {
        config[setting.key] = setting.value
      }
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Unexpected error in public config:', error)
    return NextResponse.json({
      discord_invite_url: 'https://discord.gg/tradeitm',
    })
  }
}
