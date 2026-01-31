import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
    const { conversationId, reason, leadScore, visitorName, visitorId } = await req.json()

    // Log the escalation for debugging
    console.log('Chat escalation received:', {
      conversationId,
      reason,
      leadScore,
      visitorName,
      visitorId
    })

    // Push notifications disabled - browser notifications are used instead
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Escalation logged. Browser notifications active on admin page.'
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
