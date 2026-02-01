import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Create admin client lazily
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

// Verify admin cookie
async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('titm_admin')
  return adminCookie?.value === 'true'
}

interface DiagnosticResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
  latency?: number
}

// GET - Run system diagnostics
export async function GET(_request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: DiagnosticResult[] = []

  // 1. Database Connection Test
  const dbResult = await testDatabase()
  results.push(dbResult)

  // 2. Edge Functions Test
  const edgeFnResult = await testEdgeFunctions()
  results.push(edgeFnResult)

  // 3. OpenAI Integration Test
  const openaiResult = await testOpenAI()
  results.push(openaiResult)

  // 4. Discord Bot Test
  const discordResult = await testDiscordBot()
  results.push(discordResult)

  // 5. Storage Test
  const storageResult = await testStorage()
  results.push(storageResult)

  // Calculate overall status
  const hasFailure = results.some(r => r.status === 'fail')
  const hasWarning = results.some(r => r.status === 'warning')
  const overallStatus = hasFailure ? 'degraded' : hasWarning ? 'warning' : 'healthy'

  return NextResponse.json({
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    results,
  })
}

// Test 1: Database Connection
async function testDatabase(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()

    // Simple query to test connection
    const { data, error } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1)

    const latency = Date.now() - start

    if (error) {
      return {
        name: 'Database Connection',
        status: 'fail',
        message: 'Database query failed',
        details: error.message,
        latency,
      }
    }

    return {
      name: 'Database Connection',
      status: 'pass',
      message: 'Database is responsive',
      details: `Query returned successfully`,
      latency,
    }
  } catch (error) {
    return {
      name: 'Database Connection',
      status: 'fail',
      message: 'Failed to connect to database',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    }
  }
}

// Test 2: Edge Functions (ping notify-team-lead)
async function testEdgeFunctions(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return {
        name: 'Edge Functions',
        status: 'fail',
        message: 'Missing Supabase configuration',
        details: 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set',
      }
    }

    // Call the edge function with a dry_run flag
    const response = await fetch(`${supabaseUrl}/functions/v1/notify-team-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        type: 'ping',
        dry_run: true,
      }),
    })

    const latency = Date.now() - start

    if (response.ok || response.status === 400) {
      // 400 is acceptable - means the function is running but rejected our test payload
      return {
        name: 'Edge Functions',
        status: 'pass',
        message: 'Edge Functions are accessible',
        details: `notify-team-lead responded with status ${response.status}`,
        latency,
      }
    }

    if (response.status === 404) {
      return {
        name: 'Edge Functions',
        status: 'fail',
        message: 'Edge Function not found',
        details: 'notify-team-lead function may not be deployed',
        latency,
      }
    }

    return {
      name: 'Edge Functions',
      status: 'warning',
      message: 'Edge Function returned unexpected status',
      details: `Status: ${response.status}`,
      latency,
    }
  } catch (error) {
    return {
      name: 'Edge Functions',
      status: 'fail',
      message: 'Failed to reach Edge Functions',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    }
  }
}

// Test 3: OpenAI Integration (check if API key is set)
async function testOpenAI(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single()

    const latency = Date.now() - start

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return {
          name: 'OpenAI Integration',
          status: 'fail',
          message: 'OpenAI API key not configured',
          details: 'Add openai_api_key in Settings',
          latency,
        }
      }
      return {
        name: 'OpenAI Integration',
        status: 'fail',
        message: 'Failed to check OpenAI configuration',
        details: error.message,
        latency,
      }
    }

    if (!data?.value) {
      return {
        name: 'OpenAI Integration',
        status: 'fail',
        message: 'OpenAI API key is empty',
        details: 'Add a valid API key in Settings',
        latency,
      }
    }

    // Check if it looks like a valid key format
    const keyPrefix = data.value.substring(0, 3)
    if (keyPrefix !== 'sk-') {
      return {
        name: 'OpenAI Integration',
        status: 'warning',
        message: 'OpenAI API key format may be invalid',
        details: 'Key should start with "sk-"',
        latency,
      }
    }

    return {
      name: 'OpenAI Integration',
      status: 'pass',
      message: 'OpenAI API key is configured',
      details: `Key starts with "${keyPrefix}..."`,
      latency,
    }
  } catch (error) {
    return {
      name: 'OpenAI Integration',
      status: 'fail',
      message: 'Failed to check OpenAI configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    }
  }
}

// Test 4: Discord Bot (check if bot token is set)
async function testDiscordBot(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()

    // Check for discord_bot_token
    const { data: tokenData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'discord_bot_token')
      .single()

    // Check for discord_guild_id
    const { data: guildData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'discord_guild_id')
      .single()

    const latency = Date.now() - start

    const hasToken = tokenData?.value && tokenData.value.length > 0
    const hasGuild = guildData?.value && guildData.value.length > 0

    if (!hasToken && !hasGuild) {
      return {
        name: 'Discord Bot',
        status: 'fail',
        message: 'Discord not configured',
        details: 'Add discord_bot_token and discord_guild_id in Settings',
        latency,
      }
    }

    if (!hasToken) {
      return {
        name: 'Discord Bot',
        status: 'warning',
        message: 'Discord bot token not set',
        details: 'Guild ID is set but bot token is missing',
        latency,
      }
    }

    if (!hasGuild) {
      return {
        name: 'Discord Bot',
        status: 'warning',
        message: 'Discord guild ID not set',
        details: 'Bot token is set but guild ID is missing',
        latency,
      }
    }

    return {
      name: 'Discord Bot',
      status: 'pass',
      message: 'Discord is configured',
      details: `Guild ID: ${guildData.value.substring(0, 6)}...`,
      latency,
    }
  } catch (error) {
    return {
      name: 'Discord Bot',
      status: 'fail',
      message: 'Failed to check Discord configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    }
  }
}

// Test 5: Storage (check bucket exists)
async function testStorage(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()

    // List buckets to check if storage is accessible
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets()

    const latency = Date.now() - start

    if (listError) {
      return {
        name: 'Storage',
        status: 'fail',
        message: 'Failed to access storage',
        details: listError.message,
        latency,
      }
    }

    // Check for our journal screenshots bucket
    const journalBucket = buckets?.find(b =>
      b.name === 'trading-journal-screenshots' ||
      b.name === 'journal-screenshots' ||
      b.name.includes('journal')
    )

    if (!journalBucket) {
      return {
        name: 'Storage',
        status: 'warning',
        message: 'Journal screenshots bucket not found',
        details: `Found ${buckets?.length || 0} bucket(s): ${buckets?.map(b => b.name).join(', ') || 'none'}`,
        latency,
      }
    }

    return {
      name: 'Storage',
      status: 'pass',
      message: 'Storage is accessible',
      details: `Bucket "${journalBucket.name}" found`,
      latency,
    }
  } catch (error) {
    return {
      name: 'Storage',
      status: 'fail',
      message: 'Failed to check storage',
      details: error instanceof Error ? error.message : 'Unknown error',
      latency: Date.now() - start,
    }
  }
}
