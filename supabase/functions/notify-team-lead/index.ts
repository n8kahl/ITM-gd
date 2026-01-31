import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  type: 'contact' | 'application'
  name: string
  email: string
  phone?: string
  message: string
  source?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload: NotificationPayload = await req.json()
    const { type, name, email, phone, message, source } = payload

    // Validate required fields
    if (!type || !name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, name, email, message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Discord webhook URL from app_settings
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'discord_webhook_url')
      .single()

    const webhookUrl = setting?.value
    if (!webhookUrl) {
      console.log('Discord webhook URL not configured - skipping notification')
      return new Response(
        JSON.stringify({ success: true, message: 'Discord webhook not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build Discord embed based on type
    const isApplication = type === 'application'

    // If this is a cohort application, also insert into cohort_applications table
    if (isApplication) {
      const { error: insertError } = await supabase
        .from('cohort_applications')
        .insert({
          name,
          email,
          phone: phone || null,
          message,
          status: 'pending',
        })

      if (insertError) {
        console.error('Failed to insert cohort application:', insertError)
        // Continue with notification even if insert fails
      } else {
        console.log(`Cohort application recorded for ${email}`)
      }
    }

    // Colors: Blue for contacts (#3B82F6 = 3899126), Gold/Champagne for applications (#E8E4D9 = 15262937)
    const embedColor = isApplication ? 15262937 : 3899126

    const title = isApplication
      ? '🎯 New Precision Cohort Application'
      : '📬 New Contact Form Submission'

    const fields = [
      { name: '👤 Name', value: name, inline: true },
      { name: '📧 Email', value: email, inline: true },
    ]

    if (phone) {
      fields.push({ name: '📱 Phone', value: phone, inline: true })
    }

    if (source) {
      fields.push({ name: '📍 Source', value: source, inline: true })
    }

    // Truncate message if too long (Discord limit is 1024 for field values)
    const truncatedMessage = message.length > 1000
      ? message.substring(0, 997) + '...'
      : message

    fields.push({ name: '💬 Message', value: truncatedMessage, inline: false })

    const embed: Record<string, unknown> = {
      title,
      color: embedColor,
      fields,
      timestamp: new Date().toISOString(),
    }

    // Add footer for applications to highlight urgency
    if (isApplication) {
      embed.footer = { text: '⭐ High-value lead - Respond within 24 hours' }
    }

    const discordPayload = {
      embeds: [embed]
    }

    // Send to Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Discord webhook failed:', errorText)
      return new Response(
        JSON.stringify({ success: false, error: 'Discord notification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Discord notification sent: ${type} from ${name}`)

    return new Response(
      JSON.stringify({ success: true, type }),
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
