import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cron-only endpoint: requires X-Cron-Secret header matching CRON_SECRET env var.
// No CORS needed — this should never be called from a browser.

serve(async (req) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Verify cron secret
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedSecret = req.headers.get('X-Cron-Secret')

    if (!cronSecret) {
      console.error('CRON_SECRET env var not configured')
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!providedSecret || providedSecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the archive function
    const { data, error } = await supabase.rpc('run_archive_job')

    if (error) {
      throw error
    }

    console.log('Archive job completed:', data)

    return new Response(
      JSON.stringify({
        success: true,
        ...data
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Archive job failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
