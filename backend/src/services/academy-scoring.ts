/**
 * Academy Activity Scoring Service
 * Provides scoring logic for each interactive lesson block type.
 */

export interface ScoringResult {
  score: number;
  maxScore: number;
  feedback: string;
  isCorrect: boolean;
}

// ---------------------------------------------------------------------------
// Type guards / helpers
// ---------------------------------------------------------------------------

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// Individual scorers
// ---------------------------------------------------------------------------

/**
 * options_chain_simulator
 * Answer: string[] of selected option tickers/labels
 * Key: string[] of correct selections
 */
function scoreOptionsChainSimulator(answer: unknown, answerKey: unknown): ScoringResult {
  const selected = asStringArray(answer);
  const correct = asStringArray(answerKey);
  const maxScore = correct.length || 1;

  if (selected.length === 0) {
    return { score: 0, maxScore, feedback: 'No selections made.', isCorrect: false };
  }

  const correctHits = selected.filter(s => correct.includes(s)).length;
  const score = correctHits;
  const isCorrect = score === maxScore;

  const feedback = isCorrect
    ? 'Perfect selection — all correct options identified.'
    : `${correctHits} of ${maxScore} correct. Review the options chain metrics and try again.`;

  return { score, maxScore, feedback, isCorrect };
}

/**
 * payoff_diagram_builder
 * Answer: { breakeven: number; maxProfit: number; maxLoss: number }
 * Key: { breakeven: number; maxProfit: number; maxLoss: number; tolerance?: number }
 */
function scorePayoffDiagramBuilder(answer: unknown, answerKey: unknown): ScoringResult {
  if (!isRecord(answer) || !isRecord(answerKey)) {
    return { score: 0, maxScore: 3, feedback: 'Invalid answer format.', isCorrect: false };
  }

  const tolerance = asNumber(answerKey['tolerance'], 5);
  const fields: Array<keyof typeof answerKey> = ['breakeven', 'maxProfit', 'maxLoss'];
  let correctFields = 0;

  const feedbackParts: string[] = [];
  for (const field of fields) {
    const submitted = asNumber(answer[field as string], NaN);
    const expected = asNumber(answerKey[field as string], NaN);
    if (Number.isNaN(submitted) || Number.isNaN(expected)) continue;
    if (Math.abs(submitted - expected) <= tolerance) {
      correctFields++;
    } else {
      feedbackParts.push(`${field}: expected ~${expected}, got ${submitted}`);
    }
  }

  const isCorrect = correctFields === fields.length;
  const feedback = isCorrect
    ? 'Payoff diagram values are correct.'
    : `${correctFields}/${fields.length} values within tolerance. ` + feedbackParts.join('; ');

  return { score: correctFields, maxScore: fields.length, feedback, isCorrect };
}

/**
 * trade_scenario_tree
 * Answer: string — chosen path/leaf node key
 * Key: string — correct path key
 */
function scoreTradeScenarioTree(answer: unknown, answerKey: unknown): ScoringResult {
  const chosen = asString(answer).trim();
  const correct = asString(answerKey).trim();

  if (!chosen) {
    return { score: 0, maxScore: 1, feedback: 'No path selected.', isCorrect: false };
  }

  const isCorrect = chosen === correct;
  const feedback = isCorrect
    ? 'Correct path selected — solid decision-making.'
    : `Incorrect path. The optimal choice was "${correct}". Review the risk/reward branches.`;

  return { score: isCorrect ? 1 : 0, maxScore: 1, feedback, isCorrect };
}

/**
 * strategy_matcher
 * Answer: Record<string, string> — { scenarioKey: strategyKey }
 * Key: Record<string, string> — correct mappings
 */
function scoreStrategyMatcher(answer: unknown, answerKey: unknown): ScoringResult {
  if (!isRecord(answer) || !isRecord(answerKey)) {
    return { score: 0, maxScore: 1, feedback: 'Invalid answer format.', isCorrect: false };
  }

  const pairs = Object.entries(answerKey);
  const maxScore = pairs.length || 1;
  let correctCount = 0;

  for (const [scenarioKey, correctStrategy] of pairs) {
    if (asString(answer[scenarioKey]) === asString(correctStrategy)) {
      correctCount++;
    }
  }

  const isCorrect = correctCount === maxScore;
  const feedback = isCorrect
    ? 'All scenarios matched correctly.'
    : `${correctCount}/${maxScore} correct matches. Revisit strategy selection criteria.`;

  return { score: correctCount, maxScore, feedback, isCorrect };
}

/**
 * position_builder
 * Answer: Array<{ action: string; instrument: string; quantity: number }>
 * Key: Array<{ action: string; instrument: string; quantity: number }>
 * Scored by comparing serialized leg strings.
 */
function scorePositionBuilder(answer: unknown, answerKey: unknown): ScoringResult {
  const serializeLeg = (leg: unknown): string => {
    if (!isRecord(leg)) return '';
    return `${asString(leg['action'])}_${asString(leg['instrument'])}_${asNumber(leg['quantity'])}`;
  };

  const submittedLegs = Array.isArray(answer) ? answer.map(serializeLeg).sort() : [];
  const correctLegs = Array.isArray(answerKey) ? answerKey.map(serializeLeg).sort() : [];
  const maxScore = correctLegs.length || 1;

  const correctCount = submittedLegs.filter((l, i) => l === correctLegs[i]).length;
  const isCorrect = correctCount === maxScore && submittedLegs.length === correctLegs.length;

  const feedback = isCorrect
    ? 'Position built correctly — legs match the target structure.'
    : `${correctCount}/${maxScore} legs correct. Check action, instrument, and quantity for each leg.`;

  return { score: correctCount, maxScore, feedback, isCorrect };
}

/**
 * flashcard_deck
 * Answer: Array<{ cardId: string; correct: boolean }>
 * Key: string[] — card IDs that must be answered correctly
 */
function scoreFlashcardDeck(answer: unknown, answerKey: unknown): ScoringResult {
  type CardResult = { cardId: string; correct: boolean };

  const isCardResult = (v: unknown): v is CardResult =>
    isRecord(v) && typeof v['cardId'] === 'string' && typeof v['correct'] === 'boolean';

  const results: CardResult[] = Array.isArray(answer) ? answer.filter(isCardResult) : [];
  const correctIds = asStringArray(answerKey);
  const maxScore = correctIds.length || results.length || 1;

  let correctCount = 0;
  if (correctIds.length > 0) {
    // Key specifies which cards must be correct
    for (const cardId of correctIds) {
      const entry = results.find(r => r.cardId === cardId);
      if (entry?.correct) correctCount++;
    }
  } else {
    // No specific key — count all correct answers
    correctCount = results.filter(r => r.correct).length;
  }

  const isCorrect = correctCount === maxScore;
  const feedback = isCorrect
    ? 'All flashcards answered correctly.'
    : `${correctCount}/${maxScore} correct. Review the cards you missed and try again.`;

  return { score: correctCount, maxScore, feedback, isCorrect };
}

/**
 * timed_challenge
 * Answer: { answers: string[]; timeTakenMs: number }
 * Key: { answers: string[]; timeLimitMs: number }
 * Full marks for all correct + under time; partial for correct only.
 */
function scoreTimedChallenge(answer: unknown, answerKey: unknown): ScoringResult {
  if (!isRecord(answer) || !isRecord(answerKey)) {
    return { score: 0, maxScore: 1, feedback: 'Invalid answer format.', isCorrect: false };
  }

  const submitted = asStringArray(answer['answers']);
  const correct = asStringArray(answerKey['answers']);
  const timeTakenMs = asNumber(answer['timeTakenMs'], Infinity);
  const timeLimitMs = asNumber(answerKey['timeLimitMs'], Infinity);

  const maxScore = correct.length * 2; // base + speed bonus per question
  let baseScore = 0;
  let speedBonus = 0;

  for (let i = 0; i < correct.length; i++) {
    if (submitted[i] === correct[i]) {
      baseScore++;
      if (timeTakenMs <= timeLimitMs) {
        speedBonus++;
      }
    }
  }

  const totalScore = baseScore + speedBonus;
  const isCorrect = baseScore === correct.length;

  const underTime = timeTakenMs <= timeLimitMs;
  const feedback = isCorrect && underTime
    ? 'Challenge completed — all correct and under time limit.'
    : isCorrect
      ? 'All answers correct but over time limit. No speed bonus awarded.'
      : `${baseScore}/${correct.length} correct. ${underTime ? 'Under time.' : 'Over time.'} Review missed questions.`;

  return { score: totalScore, maxScore: maxScore || 1, feedback, isCorrect };
}

/**
 * market_context_tagger
 * Answer: string[] — selected tags
 * Key: string[] — correct tags (order-insensitive)
 */
function scoreMarketContextTagger(answer: unknown, answerKey: unknown): ScoringResult {
  const selected = new Set(asStringArray(answer));
  const correct = new Set(asStringArray(answerKey));
  const maxScore = correct.size || 1;

  const correctHits = [...selected].filter(t => correct.has(t)).length;
  const falsePositives = selected.size - correctHits;
  const penalty = Math.max(0, falsePositives);
  const score = Math.max(0, correctHits - penalty);

  const isCorrect = correctHits === correct.size && falsePositives === 0;

  const feedback = isCorrect
    ? 'Market context tagged correctly.'
    : `${correctHits}/${correct.size} correct tags, ${falsePositives} incorrect tag(s). Precision matters — false signals hurt.`;

  return { score, maxScore, feedback, isCorrect };
}

/**
 * order_entry_simulator
 * Answer: { side: string; type: string; quantity: number; price?: number }
 * Key: { side: string; type: string; quantity: number; price?: number; priceTolerance?: number }
 */
function scoreOrderEntrySimulator(answer: unknown, answerKey: unknown): ScoringResult {
  if (!isRecord(answer) || !isRecord(answerKey)) {
    return { score: 0, maxScore: 3, feedback: 'Invalid answer format.', isCorrect: false };
  }

  let correctFields = 0;
  const maxScore = 3; // side, type, quantity (price is optional)
  const feedbackParts: string[] = [];

  const checkField = (field: string, tolerance = 0): void => {
    const submitted = answer[field];
    const expected = answerKey[field];
    if (expected === undefined) return; // optional field not in key
    if (typeof expected === 'number' && typeof submitted === 'number') {
      if (Math.abs(submitted - expected) <= tolerance) {
        correctFields++;
      } else {
        feedbackParts.push(`${field}: expected ${expected}, got ${submitted}`);
      }
    } else if (asString(submitted).toLowerCase() === asString(expected).toLowerCase()) {
      correctFields++;
    } else {
      feedbackParts.push(`${field}: expected "${expected}", got "${submitted}"`);
    }
  };

  checkField('side');
  checkField('type');
  checkField('quantity');

  const priceTolerance = asNumber(answerKey['priceTolerance'], 0.05);
  if (answerKey['price'] !== undefined) {
    checkField('price', priceTolerance);
  }

  const isCorrect = correctFields === maxScore;
  const feedback = isCorrect
    ? 'Order entered correctly.'
    : `${correctFields}/${maxScore} fields correct. ` + feedbackParts.join('; ');

  return { score: correctFields, maxScore, feedback, isCorrect };
}

/**
 * what_went_wrong
 * Answer: string — selected error category key
 * Key: string — correct error category key
 */
function scoreWhatWentWrong(answer: unknown, answerKey: unknown): ScoringResult {
  const chosen = asString(answer).trim();
  const correct = asString(answerKey).trim();

  if (!chosen) {
    return { score: 0, maxScore: 1, feedback: 'No error identified.', isCorrect: false };
  }

  const isCorrect = chosen === correct;
  const feedback = isCorrect
    ? 'Correct diagnosis — error identified accurately.'
    : `Incorrect. The primary issue was "${correct}". Review how this error manifests in trading scenarios.`;

  return { score: isCorrect ? 1 : 0, maxScore: 1, feedback, isCorrect };
}

/**
 * journal_prompt
 * Answer: string — free-text reflection (min length required for credit)
 * Key: { minLength?: number; keywords?: string[] }
 */
function scoreJournalPrompt(answer: unknown, answerKey: unknown): ScoringResult {
  const text = asString(answer).trim();
  const key = isRecord(answerKey) ? answerKey : {};
  const minLength = asNumber(key['minLength'], 50);
  const keywords = asStringArray(key['keywords']);

  if (text.length < minLength) {
    return {
      score: 0,
      maxScore: 1,
      feedback: `Response too short (${text.length} chars). Aim for at least ${minLength} characters.`,
      isCorrect: false,
    };
  }

  let keywordScore = 0;
  if (keywords.length > 0) {
    const lower = text.toLowerCase();
    keywordScore = keywords.filter(kw => lower.includes(kw.toLowerCase())).length;
    const allPresent = keywordScore === keywords.length;
    const feedback = allPresent
      ? 'Reflection complete — key concepts addressed.'
      : `Good effort. Consider addressing: ${keywords.filter(kw => !text.toLowerCase().includes(kw.toLowerCase())).join(', ')}.`;
    return {
      score: Math.min(1, Math.round(keywordScore / keywords.length)),
      maxScore: 1,
      feedback,
      isCorrect: allPresent,
    };
  }

  return {
    score: 1,
    maxScore: 1,
    feedback: 'Reflection recorded. Great work reviewing your trade.',
    isCorrect: true,
  };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Routes an activity answer to the appropriate scorer.
 */
export function scoreActivity(
  blockType: string,
  answer: unknown,
  answerKey: unknown
): ScoringResult {
  switch (blockType) {
    case 'options_chain_simulator':
      return scoreOptionsChainSimulator(answer, answerKey);
    case 'payoff_diagram_builder':
      return scorePayoffDiagramBuilder(answer, answerKey);
    case 'greeks_dashboard':
      // Exploration activity — no scoring
      return {
        score: 0,
        maxScore: 0,
        feedback: 'Exploration activity — no scoring.',
        isCorrect: true,
      };
    case 'trade_scenario_tree':
      return scoreTradeScenarioTree(answer, answerKey);
    case 'strategy_matcher':
      return scoreStrategyMatcher(answer, answerKey);
    case 'position_builder':
      return scorePositionBuilder(answer, answerKey);
    case 'flashcard_deck':
      return scoreFlashcardDeck(answer, answerKey);
    case 'timed_challenge':
      return scoreTimedChallenge(answer, answerKey);
    case 'market_context_tagger':
      return scoreMarketContextTagger(answer, answerKey);
    case 'order_entry_simulator':
      return scoreOrderEntrySimulator(answer, answerKey);
    case 'what_went_wrong':
      return scoreWhatWentWrong(answer, answerKey);
    case 'journal_prompt':
      return scoreJournalPrompt(answer, answerKey);
    default:
      return {
        score: 0,
        maxScore: 1,
        feedback: `Unknown activity type: ${blockType}.`,
        isCorrect: false,
      };
  }
}
