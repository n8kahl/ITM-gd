import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key)
}

// Get user ID from request
function getUserId(request: NextRequest): string {
  const cookies = request.cookies
  const memberCookie = cookies.get('titm_member')

  if (memberCookie) {
    try {
      const session = JSON.parse(memberCookie.value)
      return session.id
    } catch {
      // Fall through
    }
  }

  return 'demo_user'
}

// POST - Analyze a trade screenshot using AI
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request)
    const openaiKey = process.env.OPENAI_API_KEY

    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    let imageBase64: string
    let entryId: string | null = null
    let additionalContext: string = ''

    if (contentType.includes('application/json')) {
      const body = await request.json()
      imageBase64 = body.image
      entryId = body.entryId || null
      additionalContext = body.context || ''

      if (!imageBase64) {
        return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const imageFile = formData.get('image') as File
      entryId = formData.get('entryId') as string || null
      additionalContext = formData.get('context') as string || ''

      if (!imageFile) {
        return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
      }

      const arrayBuffer = await imageFile.arrayBuffer()
      imageBase64 = Buffer.from(arrayBuffer).toString('base64')
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Use application/json or multipart/form-data' },
        { status: 400 }
      )
    }

    // Detect media type
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

    // Trading analysis prompt
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
      return NextResponse.json(
        { error: `OpenAI API error: ${openaiResponse.status}` },
        { status: 500 }
      )
    }

    const openaiData = await openaiResponse.json()
    const analysisText = openaiData.choices[0].message.content

    // Parse the JSON response
    let analysis: any
    try {
      analysis = JSON.parse(analysisText)
    } catch {
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
    if (entryId) {
      const supabase = getSupabaseAdmin()
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
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      entryId,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 })
  }
}
