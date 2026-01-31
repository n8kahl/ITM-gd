import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversationId, reason, leadScore, visitorName, visitorId, isNewConversation } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      adminUrl: 'https://trade-itm-prod.up.railway.app/admin/chat',
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
