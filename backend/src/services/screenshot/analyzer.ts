import { openaiClient } from '../../config/openai';
import { validateImagePayload } from '../../lib/sanitize-input';

/**
 * Screenshot Position Analyzer
 * Uses OpenAI Vision API to extract trading positions from broker screenshots
 */

export interface ExtractedPosition {
  symbol: string;
  type: 'call' | 'put' | 'stock';
  strike?: number;
  expiry?: string;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  pnl?: number;
  confidence: number; // 0-1 confidence score
}

export interface ScreenshotAnalysis {
  positions: ExtractedPosition[];
  broker?: string;
  accountValue?: number;
  rawText?: string;
  warnings: string[];
}

const EXTRACTION_PROMPT = `You are an expert at reading trading platform screenshots. Analyze this image and extract all visible trading positions.

For each position found, provide:
- symbol: The underlying symbol (e.g., SPX, NDX, AAPL)
- type: "call", "put", or "stock"
- strike: Strike price (if options)
- expiry: Expiration date in YYYY-MM-DD format (if options)
- quantity: Number of contracts (positive = long, negative = short)
- entryPrice: Entry/average cost per contract
- currentPrice: Current market price per contract (if visible)
- pnl: Profit/Loss in dollars (if visible)
- confidence: Your confidence in this extraction (0.0 to 1.0)

Also identify:
- broker: The trading platform name (TastyTrade, Thinkorswim, IBKR, Robinhood, Webull, etc.)
- accountValue: Total account value if visible

Respond ONLY with valid JSON in this exact format:
{
  "positions": [...],
  "broker": "platform name or null",
  "accountValue": number or null,
  "warnings": ["any issues or uncertainties"]
}

If you cannot identify any positions, return an empty positions array with a warning explaining why.
Important: Be conservative with confidence scores. Only use >0.8 if you're very sure about every field.`;

/**
 * Analyze a broker screenshot to extract positions
 */
export async function analyzeScreenshot(
  imageBase64: string,
  mimeType: string = 'image/png'
): Promise<ScreenshotAnalysis> {
  try {
    const imagePayload = `data:${mimeType};base64,${imageBase64}`;
    if (!validateImagePayload(imagePayload)) {
      throw new Error('Invalid image payload');
    }

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: imagePayload,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for accuracy
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        positions: [],
        warnings: ['No response from Vision API'],
      };
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate and sanitize
      const positions: ExtractedPosition[] = (parsed.positions || []).map((p: any) => ({
        symbol: String(p.symbol || '').toUpperCase(),
        type: ['call', 'put', 'stock'].includes(p.type)
          ? p.type
          : 'call',
      strike: p.strike ? Number(p.strike) : undefined,
      expiry: p.expiry || undefined,
      quantity: Number(p.quantity) || 1,
      entryPrice: Number(p.entryPrice) || 0,
      currentPrice: p.currentPrice ? Number(p.currentPrice) : undefined,
      pnl: p.pnl != null ? Number(p.pnl) : undefined,
      confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0.5)),
    }));

    return {
      positions,
      broker: parsed.broker || undefined,
      accountValue: parsed.accountValue ? Number(parsed.accountValue) : undefined,
      warnings: parsed.warnings || [],
    };
  } catch (error: any) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        positions: [],
        warnings: ['Failed to parse Vision API response as JSON'],
      };
    }
    throw new Error(`Screenshot analysis failed: ${error.message}`);
  }
}
