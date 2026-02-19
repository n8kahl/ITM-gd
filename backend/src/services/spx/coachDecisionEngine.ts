import { createHash } from 'node:crypto';
import { CHAT_MODEL, openaiClient } from '../../config/openai';
import { openaiCircuit } from '../../lib/circuitBreaker';
import { logger } from '../../lib/logger';
import { generateCoachStream } from './aiCoach';
import type {
  CoachDecisionAction,
  CoachDecisionBrief,
  CoachDecisionRequest,
  CoachDecisionSeverity,
  CoachDecisionVerdict,
  CoachMessage,
} from './types';
import { nowIso, round, uuid } from './utils';

const DECISION_TTL_MS = 60_000;
const WHY_LIMIT = 3;
const COACH_DECISION_MAX_TOKENS = 700;
const COACH_DECISION_TEMPERATURE = 0.15;
const COACH_DECISION_MODEL = process.env.SPX_COACH_DECISION_MODEL || CHAT_MODEL;

const VALID_VERDICTS = new Set<CoachDecisionVerdict>(['ENTER', 'WAIT', 'REDUCE', 'EXIT']);
const VALID_SEVERITIES = new Set<CoachDecisionSeverity>(['routine', 'warning', 'critical']);
const VALID_ACTION_IDS = new Set<CoachDecisionAction['id']>([
  'ENTER_TRADE_FOCUS',
  'EXIT_TRADE_FOCUS',
  'REVERT_AI_CONTRACT',
  'TIGHTEN_STOP_GUIDANCE',
  'REDUCE_SIZE_GUIDANCE',
  'ASK_FOLLOW_UP',
  'OPEN_HISTORY',
]);
const VALID_ACTION_STYLES = new Set<CoachDecisionAction['style']>(['primary', 'secondary', 'ghost']);

interface AIDecisionCandidate {
  verdict?: unknown;
  confidence?: unknown;
  primaryText?: unknown;
  why?: unknown;
  riskPlan?: unknown;
  actions?: unknown;
  severity?: unknown;
}

function shouldUseDecisionV2(): boolean {
  return String(process.env.SPX_COACH_DECISION_V2_ENABLED || '').toLowerCase() === 'true';
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function toCompactSentence(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157)}...`;
}

function inferSeverity(messages: CoachMessage[]): CoachDecisionSeverity {
  const hasCritical = messages.some((message) => {
    const severity = message.structuredData?.severity;
    return severity === 'critical';
  });
  if (hasCritical) return 'critical';

  const hasAlert = messages.some((message) => message.priority === 'alert');
  if (hasAlert) return 'warning';

  return 'routine';
}

function inferVerdict(messages: CoachMessage[], request: CoachDecisionRequest): CoachDecisionVerdict {
  const aggregate = messages.map((message) => message.content.toLowerCase()).join(' ');

  if (request.tradeMode === 'in_trade') {
    if (aggregate.includes('exit')) return 'EXIT';
    if (aggregate.includes('tighten') || aggregate.includes('reduce')) return 'REDUCE';
  }

  if (aggregate.includes('entry window open') || aggregate.includes('pre-trade brief')) {
    return 'ENTER';
  }

  if (aggregate.includes('risk reminder') || aggregate.includes('divergence')) {
    return request.tradeMode === 'in_trade' ? 'REDUCE' : 'WAIT';
  }

  return 'WAIT';
}

function inferConfidence(messages: CoachMessage[], verdict: CoachDecisionVerdict): number {
  const setupSignals = messages.filter((message) => message.priority === 'setup').length;
  const alertSignals = messages.filter((message) => message.priority === 'alert').length;

  const base = verdict === 'ENTER'
    ? 72
    : verdict === 'REDUCE'
      ? 70
      : verdict === 'EXIT'
        ? 74
        : 62;

  const adjusted = base + (setupSignals * 4) - (alertSignals * 3);
  return clampConfidence(adjusted);
}

function buildWhy(messages: CoachMessage[]): string[] {
  const lines: string[] = [];

  for (const message of messages) {
    const sentence = toCompactSentence(message.content);
    if (!sentence || lines.includes(sentence)) continue;
    lines.push(sentence);
    if (lines.length >= WHY_LIMIT) break;
  }

  if (lines.length > 0) return lines;
  return ['Coach context is temporarily limited. Use risk-first execution rules.'];
}

function buildPrimaryText(verdict: CoachDecisionVerdict, why: string[]): string {
  if (verdict === 'ENTER') return 'Entry conditions currently favor execution. Validate risk and enter with discipline.';
  if (verdict === 'REDUCE') return 'Risk is elevated. Reduce exposure and protect downside immediately.';
  if (verdict === 'EXIT') return 'Exit is favored on current context. Prioritize capital protection.';
  return why[0] || 'Wait for clearer confirmation before acting.';
}

function buildActions(request: CoachDecisionRequest, verdict: CoachDecisionVerdict): CoachDecisionAction[] {
  const setupId = request.setupId || null;
  const actions: CoachDecisionAction[] = [];

  if (setupId && verdict === 'ENTER') {
    actions.push({
      id: 'ENTER_TRADE_FOCUS',
      label: 'Enter Trade Focus',
      style: 'primary',
      payload: { setupId },
    });
  }

  if (setupId && request.tradeMode !== 'in_trade') {
    actions.push({
      id: 'REVERT_AI_CONTRACT',
      label: 'Use AI Contract',
      style: actions.length === 0 ? 'primary' : 'secondary',
      payload: { setupId },
    });
  }

  if (request.tradeMode === 'in_trade' && (verdict === 'REDUCE' || verdict === 'EXIT')) {
    actions.push({
      id: 'EXIT_TRADE_FOCUS',
      label: verdict === 'EXIT' ? 'Exit Trade Focus' : 'Reduce / Exit Focus',
      style: actions.length === 0 ? 'primary' : 'secondary',
      payload: { setupId },
    });
  }

  actions.push({
    id: 'OPEN_HISTORY',
    label: 'Open Coach History',
    style: actions.length === 0 ? 'primary' : 'ghost',
  });

  return actions.slice(0, 3);
}

function buildContextHash(request: CoachDecisionRequest, messages: CoachMessage[]): string {
  const payload = {
    setupId: request.setupId || null,
    tradeMode: request.tradeMode || null,
    question: request.question || null,
    selectedContract: request.selectedContract || null,
    messageIds: messages.map((message) => message.id),
    lastTimestamp: messages[0]?.timestamp || null,
  };

  const digest = createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');

  return `sha256:${digest}`;
}

function removeCodeFence(input: string): string {
  return input
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeWhy(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const lines = value
    .map((item) => (typeof item === 'string' ? toCompactSentence(item) : ''))
    .filter((item) => item.length > 0)
    .slice(0, WHY_LIMIT);

  return lines.length > 0 ? lines : fallback;
}

function normalizeActions(value: unknown, fallback: CoachDecisionAction[]): CoachDecisionAction[] {
  if (!Array.isArray(value)) return fallback;

  const parsed: CoachDecisionAction[] = [];

  for (const candidate of value) {
    if (!isObject(candidate)) continue;

    const id = candidate.id;
    const label = candidate.label;
    const style = candidate.style;

    if (typeof id !== 'string' || !VALID_ACTION_IDS.has(id as CoachDecisionAction['id'])) continue;
    if (typeof label !== 'string' || label.trim().length === 0) continue;

    const normalizedStyle: CoachDecisionAction['style'] = typeof style === 'string' && VALID_ACTION_STYLES.has(style as CoachDecisionAction['style'])
      ? (style as CoachDecisionAction['style'])
      : 'secondary';

    parsed.push({
      id: id as CoachDecisionAction['id'],
      label: label.trim().slice(0, 42),
      style: normalizedStyle,
      payload: isObject(candidate.payload) ? candidate.payload : undefined,
    });

    if (parsed.length >= 3) break;
  }

  return parsed.length > 0 ? parsed : fallback;
}

function normalizeRiskPlan(value: unknown, fallbackMaxRiskDollars: number | undefined): CoachDecisionBrief['riskPlan'] {
  if (!isObject(value)) {
    return {
      maxRiskDollars: fallbackMaxRiskDollars,
    };
  }

  const invalidation = typeof value.invalidation === 'string' ? toCompactSentence(value.invalidation) : undefined;
  const stop = typeof value.stop === 'number' && Number.isFinite(value.stop) ? value.stop : undefined;
  const maxRiskDollars = typeof value.maxRiskDollars === 'number' && Number.isFinite(value.maxRiskDollars)
    ? value.maxRiskDollars
    : fallbackMaxRiskDollars;
  const positionGuidance = typeof value.positionGuidance === 'string'
    ? toCompactSentence(value.positionGuidance)
    : undefined;

  return {
    invalidation,
    stop,
    maxRiskDollars,
    positionGuidance,
  };
}

function applyGuardrails(brief: CoachDecisionBrief, request: CoachDecisionRequest): CoachDecisionBrief {
  const next = { ...brief };

  if (!request.setupId && next.verdict === 'ENTER') {
    next.verdict = 'WAIT';
    next.primaryText = 'Select a setup first, then re-evaluate entry timing.';
  }

  if (next.verdict === 'ENTER' && next.confidence < 45) {
    next.verdict = 'WAIT';
    next.primaryText = 'Confidence is currently too low for entry. Wait for cleaner confirmation.';
  }

  if (request.tradeMode === 'in_trade' && next.verdict === 'ENTER') {
    next.verdict = 'WAIT';
    next.primaryText = 'Trade is already active. Manage risk and wait for the next transition.';
  }

  return next;
}

function buildAIPromptContext(request: CoachDecisionRequest, messages: CoachMessage[]): string {
  const context = {
    setupId: request.setupId || null,
    tradeMode: request.tradeMode || 'scan',
    question: request.question || null,
    selectedContract: request.selectedContract || null,
    coachMessages: messages.slice(0, 8).map((message) => ({
      type: message.type,
      priority: message.priority,
      setupId: message.setupId,
      content: message.content,
      structuredData: message.structuredData,
      timestamp: message.timestamp,
    })),
  };

  return JSON.stringify(context);
}

async function generateAIDecisionBrief(
  messages: CoachMessage[],
  request: CoachDecisionRequest,
): Promise<CoachDecisionBrief | null> {
  const fallback = buildFallbackCoachDecisionFromMessages(messages, request);

  const completion = await openaiCircuit.execute(() => openaiClient.chat.completions.create({
    model: COACH_DECISION_MODEL,
    temperature: COACH_DECISION_TEMPERATURE,
    max_tokens: COACH_DECISION_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: [
          'You are an SPX 0DTE execution copilot.',
          'Return strict JSON only. No markdown or prose outside JSON.',
          'Pick one verdict: ENTER, WAIT, REDUCE, EXIT.',
          'Use concrete evidence from provided context; keep "why" concise (max 3 bullets).',
          'Include actions array with up to 3 actions using these ids only:',
          'ENTER_TRADE_FOCUS, EXIT_TRADE_FOCUS, REVERT_AI_CONTRACT, TIGHTEN_STOP_GUIDANCE, REDUCE_SIZE_GUIDANCE, ASK_FOLLOW_UP, OPEN_HISTORY.',
          'JSON schema:',
          '{"verdict":"ENTER|WAIT|REDUCE|EXIT","confidence":0-100,"primaryText":"...","why":["..."],"severity":"routine|warning|critical","riskPlan":{"invalidation":"...","stop":number,"maxRiskDollars":number,"positionGuidance":"..."},"actions":[{"id":"...","label":"...","style":"primary|secondary|ghost","payload":{}}]}',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildAIPromptContext(request, messages),
      },
    ],
  }));

  const content = completion.choices[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    return null;
  }

  let parsed: AIDecisionCandidate;
  try {
    parsed = JSON.parse(removeCodeFence(content)) as AIDecisionCandidate;
  } catch {
    return null;
  }

  const generatedAt = nowIso();
  const expiresAt = new Date(Date.now() + DECISION_TTL_MS).toISOString();

  const verdict: CoachDecisionVerdict = typeof parsed.verdict === 'string' && VALID_VERDICTS.has(parsed.verdict as CoachDecisionVerdict)
    ? (parsed.verdict as CoachDecisionVerdict)
    : fallback.verdict;

  const confidence = clampConfidence(typeof parsed.confidence === 'number' ? parsed.confidence : fallback.confidence);
  const why = normalizeWhy(parsed.why, fallback.why);
  const primaryText = typeof parsed.primaryText === 'string' && parsed.primaryText.trim().length > 0
    ? toCompactSentence(parsed.primaryText)
    : fallback.primaryText;

  const severity: CoachDecisionSeverity = typeof parsed.severity === 'string' && VALID_SEVERITIES.has(parsed.severity as CoachDecisionSeverity)
    ? (parsed.severity as CoachDecisionSeverity)
    : fallback.severity;

  const actions = normalizeActions(parsed.actions, fallback.actions);
  const maxRiskDollars = request.selectedContract
    ? round(request.selectedContract.ask * 100, 0)
    : undefined;

  const brief: CoachDecisionBrief = {
    decisionId: uuid('coach_decision_ai_v2'),
    setupId: request.setupId || null,
    verdict,
    confidence,
    primaryText,
    why,
    riskPlan: normalizeRiskPlan(parsed.riskPlan, maxRiskDollars),
    actions,
    severity,
    freshness: {
      generatedAt,
      expiresAt,
      stale: false,
    },
    contextHash: buildContextHash(request, messages),
    source: 'ai_v2',
  };

  return applyGuardrails(brief, request);
}

export function buildFallbackCoachDecisionFromMessages(
  messages: CoachMessage[],
  request: CoachDecisionRequest,
): CoachDecisionBrief {
  const generatedAt = nowIso();
  const expiresAt = new Date(Date.now() + DECISION_TTL_MS).toISOString();
  const verdict = inferVerdict(messages, request);
  const why = buildWhy(messages);

  const maxRiskDollars = request.selectedContract
    ? round(request.selectedContract.ask * 100, 0)
    : undefined;

  return {
    decisionId: uuid('coach_decision_fallback'),
    setupId: request.setupId || null,
    verdict,
    confidence: inferConfidence(messages, verdict),
    primaryText: buildPrimaryText(verdict, why),
    why,
    riskPlan: {
      maxRiskDollars,
      positionGuidance: verdict === 'ENTER'
        ? 'Start with controlled size and add only on confirmation.'
        : 'Preserve risk budget until context improves.',
    },
    actions: buildActions(request, verdict),
    severity: inferSeverity(messages),
    freshness: {
      generatedAt,
      expiresAt,
      stale: false,
    },
    contextHash: buildContextHash(request, messages),
    source: 'fallback_v1',
  };
}

export async function generateCoachDecision(input: CoachDecisionRequest & {
  forceRefresh?: boolean;
  userId?: string;
}): Promise<CoachDecisionBrief> {
  const messages = await generateCoachStream({
    prompt: input.question,
    setupId: input.setupId,
    forceRefresh: input.forceRefresh,
    userId: input.userId,
  });

  if (!shouldUseDecisionV2()) {
    return buildFallbackCoachDecisionFromMessages(messages, input);
  }

  try {
    const aiBrief = await generateAIDecisionBrief(messages, input);
    if (aiBrief) return aiBrief;
  } catch (error) {
    logger.warn('SPX coach decision v2 generation failed, falling back to v1 mapping', {
      setupId: input.setupId || null,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return buildFallbackCoachDecisionFromMessages(messages, input);
}
