import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * AI Trade Analysis API
 * Analyzes trading screenshots using OpenAI GPT-4o-mini
 * Extracts trade data: symbol, direction, entry/exit prices, P&L
 */

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Call OpenAI API with vision model
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional trading analyst. Analyze trading screenshots and extract key trade information.

Return ONLY valid JSON in this exact format:
{
  "symbol": "TICKER",
  "direction": "long" or "short",
  "entry_price": number,
  "exit_price": number,
  "pnl": number,
  "pnl_percentage": number,
  "analysis_summary": "Brief 2-3 sentence summary of the trade"
}

If you cannot determine a value, use null. Ensure all numeric values are numbers, not strings.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this trading chart. Extract the symbol, trade direction (long/short), entry price, exit price, P&L amount, and P&L percentage. Provide a brief analysis.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to analyze image', details: errorText },
        { status: openaiResponse.status }
      )
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No analysis generated' },
        { status: 500 }
      )
    }

    // Parse the JSON response from OpenAI
    let analysisResult
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        analysisResult = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content)
      return NextResponse.json(
        {
          error: 'Failed to parse analysis',
          raw_response: content,
          symbol: null,
          direction: null,
          entry_price: null,
          exit_price: null,
          pnl: null,
          pnl_percentage: null,
          analysis_summary: 'Could not extract trade data from image.'
        },
        { status: 200 }
      )
    }

    // Validate and normalize the response
    const result = {
      symbol: analysisResult.symbol || null,
      direction: analysisResult.direction?.toLowerCase() || null,
      entry_price: typeof analysisResult.entry_price === 'number' ? analysisResult.entry_price : null,
      exit_price: typeof analysisResult.exit_price === 'number' ? analysisResult.exit_price : null,
      pnl: typeof analysisResult.pnl === 'number' ? analysisResult.pnl : null,
      pnl_percentage: typeof analysisResult.pnl_percentage === 'number' ? analysisResult.pnl_percentage : null,
      analysis_summary: analysisResult.analysis_summary || 'Trade analysis completed.'
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Trade analysis error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
