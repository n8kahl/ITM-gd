import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ApplicationMetadata {
  discord_handle?: string
  experience_level?: string
  account_size?: string
  primary_struggle?: string
  short_term_goal?: string
  source?: string
}

interface NotificationPayload {
  type: 'contact' | 'application' | 'cohort_application'
  name: string
  email: string
  phone?: string
  message: string
  source?: string
  metadata?: ApplicationMetadata
  submission_id?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload: NotificationPayload = await req.json()
    const { type, name, email, phone, message, source, metadata, submission_id } = payload

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

    // Determine notification type
    const isCohortApplication = type === 'cohort_application'
    const isLegacyApplication = type === 'application'
    const isAnyApplication = isCohortApplication || isLegacyApplication

    // Note: cohort_applications insert is now handled directly in addContactSubmission()
    // This function only handles Discord notifications

    // Embed colors
    // Gold (#D4AF37 = 13938487) for cohort applications
    // Champagne (#E8E4D9 = 15262937) for legacy applications
    // Blue (#3B82F6 = 3899126) for contacts
    const embedColor = isCohortApplication ? 13938487 : (isLegacyApplication ? 15262937 : 3899126)

    const title = isCohortApplication
      ? '🎯 Precision Cohort Application'
      : isLegacyApplication
        ? '🎯 New Precision Cohort Application'
        : '📬 New Contact Inquiry'

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '👤 Name', value: name, inline: true },
      { name: '📧 Email', value: email, inline: true },
    ]

    // Add rich metadata fields for cohort applications
    if (isCohortApplication && metadata) {
      if (metadata.discord_handle) {
        fields.push({ name: '💬 Discord', value: metadata.discord_handle, inline: true })
      }
      if (metadata.experience_level) {
        fields.push({ name: '📊 Experience', value: metadata.experience_level, inline: true })
      }
      if (metadata.account_size) {
        // Highlight high-value applicants
        const isHighValue = metadata.account_size === '$25k+'
        const valueDisplay = isHighValue ? `${metadata.account_size} 💰` : metadata.account_size
        fields.push({ name: '💵 Capital', value: valueDisplay, inline: true })
      }
      if (metadata.primary_struggle) {
        fields.push({ name: '🎯 Struggle', value: metadata.primary_struggle, inline: true })
      }
      if (metadata.short_term_goal) {
        const truncatedGoal = metadata.short_term_goal.length > 500
          ? metadata.short_term_goal.substring(0, 497) + '...'
          : metadata.short_term_goal
        fields.push({ name: '🏆 12-Month Goal', value: truncatedGoal, inline: false })
      }
    } else {
      // Legacy format - add phone and source
      if (phone) {
        fields.push({ name: '📱 Phone', value: phone, inline: true })
      }
      if (source) {
        fields.push({ name: '📍 Source', value: source, inline: true })
      }
      // Truncate message if too long (Discord limit is 1024 for field values)
      const truncatedMessage = message.length > 800
        ? message.substring(0, 797) + '...'
        : message
      fields.push({ name: '💬 Message', value: truncatedMessage, inline: false })
    }

    // Build embed
    const embed: Record<string, unknown> = {
      title,
      color: embedColor,
      fields,
      timestamp: new Date().toISOString(),
    }

    // Add footer based on type
    if (isCohortApplication) {
      const isHighValue = metadata?.account_size === '$25k+'
      embed.footer = {
        text: isHighValue
          ? '🔥 Lead Score: HIGH (Application + $25k+) - Priority Response'
          : '⭐ Lead Score: HIGH (Application) - Respond within 24 hours'
      }
    } else if (isLegacyApplication) {
      embed.footer = { text: '⭐ High-value lead - Respond within 24 hours' }
    }

    // Add admin panel link (admin must be logged in via Discord OAuth)
    if (submission_id) {
      const leadsUrl = `https://trade-itm-prod.up.railway.app/admin/leads?highlight=${submission_id}`
      embed.description = `[📋 Quick Review in Admin Panel](${leadsUrl})`
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
