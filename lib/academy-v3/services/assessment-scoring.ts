import type { AcademyAssessmentItem } from '@/lib/academy-v3/repositories'

export interface ScoredAssessmentItem {
  itemId: string
  competencyId: string | null
  score: number
  isCorrect: boolean
}

export interface AssessmentScoringResult {
  itemScores: ScoredAssessmentItem[]
  overallScore: number
  competencyScores: Record<string, number>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => String(item))
    .filter((item) => item.length > 0)
}

function normalizeAnswer(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().toLowerCase()
}

function scoreSingleSelect(answer: unknown, answerKeyJson: Record<string, unknown>): number {
  const expected = normalizeAnswer(
    answerKeyJson.correctOptionId ?? answerKeyJson.correct_option_id ?? answerKeyJson.value ?? answerKeyJson.answer
  )

  if (!expected) return 0
  return normalizeAnswer(answer) === expected ? 1 : 0
}

function scoreMultiSelect(answer: unknown, answerKeyJson: Record<string, unknown>): number {
  const expected = asStringArray(
    answerKeyJson.correctOptionIds ?? answerKeyJson.correct_option_ids ?? answerKeyJson.values ?? answerKeyJson.answers
  )
    .map((value) => normalizeAnswer(value))
    .sort()

  const actual = asStringArray(answer)
    .map((value) => normalizeAnswer(value))
    .sort()

  if (expected.length === 0 || actual.length === 0) return 0
  if (expected.length !== actual.length) return 0

  return expected.every((value, index) => value === actual[index]) ? 1 : 0
}

function scoreOrderedSteps(answer: unknown, answerKeyJson: Record<string, unknown>): number {
  const expected = asStringArray(answerKeyJson.steps ?? answerKeyJson.correctSteps ?? answerKeyJson.values)
    .map((value) => normalizeAnswer(value))
  const actual = asStringArray(answer).map((value) => normalizeAnswer(value))

  if (expected.length === 0 || actual.length === 0) return 0
  if (expected.length !== actual.length) return 0

  let correct = 0
  for (let index = 0; index < expected.length; index += 1) {
    if (expected[index] === actual[index]) {
      correct += 1
    }
  }

  return Number((correct / expected.length).toFixed(4))
}

function scoreShortAnswer(answer: unknown, answerKeyJson: Record<string, unknown>): number {
  const text = normalizeAnswer(answer)
  if (!text) return 0

  const keywords = asStringArray(answerKeyJson.keywords ?? answerKeyJson.acceptableKeywords)
    .map((keyword) => normalizeAnswer(keyword))
    .filter((keyword) => keyword.length > 0)

  if (keywords.length === 0) {
    const expected = normalizeAnswer(answerKeyJson.expectedAnswer ?? answerKeyJson.answer)
    return expected && text.includes(expected) ? 1 : 0
  }

  let hits = 0
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      hits += 1
    }
  }

  return Number((hits / keywords.length).toFixed(4))
}

function scoreScenarioBranch(answer: unknown, answerKeyJson: Record<string, unknown>): number {
  const expected = normalizeAnswer(answerKeyJson.branchId ?? answerKeyJson.branch_id ?? answerKeyJson.expectedBranch)
  if (!expected) return 0

  const actual = normalizeAnswer(
    typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>).branchId : answer
  )

  return actual === expected ? 1 : 0
}

export function scoreAssessmentItem(
  item: AcademyAssessmentItem,
  answer: unknown
): ScoredAssessmentItem {
  let score = 0

  if (item.itemType === 'single_select') {
    score = scoreSingleSelect(answer, item.answerKeyJson)
  } else if (item.itemType === 'multi_select') {
    score = scoreMultiSelect(answer, item.answerKeyJson)
  } else if (item.itemType === 'ordered_steps') {
    score = scoreOrderedSteps(answer, item.answerKeyJson)
  } else if (item.itemType === 'short_answer_rubric') {
    score = scoreShortAnswer(answer, item.answerKeyJson)
  } else if (item.itemType === 'scenario_branch') {
    score = scoreScenarioBranch(answer, item.answerKeyJson)
  }

  const normalizedScore = Number(Math.max(0, Math.min(1, score)).toFixed(4))

  return {
    itemId: item.id,
    competencyId: item.competencyId,
    score: normalizedScore,
    isCorrect: normalizedScore >= 0.999,
  }
}

export function scoreAssessment(
  items: AcademyAssessmentItem[],
  answers: Record<string, unknown>
): AssessmentScoringResult {
  const itemScores = items.map((item) => scoreAssessmentItem(item, answers[item.id]))

  const overallScore =
    itemScores.length > 0
      ? Number(
          (
            itemScores.reduce((sum, item) => sum + item.score, 0) /
            itemScores.length
          ).toFixed(4)
        )
      : 0

  const competencyBuckets = new Map<string, number[]>()
  for (const itemScore of itemScores) {
    if (!itemScore.competencyId) continue

    const bucket = competencyBuckets.get(itemScore.competencyId) || []
    bucket.push(itemScore.score)
    competencyBuckets.set(itemScore.competencyId, bucket)
  }

  const competencyScores: Record<string, number> = {}
  competencyBuckets.forEach((values, competencyId) => {
    competencyScores[competencyId] = Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)
    )
  })

  return {
    itemScores,
    overallScore,
    competencyScores,
  }
}
