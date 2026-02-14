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

export type ScreenshotIntent =
  | 'single_position'
  | 'portfolio'
  | 'options_chain'
  | 'pnl_card'
  | 'chart'
  | 'unknown';

export type ScreenshotActionId =
  | 'add_to_monitor'
  | 'log_trade'
  | 'analyze_next_steps'
  | 'create_setup'
  | 'set_alert'
  | 'review_journal_context';

export interface SuggestedAction {
  id: ScreenshotActionId;
  label: string;
  description: string;
}

export interface ScreenshotAnalysis {
  positions: ExtractedPosition[];
  broker?: string;
  accountValue?: number;
  rawText?: string;
  intent: ScreenshotIntent;
  suggestedActions: SuggestedAction[];
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
- intent: one of "single_position", "portfolio", "options_chain", "pnl_card", "chart", "unknown"

Choose 2-4 suggested action IDs based on what the user should do next:
- add_to_monitor
- log_trade
- analyze_next_steps
- create_setup
- set_alert
- review_journal_context

Respond ONLY with valid JSON in this exact format:
{
  "positions": [...],
  "broker": "platform name or null",
  "accountValue": number or null,
  "intent": "single_position | portfolio | options_chain | pnl_card | chart | unknown",
  "suggestedActions": ["add_to_monitor", "log_trade"],
  "warnings": ["any issues or uncertainties"]
}

If you cannot identify any positions, return an empty positions array with a warning explaining why.
Important: Be conservative with confidence scores. Only use >0.8 if you're very sure about every field.`;

const ACTION_DETAILS: Record<ScreenshotActionId, { label: string; description: string }> = {
  add_to_monitor: {
    label: 'Add To Monitor',
    description: 'Track these positions and watch risk in real time.',
  },
  log_trade: {
    label: 'Log Trade',
    description: 'Create or update journal entries from this screenshot.',
  },
  analyze_next_steps: {
    label: 'Analyze Next Steps',
    description: 'Get a tactical next-step plan based on current position context.',
  },
  create_setup: {
    label: 'Create Setup',
    description: 'Convert this into a structured setup with entry/stop/target.',
  },
  set_alert: {
    label: 'Set Alert',
    description: 'Create alerts around key prices or strikes from this screenshot.',
  },
  review_journal_context: {
    label: 'Review Journal Context',
    description: 'Compare this screenshot with your recent journal patterns.',
  },
};

const ALLOWED_ACTIONS = new Set<ScreenshotActionId>(Object.keys(ACTION_DETAILS) as ScreenshotActionId[]);
const ALLOWED_INTENTS = new Set<ScreenshotIntent>([
  'single_position',
  'portfolio',
  'options_chain',
  'pnl_card',
  'chart',
  'unknown',
]);

function inferIntent(intent: unknown, positions: ExtractedPosition[]): ScreenshotIntent {
  const normalized = typeof intent === 'string' ? intent.trim().toLowerCase() : '';
  if (ALLOWED_INTENTS.has(normalized as ScreenshotIntent)) {
    return normalized as ScreenshotIntent;
  }
  return positions.length > 1 ? 'portfolio' : positions.length === 1 ? 'single_position' : 'unknown';
}

function defaultActions(intent: ScreenshotIntent, positions: ExtractedPosition[]): ScreenshotActionId[] {
  if (positions.length > 0) {
    if (intent === 'portfolio') {
      return ['add_to_monitor', 'analyze_next_steps', 'review_journal_context'];
    }
    return ['add_to_monitor', 'log_trade', 'analyze_next_steps'];
  }

  if (intent === 'options_chain') return ['create_setup', 'set_alert', 'analyze_next_steps'];
  if (intent === 'pnl_card') return ['log_trade', 'analyze_next_steps', 'review_journal_context'];
  if (intent === 'chart') return ['create_setup', 'set_alert', 'analyze_next_steps'];
  return ['analyze_next_steps'];
}

function normalizeActions(
  suggestedActions: unknown,
  intent: ScreenshotIntent,
  positions: ExtractedPosition[],
): SuggestedAction[] {
  const parsedIds = Array.isArray(suggestedActions)
    ? suggestedActions
      .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
      .filter((value): value is ScreenshotActionId => ALLOWED_ACTIONS.has(value as ScreenshotActionId))
    : [];

  const actionIds = (parsedIds.length > 0 ? parsedIds : defaultActions(intent, positions))
    .slice(0, 4);
  const deduped = Array.from(new Set(actionIds));

  return deduped.map((id) => ({
    id,
    label: ACTION_DETAILS[id].label,
    description: ACTION_DETAILS[id].description,
  }));
}

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
          intent: 'unknown',
          suggestedActions: normalizeActions([], 'unknown', []),
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
    const intent = inferIntent(parsed.intent, positions);

    return {
      positions,
      broker: parsed.broker || undefined,
      accountValue: parsed.accountValue ? Number(parsed.accountValue) : undefined,
      intent,
      suggestedActions: normalizeActions(parsed.suggestedActions, intent, positions),
      warnings: parsed.warnings || [],
    };
  } catch (error: any) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        positions: [],
        intent: 'unknown',
        suggestedActions: normalizeActions([], 'unknown', []),
        warnings: ['Failed to parse Vision API response as JSON'],
      };
    }
    throw new Error(`Screenshot analysis failed: ${error.message}`);
  }
}
