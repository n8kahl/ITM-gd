import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * AI Trade Analysis API
 * Analyzes trading screenshots using OpenAI GPT-4o-mini
 * Extracts trade data: symbol, direction, entry/exit prices, P&L
 *
 * Accepts imageUrl as either:
 *   - An HTTPS URL (e.g. Supabase Storage signed URL)
 *   - A base64 data URL (data:image/png;base64,...)
 *
 * Rate limited: 10 requests per user per hour.
 */

const MAX_BASE64_SIZE = 5 * 1024 * 1024 // 5MB decoded
const OPENAI_TIMEOUT_MS = 30_000

/**
 * Validate the imageUrl input.
 * Returns null if valid, or an error string if invalid.
 */
function validateImageUrl(imageUrl: string): string | null {
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
    return 'imageUrl is required'
  }

  // Reject blob: URLs — they are not server-accessible
  if (imageUrl.startsWith('blob:')) {
    return 'blob: URLs are not supported. Upload the image first.'
  }

  // Accept base64 data URLs
  if (imageUrl.startsWith('data:image/')) {
    const match = imageUrl.match(/^data:image\/(png|jpeg|webp);base64,/)
    if (!match) {
      return 'Invalid data URL. Supported formats: PNG, JPEG, WebP.'
    }
    // Check approximate decoded size (base64 is ~4/3x the original)
    const base64Part = imageUrl.split(',')[1]
    if (base64Part) {
      const estimatedBytes = (base64Part.length * 3) / 4
      if (estimatedBytes > MAX_BASE64_SIZE) {
        return 'Image too large. Maximum size is 5MB.'
      }
    }
    return null
  }

  // Accept HTTPS URLs only
  try {
    const parsed = new URL(imageUrl)
    if (parsed.protocol !== 'https:') {
      return 'Only HTTPS URLs are accepted.'
    }
  } catch {
    return 'Invalid URL format.'
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    // 1) Authenticate
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    // 2) Rate limit (per user)
    const rateCheck = await checkRateLimit(user.id, RATE_LIMITS.analyzeScreenshot)
    if (!rateCheck.success) {
      const retryAfterSec = Math.ceil((rateCheck.resetAt - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. You can analyze up to 10 screenshots per hour.',
          retryAfterSeconds: retryAfterSec,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSec) },
        },
      )
    }

    // 3) Parse & validate input
    const body = await request.json()
    const { imageUrl } = body

    const validationError = validateImageUrl(imageUrl)
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 },
      )
    }

    // 4) Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Analysis service is temporarily unavailable.' },
        { status: 503 },
      )
    }

    // 5) Call OpenAI with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    let openaiResponse: Response
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
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

If you cannot determine a value, use null. Ensure all numeric values are numbers, not strings.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this trading chart. Extract the symbol, trade direction (long/short), entry price, exit price, P&L amount, and P&L percentage. Provide a brief analysis.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      })
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('OpenAI request timed out')
        return NextResponse.json(
          { error: 'Analysis timed out. Please try again.' },
          { status: 503 },
        )
      }
      throw fetchError
    } finally {
      clearTimeout(timeout)
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', openaiResponse.status, errorText)

      // Map OpenAI status to user-facing error
      if (openaiResponse.status === 429) {
        return NextResponse.json(
          { error: 'Analysis service is busy. Please try again in a moment.' },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: 'Failed to analyze image. Please try again.' },
        { status: 502 },
      )
    }

    // 6) Parse OpenAI response
    const openaiData = await openaiResponse.json()
    const content = openaiData.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'No analysis generated' },
        { status: 500 },
      )
    }

    let analysisResult
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0])
      } else {
        analysisResult = JSON.parse(content)
      }
    } catch {
      console.error('Failed to parse OpenAI response:', content)
      return NextResponse.json(
        {
          symbol: null,
          direction: null,
          entry_price: null,
          exit_price: null,
          pnl: null,
          pnl_percentage: null,
          analysis_summary: 'Could not extract trade data from image.',
        },
        { status: 200 },
      )
    }

    // 7) Normalize and return
    const result = {
      symbol: analysisResult.symbol || null,
      direction: analysisResult.direction?.toLowerCase() || null,
      entry_price: typeof analysisResult.entry_price === 'number' ? analysisResult.entry_price : null,
      exit_price: typeof analysisResult.exit_price === 'number' ? analysisResult.exit_price : null,
      pnl: typeof analysisResult.pnl === 'number' ? analysisResult.pnl : null,
      pnl_percentage: typeof analysisResult.pnl_percentage === 'number' ? analysisResult.pnl_percentage : null,
      analysis_summary: analysisResult.analysis_summary || 'Trade analysis completed.',
      remaining_analyses: rateCheck.remaining,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Trade analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
