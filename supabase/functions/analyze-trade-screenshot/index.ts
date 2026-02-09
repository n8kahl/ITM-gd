import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://www.tradeinthemoney.com').split(',')

// Rate limit: max 5 analysis requests per minute per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

async function verifyJWT(req: Request, supabaseClient: any): Promise<{ user: any; error: string | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabaseClient.auth.getUser(token)

  if (error || !user) {
    return { user: null, error: 'Invalid or expired token' }
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

function sanitizeInput(input: string | undefined, maxLength: number): string {
  if (!input) return ''
  return input.substring(0, maxLength).trim()
}

const TRADING_ANALYSIS_PROMPT = `You are an expert trading coach analyzing a trading chart screenshot. Your role is to provide constructive, educational feedback to help the trader improve.

Analyze this trading chart and provide feedback in the following JSON structure:

{
  "summary": "One sentence overview of the trade quality",
  "trend_analysis": {
    "direction": "bullish | bearish | sideways",
    "strength": "strong | moderate | weak",
    "notes": "Brief explanation of the current trend"
  },
  "entry_analysis": {
    "quality": "excellent | good | fair | poor",
    "observations": ["List of observations about the entry point"],
    "improvements": ["Suggestions for better entry timing"]
  },
  "exit_analysis": {
    "quality": "excellent | good | fair | poor",
    "observations": ["Observations about exit, if visible"],
    "improvements": ["Suggestions for exit strategy"]
  },
  "risk_management": {
    "score": 1-10,
    "observations": ["What they did well or poorly with risk"],
    "suggestions": ["Specific risk management improvements"]
  },
  "market_structure": {
    "key_levels": ["Support/resistance levels identified"],
    "patterns": ["Chart patterns visible"],
    "notes": "Overall market structure assessment"
  },
  "coaching_notes": "2-3 sentences of personalized coaching advice for this specific trade. Be encouraging but honest.",
  "grade": "A+ | A | A- | B+ | B | B- | C+ | C | C- | D | F",
  "tags": ["relevant", "tags", "for", "categorization"]
}

Focus on:
1. Market structure principles (higher highs/lows, trend lines, support/resistance)
2. Entry timing relative to key levels
3. Position sizing and risk-reward ratio if visible
4. Common mistakes like chasing, poor timing, or ignoring structure

Be constructive and educational. The goal is to help the trader learn, not to criticize harshly.`

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const headers = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify JWT — userId is ALWAYS derived from the token, never from the request body
    const { user, error: authError } = await verifyJWT(req, supabase)
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Derive userId from verified JWT — ignore any userId in the request body
    const userId: string = user.id

    // Rate limit per user
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 5 analyses per minute.' }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request - can be JSON with base64 image or form data
    let imageBase64: string
    let entryId: string | null = null
    let additionalContext: string = ''

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      const body = await req.json()
      imageBase64 = body.image // base64 encoded image
      entryId = body.entryId || null
      additionalContext = sanitizeInput(body.context, 1000)

      if (!imageBase64) {
        throw new Error('Image data is required')
      }
      if (imageBase64.length > 5242880) { // 5MB limit
        throw new Error('Image data exceeds maximum size (5MB)')
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const imageFile = formData.get('image') as File
      entryId = formData.get('entryId') as string || null
      additionalContext = sanitizeInput(formData.get('context') as string || '', 1000)

      if (!imageFile) {
        throw new Error('Image file is required')
      }
      if (imageFile.size > 5242880) { // 5MB limit
        throw new Error('Image file exceeds maximum size (5MB)')
      }

      // Convert file to base64
      const arrayBuffer = await imageFile.arrayBuffer()
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    } else {
      throw new Error('Invalid content type. Use application/json or multipart/form-data')
    }

    // Determine image type from base64 header or default to jpeg
    let mediaType = 'image/jpeg'
    if (imageBase64.startsWith('/9j/')) {
      mediaType = 'image/jpeg'
    } else if (imageBase64.startsWith('iVBOR')) {
      mediaType = 'image/png'
    } else if (imageBase64.startsWith('R0lGO')) {
      mediaType = 'image/gif'
    } else if (imageBase64.startsWith('UklGR')) {
      mediaType = 'image/webp'
    }

    // Build the prompt with any additional context
    let prompt = TRADING_ANALYSIS_PROMPT
    if (additionalContext) {
      prompt += `\n\nAdditional context from the trader:\n${additionalContext}`
    }

    // Call OpenAI GPT-4 Vision
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const analysisText = openaiData.choices[0].message.content

    // Parse the JSON response
    let analysis: any
    try {
      analysis = JSON.parse(analysisText)
    } catch {
      // If JSON parsing fails, wrap the text response
      analysis = {
        summary: analysisText,
        coaching_notes: analysisText,
        grade: 'N/A',
        error: 'Could not parse structured response',
      }
    }

    // Add metadata
    analysis.analyzed_at = new Date().toISOString()
    analysis.model = 'gpt-4o'

    // If entryId provided, update the journal entry with analysis
    // Always scope to the authenticated user's entries
    if (entryId) {
      const { error: updateError } = await supabase
        .from('trading_journal_entries')
        .update({
          ai_analysis: analysis,
          tags: analysis.tags || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', entryId)
        .eq('user_id', userId)

      if (updateError) {
        console.error('Failed to update journal entry:', updateError)
        // Don't throw - still return the analysis
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        entryId,
      }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
