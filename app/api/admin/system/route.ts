import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

// Create admin client lazily
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

interface DiagnosticResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
  latency?: number
  circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount?: number
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
}

// GET - Run system diagnostics
export async function GET(_request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch circuit breaker states from backend (non-blocking)
  const circuitStates = await fetchCircuitBreakerStates()

  // Run all diagnostics in parallel for speed
  const [
    dbResult,
    edgeFnResult,
    openaiResult,
    massiveResult,
    fredResult,
    fmpResult,
    discordResult,
    redisResult,
    storageResult,
  ] = await Promise.all([
    testDatabase(),
    testEdgeFunctions(),
    testOpenAI(),
    testMassive(),
    testFRED(),
    testFMP(),
    testDiscordBot(),
    testRedis(),
    testStorage(),
  ])

  // Attach circuit breaker states to matching diagnostics
  const circuitMap: Record<string, string> = {
    'OpenAI Integration': 'openai',
    'Massive.com': 'massive',
    'FRED': 'fred',
    'FMP': 'fmp',
  }

  const results: DiagnosticResult[] = [
    dbResult, edgeFnResult, openaiResult, massiveResult,
    fredResult, fmpResult, discordResult, redisResult, storageResult,
  ]

  for (const result of results) {
    const circuitKey = circuitMap[result.name]
    if (circuitKey && circuitStates[circuitKey]) {
      result.circuitState = circuitStates[circuitKey].state
      result.failureCount = circuitStates[circuitKey].failureCount
    }
  }

  // Calculate overall status
  const hasFailure = results.some(r => r.status === 'fail')
  const hasWarning = results.some(r => r.status === 'warning')
  const hasOpenCircuit = results.some(r => r.circuitState === 'OPEN')
  const overallStatus = hasFailure || hasOpenCircuit ? 'degraded' : hasWarning ? 'warning' : 'healthy'

  return NextResponse.json({
    success: true,
    status: overallStatus,
    timestamp: new Date().toISOString(),
    results,
  })
}

// Fetch circuit breaker states from backend health endpoint
async function fetchCircuitBreakerStates(): Promise<Record<string, CircuitBreakerState>> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${backendUrl}/api/health/circuits`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (response.ok) {
      const data = await response.json()
      return data.circuits || {}
    }
  } catch {
    // Backend circuit endpoint unavailable — not critical
  }
  return {}
}

// Test 1: Database Connection (Supabase)
async function testDatabase(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('app_settings').select('key').limit(1)
    const latency = Date.now() - start

    if (error) {
      return { name: 'Database Connection', status: 'fail', message: 'Database query failed', details: error.message, latency }
    }
    return { name: 'Database Connection', status: 'pass', message: 'Database is responsive', details: 'Query returned successfully', latency }
  } catch (error) {
    return { name: 'Database Connection', status: 'fail', message: 'Failed to connect to database', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 2: Edge Functions (ping notify-team-lead)
async function testEdgeFunctions(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return { name: 'Edge Functions', status: 'fail', message: 'Missing Supabase configuration', details: 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set' }
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/notify-team-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ type: 'ping', dry_run: true }),
    })
    const latency = Date.now() - start

    if (response.ok || response.status === 400) {
      return { name: 'Edge Functions', status: 'pass', message: 'Edge Functions are accessible', details: `notify-team-lead responded with status ${response.status}`, latency }
    }
    if (response.status === 404) {
      return { name: 'Edge Functions', status: 'fail', message: 'Edge Function not found', details: 'notify-team-lead function may not be deployed', latency }
    }
    return { name: 'Edge Functions', status: 'warning', message: 'Edge Function returned unexpected status', details: `Status: ${response.status}`, latency }
  } catch (error) {
    return { name: 'Edge Functions', status: 'fail', message: 'Failed to reach Edge Functions', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 3: OpenAI Integration
async function testOpenAI(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'openai_api_key').single()
    const latency = Date.now() - start

    if (error) {
      if (error.code === 'PGRST116') {
        return { name: 'OpenAI Integration', status: 'fail', message: 'OpenAI API key not configured', details: 'Add openai_api_key in Settings', latency }
      }
      return { name: 'OpenAI Integration', status: 'fail', message: 'Failed to check OpenAI configuration', details: error.message, latency }
    }
    if (!data?.value) {
      return { name: 'OpenAI Integration', status: 'fail', message: 'OpenAI API key is empty', details: 'Add a valid API key in Settings', latency }
    }

    const keyPrefix = data.value.substring(0, 3)
    if (keyPrefix !== 'sk-') {
      return { name: 'OpenAI Integration', status: 'warning', message: 'OpenAI API key format may be invalid', details: 'Key should start with "sk-"', latency }
    }
    return { name: 'OpenAI Integration', status: 'pass', message: 'OpenAI API key is configured', details: `Key starts with "${keyPrefix}..."`, latency }
  } catch (error) {
    return { name: 'OpenAI Integration', status: 'fail', message: 'Failed to check OpenAI configuration', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 4: Massive.com
async function testMassive(): Promise<DiagnosticResult> {
  const start = Date.now()
  const apiKey = process.env.MASSIVE_API_KEY
  if (!apiKey) {
    return { name: 'Massive.com', status: 'fail', message: 'Massive API key not configured', details: 'Set MASSIVE_API_KEY environment variable', latency: Date.now() - start }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(`https://api.massive.com/v3/reference/tickers/SPY?apiKey=${apiKey}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const latency = Date.now() - start

    if (response.ok) {
      return { name: 'Massive.com', status: 'pass', message: 'Massive.com API is reachable', details: 'SPY ticker lookup succeeded', latency }
    }
    if (response.status === 401 || response.status === 403) {
      return { name: 'Massive.com', status: 'fail', message: 'Massive API key is invalid', details: `API returned ${response.status}`, latency }
    }
    return { name: 'Massive.com', status: 'warning', message: 'Massive.com returned unexpected status', details: `Status: ${response.status}`, latency }
  } catch (error) {
    return { name: 'Massive.com', status: 'fail', message: 'Failed to reach Massive.com', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 5: FRED
async function testFRED(): Promise<DiagnosticResult> {
  const start = Date.now()
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    return { name: 'FRED', status: 'fail', message: 'FRED API key not configured', details: 'Set FRED_API_KEY environment variable', latency: Date.now() - start }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(`https://api.stlouisfed.org/fred/series?series_id=DFF&api_key=${apiKey}&file_type=json`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const latency = Date.now() - start

    if (response.ok) {
      return { name: 'FRED', status: 'pass', message: 'FRED API is reachable', details: 'Federal Funds Rate series lookup succeeded', latency }
    }
    if (response.status === 400 || response.status === 403) {
      return { name: 'FRED', status: 'fail', message: 'FRED API key is invalid', details: `API returned ${response.status}`, latency }
    }
    return { name: 'FRED', status: 'warning', message: 'FRED API returned unexpected status', details: `Status: ${response.status}`, latency }
  } catch (error) {
    return { name: 'FRED', status: 'fail', message: 'Failed to reach FRED API', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 6: FMP
async function testFMP(): Promise<DiagnosticResult> {
  const start = Date.now()
  const apiKey = process.env.FMP_API_KEY
  if (!apiKey) {
    return { name: 'FMP', status: 'fail', message: 'FMP API key not configured', details: 'Set FMP_API_KEY environment variable', latency: Date.now() - start }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(`https://financialmodelingprep.com/api/v3/stock/list?apikey=${apiKey}`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const latency = Date.now() - start

    if (response.ok) {
      return { name: 'FMP', status: 'pass', message: 'FMP API is reachable', details: 'Stock list endpoint responded', latency }
    }
    if (response.status === 401 || response.status === 403) {
      return { name: 'FMP', status: 'fail', message: 'FMP API key is invalid', details: `API returned ${response.status}`, latency }
    }
    return { name: 'FMP', status: 'warning', message: 'FMP API returned unexpected status', details: `Status: ${response.status}`, latency }
  } catch (error) {
    return { name: 'FMP', status: 'fail', message: 'Failed to reach FMP API', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 7: Discord Bot
async function testDiscordBot(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    const { data: tokenData } = await supabase.from('app_settings').select('value').eq('key', 'discord_bot_token').single()
    const { data: guildData } = await supabase.from('app_settings').select('value').eq('key', 'discord_guild_id').single()
    const latency = Date.now() - start

    const hasToken = tokenData?.value && tokenData.value.length > 0
    const hasGuild = guildData?.value && guildData.value.length > 0

    if (!hasToken && !hasGuild) {
      return { name: 'Discord Bot', status: 'fail', message: 'Discord not configured', details: 'Add discord_bot_token and discord_guild_id in Settings', latency }
    }
    if (!hasToken) {
      return { name: 'Discord Bot', status: 'warning', message: 'Discord bot token not set', details: 'Guild ID is set but bot token is missing', latency }
    }
    if (!hasGuild) {
      return { name: 'Discord Bot', status: 'warning', message: 'Discord guild ID not set', details: 'Bot token is set but guild ID is missing', latency }
    }
    return { name: 'Discord Bot', status: 'pass', message: 'Discord is configured', details: `Guild ID: ${guildData.value.substring(0, 6)}...`, latency }
  } catch (error) {
    return { name: 'Discord Bot', status: 'fail', message: 'Failed to check Discord configuration', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}

// Test 8: Redis
async function testRedis(): Promise<DiagnosticResult> {
  const start = Date.now()
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return { name: 'Redis', status: 'warning', message: 'Redis not configured', details: 'REDIS_URL not set — running without cache', latency: Date.now() - start }
  }

  try {
    // Probe via backend health endpoint
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`${backendUrl}/api/health`, { signal: controller.signal })
    clearTimeout(timeout)
    const latency = Date.now() - start

    if (response.ok) {
      return { name: 'Redis', status: 'pass', message: 'Redis is configured and backend is reachable', details: `REDIS_URL is set`, latency }
    }
    return { name: 'Redis', status: 'warning', message: 'Redis configured but backend unreachable', details: `Backend returned ${response.status}`, latency }
  } catch {
    return { name: 'Redis', status: 'warning', message: 'Redis configured but backend unreachable', details: 'Could not reach backend to verify Redis connection', latency: Date.now() - start }
  }
}

// Test 9: Storage
async function testStorage(): Promise<DiagnosticResult> {
  const start = Date.now()
  try {
    const supabase = getSupabaseAdmin()
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    const latency = Date.now() - start

    if (listError) {
      return { name: 'Storage', status: 'fail', message: 'Failed to access storage', details: listError.message, latency }
    }

    const journalBucket = buckets?.find(b =>
      b.name === 'trading-journal-screenshots' ||
      b.name === 'journal-screenshots' ||
      b.name.includes('journal')
    )

    if (!journalBucket) {
      return { name: 'Storage', status: 'warning', message: 'Journal screenshots bucket not found', details: `Found ${buckets?.length || 0} bucket(s): ${buckets?.map(b => b.name).join(', ') || 'none'}`, latency }
    }
    return { name: 'Storage', status: 'pass', message: 'Storage is accessible', details: `Bucket "${journalBucket.name}" found`, latency }
  } catch (error) {
    return { name: 'Storage', status: 'fail', message: 'Failed to check storage', details: error instanceof Error ? error.message : 'Unknown error', latency: Date.now() - start }
  }
}
