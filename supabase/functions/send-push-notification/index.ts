import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://www.tradeinthemoney.com').split(',')

// Rate limit: max 10 notifications per minute per caller
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

async function verifyTeamMember(req: Request, supabase: any): Promise<{ user: any; error: string | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' }
  }

  // Must be admin or explicit team member.
  const isAdmin = user.app_metadata?.is_admin === true

  let isTeamMember = false
  if (!isAdmin) {
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (teamError) {
      console.warn('[send-push-notification] Team member lookup failed:', teamError.message)
    } else {
      isTeamMember = Boolean(teamMember?.id)
    }
  }

  if (!isAdmin && !isTeamMember) {
    return { user: null, error: 'Forbidden: team member access required' }
  }

  return { user, error: null }
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify caller is an authenticated team member or admin
    const { user, error: authError } = await verifyTeamMember(req, supabase)
    if (authError) {
      const status = authError.includes('Forbidden') ? 403 : 401
      return new Response(
        JSON.stringify({ error: authError }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status }
      )
    }

    // Rate limit per user
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 10 notifications per minute.' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    const { conversationId, reason, leadScore, visitorName, visitorId, isNewConversation } = await req.json()

    // Get Zapier webhook URL from app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'zapier_webhook_url')
      .single()

    const zapierWebhookUrl = setting?.value

    if (!zapierWebhookUrl) {
      console.log('Zapier webhook URL not configured in settings - skipping SMS notification')
      return new Response(
        JSON.stringify({ success: true, message: 'Zapier webhook not configured' }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Get team members who have phone numbers
    const { data: teamMembers } = await supabase
      .from('team_members')
      .select('phone_number, display_name')
      .not('phone_number', 'is', null)

    const phoneNumbers = teamMembers
      ?.filter(m => m.phone_number && m.phone_number.trim())
      .map(m => m.phone_number) || []

    if (phoneNumbers.length === 0) {
      console.log('No team members have phone numbers configured')
      return new Response(
        JSON.stringify({ success: true, message: 'No phone numbers to notify' }),
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Build notification details
    const name = visitorName || 'Visitor'
    const isHighValue = leadScore && leadScore >= 7

    let notificationType: string
    let message: string

    if (isNewConversation) {
      notificationType = 'new_conversation'
      message = `New chat from ${name}`
      if (isHighValue) message += ` (High-value lead: ${leadScore})`
    } else {
      notificationType = 'escalation'
      message = `Chat escalated: ${name}`
      if (reason) message += ` - ${reason}`
      if (isHighValue) message += ` (Lead score: ${leadScore})`
    }

    // Send to Zapier webhook
    const zapierPayload = {
      type: notificationType,
      message,
      phoneNumbers,
      conversationId,
      visitorName: name,
      visitorId,
      leadScore: leadScore || 0,
      reason: reason || null,
      isHighValue,
      timestamp: new Date().toISOString()
    }

    const zapierResponse = await fetch(zapierWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zapierPayload)
    })

    if (!zapierResponse.ok) {
      throw new Error(`Zapier webhook failed: ${zapierResponse.statusText}`)
    }

    console.log(`Notification sent to Zapier for ${phoneNumbers.length} phone number(s)`)

    return new Response(
      JSON.stringify({
        success: true,
        phoneNumberCount: phoneNumbers.length,
        notificationType
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending notification:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
