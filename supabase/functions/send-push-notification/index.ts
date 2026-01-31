import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ntfy.sh topic - set via environment variable or use default
const NTFY_TOPIC = Deno.env.get('NTFY_TOPIC') || 'tradeitm-alerts'
const NTFY_SERVER = Deno.env.get('NTFY_SERVER') || 'https://ntfy.sh'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { conversationId, reason, leadScore, visitorName, visitorId } = await req.json()

    // Determine notification priority and emoji based on context
    const isHighValue = leadScore && leadScore >= 7
    const emoji = isHighValue ? '🔥' : '🚨'
    const priority = isHighValue ? 'urgent' : 'high'

    // Build notification title and message
    const title = isHighValue
      ? `${emoji} High-Value Lead!`
      : `${emoji} Chat Escalated`

    const name = visitorName || `Visitor ${visitorId?.slice(0, 8) || 'Unknown'}`
    const message = reason
      ? `${name}: ${reason}${isHighValue ? ` • Lead Score: ${leadScore}` : ''}`
      : `${name} needs assistance${isHighValue ? ` • Lead Score: ${leadScore}` : ''}`

    // Send to ntfy.sh
    const ntfyResponse = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': isHighValue ? 'fire,dollar' : 'rotating_light,speech_balloon',
        'Click': `https://trade-itm-prod.up.railway.app/admin/chat`,
        'Actions': `view, Open Chat, https://trade-itm-prod.up.railway.app/admin/chat, clear=true`
      },
      body: message
    })

    if (!ntfyResponse.ok) {
      throw new Error(`ntfy.sh error: ${ntfyResponse.statusText}`)
    }

    console.log(`Push notification sent to ntfy.sh topic: ${NTFY_TOPIC}`)

    return new Response(
      JSON.stringify({
        success: true,
        topic: NTFY_TOPIC,
        title,
        message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
