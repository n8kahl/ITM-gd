import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://www.tradeinthemoney.com').split(',')
const APP_URL = (Deno.env.get('APP_URL') || 'https://tradeitm.com').replace(/\/+$/, '')

// Rate limit: max 20 notifications per minute per caller
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
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
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    // Rate limit by IP (this is a public-facing contact/application form endpoint)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown'
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    const payload: NotificationPayload = await req.json()
    const { type, name, email, phone, message, source, metadata, submission_id } = payload

    // Validate required fields
    if (!type || !name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, name, email, message' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Validate type
    const allowedTypes = ['contact', 'application', 'cohort_application']
    if (!allowedTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid notification type' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 400 }
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
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Determine notification type
    const isCohortApplication = type === 'cohort_application'
    const isLegacyApplication = type === 'application'

    // Embed colors
    const embedColor = isCohortApplication ? 1095553 : (isLegacyApplication ? 15262937 : 3899126)

    const title = isCohortApplication
      ? '🎯 Precision Cohort Application'
      : isLegacyApplication
        ? '🎯 New Precision Cohort Application'
        : '📬 New Contact Inquiry'

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '👤 Name', value: name.substring(0, 256), inline: true },
      { name: '📧 Email', value: email.substring(0, 256), inline: true },
    ]

    // Add rich metadata fields for cohort applications
    if (isCohortApplication && metadata) {
      if (metadata.discord_handle) {
        fields.push({ name: '💬 Discord', value: metadata.discord_handle.substring(0, 256), inline: true })
      }
      if (metadata.experience_level) {
        fields.push({ name: '📊 Experience', value: metadata.experience_level.substring(0, 256), inline: true })
      }
      if (metadata.account_size) {
        const isHighValue = metadata.account_size === '$25k+'
        const valueDisplay = isHighValue ? `${metadata.account_size} 💰` : metadata.account_size
        fields.push({ name: '💵 Capital', value: valueDisplay.substring(0, 256), inline: true })
      }
      if (metadata.primary_struggle) {
        fields.push({ name: '🎯 Struggle', value: metadata.primary_struggle.substring(0, 256), inline: true })
      }
      if (metadata.short_term_goal) {
        const truncatedGoal = metadata.short_term_goal.length > 500
          ? metadata.short_term_goal.substring(0, 497) + '...'
          : metadata.short_term_goal
        fields.push({ name: '🏆 12-Month Goal', value: truncatedGoal, inline: false })
      }
    } else {
      if (phone) {
        fields.push({ name: '📱 Phone', value: phone.substring(0, 20), inline: true })
      }
      if (source) {
        fields.push({ name: '📍 Source', value: source.substring(0, 256), inline: true })
      }
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

    if (submission_id && /^[0-9a-f-]{36}$/i.test(submission_id)) {
      const leadsUrl = `${APP_URL}/admin/leads?highlight=${submission_id}`
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
        { headers: { ...headers, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Discord notification sent: ${type} from ${name}`)

    return new Response(
      JSON.stringify({ success: true, type }),
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
