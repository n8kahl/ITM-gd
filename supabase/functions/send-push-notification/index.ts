import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID keys - you'll need to generate these using web-push
// For now, using placeholder - generate real ones with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || 'wFkz5Nh9BPT5nPXlKIqV0ePKqLiMJq_JuDZ0Cq6v1dw'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversationId, reason, leadScore, visitorId } = await req.json()

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all push subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare notification payload
    const notificationPayload = {
      title: '🔔 New Chat Escalation',
      body: reason || 'A visitor requested to speak with someone',
      conversationId,
      url: `/admin/chat?conversation=${conversationId}`,
      leadScore,
      visitorId
    }

    // Send push notification to all subscriptions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await sendPushNotification(
          sub.subscription,
          JSON.stringify(notificationPayload),
          VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY
        )
        return { success: true, userId: sub.user_id }
      } catch (error) {
        console.error(`Failed to send push to ${sub.user_id}:`, error)
        return { success: false, userId: sub.user_id, error: error.message }
      }
    })

    const results = await Promise.all(sendPromises)

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function sendPushNotification(
  subscription: any,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const { endpoint, keys } = subscription

  // Web Push requires signing with VAPID keys
  // For simplicity, we'll use the web-push protocol
  // In production, use a proper web-push library

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'TTL': '86400', // 24 hours
      'Content-Encoding': 'aes128gcm',
    },
    body: payload
  })

  if (!response.ok) {
    throw new Error(`Push failed: ${response.statusText}`)
  }

  return response
}
