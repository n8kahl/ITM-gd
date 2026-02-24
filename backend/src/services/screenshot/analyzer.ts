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
  | 'suggest_alerts'
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
- suggest_alerts
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
  suggest_alerts: {
    label: 'Suggest Alerts',
    description: 'Generate practical alert levels around key prices or strikes from this screenshot.',
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

  if (intent === 'options_chain') return ['create_setup', 'suggest_alerts', 'analyze_next_steps'];
  if (intent === 'pnl_card') return ['log_trade', 'analyze_next_steps', 'review_journal_context'];
  if (intent === 'chart') return ['create_setup', 'suggest_alerts', 'analyze_next_steps'];
  return ['analyze_next_steps'];
}

function normalizeActions(
  suggestedActions: unknown,
  intent: ScreenshotIntent,
  positions: ExtractedPosition[],
): SuggestedAction[] {
  const parsedIds = Array.isArray(suggestedActions)
    ? suggestedActions
      .map((value) => {
        if (typeof value !== 'string') return '';
        const normalized = value.trim().toLowerCase();
        if (normalized === 'set_alert') return 'suggest_alerts';
        return normalized;
      })
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

function normalizePosition(value: unknown): ExtractedPosition | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  const symbol = String(raw.symbol ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9./]/g, '')
    .slice(0, 16);

  if (!symbol) return null;

  const typeCandidate = typeof raw.type === 'string' ? raw.type.trim().toLowerCase() : '';
  const type: ExtractedPosition['type'] = (typeCandidate === 'call' || typeCandidate === 'put' || typeCandidate === 'stock')
    ? typeCandidate
    : 'stock';

  const quantityParsed = Number(raw.quantity);
  const quantity = Number.isFinite(quantityParsed) && quantityParsed !== 0
    ? quantityParsed
    : 1;

  const entryPriceParsed = Number(raw.entryPrice);
  const entryPrice = Number.isFinite(entryPriceParsed) && entryPriceParsed >= 0
    ? entryPriceParsed
    : 0;

  const strikeParsed = Number(raw.strike);
  const strike = Number.isFinite(strikeParsed) && strikeParsed > 0
    ? strikeParsed
    : undefined;

  const currentPriceParsed = Number(raw.currentPrice);
  const currentPrice = Number.isFinite(currentPriceParsed)
    ? currentPriceParsed
    : undefined;

  const pnlParsed = Number(raw.pnl);
  const pnl = Number.isFinite(pnlParsed)
    ? pnlParsed
    : undefined;

  const confidenceParsed = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceParsed)
    ? Math.max(0, Math.min(1, confidenceParsed))
    : 0.35;

  const expiryRaw = typeof raw.expiry === 'string' ? raw.expiry.trim() : '';
  const expiry = expiryRaw.length > 0 ? expiryRaw.slice(0, 10) : undefined;

  return {
    symbol,
    type,
    strike,
    expiry,
    quantity,
    entryPrice,
    currentPrice,
    pnl,
    confidence,
  };
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
    const rawPositions: unknown[] = Array.isArray(parsed.positions) ? parsed.positions : [];
    const positions = rawPositions
      .map((position: unknown) => normalizePosition(position))
      .filter((position: ExtractedPosition | null): position is ExtractedPosition => Boolean(position));
    const intent = inferIntent(parsed.intent, positions);
    const warnings = Array.isArray(parsed.warnings)
      ? (parsed.warnings as unknown[])
        .map((warning: unknown) => String(warning).trim())
        .filter((warning: string) => warning.length > 0)
        .slice(0, 10)
      : [];

    if (rawPositions.length > 0 && positions.length === 0) {
      warnings.push('Positions were detected but could not be normalized safely.');
    }

    const accountValueParsed = Number(parsed.accountValue);
    const accountValue = Number.isFinite(accountValueParsed) ? accountValueParsed : undefined;

    return {
      positions,
      broker: parsed.broker || undefined,
      accountValue,
      intent,
      suggestedActions: normalizeActions(parsed.suggestedActions, intent, positions),
      warnings,
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
