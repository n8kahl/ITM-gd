import { describe, expect, it } from 'vitest'
import {
  coachAIGenerateSchema,
  coachNoteUpdateSchema,
  coachQueueParamsSchema,
  coachResponsePayloadSchema,
  requestReviewSchema,
} from '@/lib/validation/coach-review'

describe('coachResponsePayloadSchema', () => {
  it('accepts a valid payload', () => {
    const payload = {
      what_went_well: ['Good level selection', 'Clean risk definition', 'Disciplined stop'],
      areas_to_improve: [
        { point: 'Chased breakout', instruction: 'Wait for close above prior high before entry.' },
        { point: 'Oversized at open', instruction: 'Cut opening size to 50% for first 10 minutes.' },
        { point: 'Late add', instruction: 'Only add on pullback to VWAP with tape confirmation.' },
      ],
      specific_drills: [
        { title: 'Opening Range Drill', description: 'Mark OR high/low and only trade break + retest.' },
      ],
      overall_assessment: 'Process quality was solid with one sizing error early in session.',
      grade: 'B',
      grade_reasoning: 'Strong risk controls with a single execution lapse.',
      confidence: 'high',
    }

    const parsed = coachResponsePayloadSchema.safeParse(payload)
    expect(parsed.success).toBe(true)
  })

  it('rejects too many what_went_well items', () => {
    const parsed = coachResponsePayloadSchema.safeParse({
      what_went_well: ['1', '2', '3', '4', '5', '6'],
      areas_to_improve: [{ point: 'x', instruction: 'y' }],
      specific_drills: [{ title: 'x', description: 'y' }],
      overall_assessment: 'ok',
      grade: 'C',
      grade_reasoning: 'ok',
      confidence: 'medium',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('coachAIGenerateSchema', () => {
  it('requires a valid UUID', () => {
    const parsed = coachAIGenerateSchema.safeParse({ journal_entry_id: 'not-a-uuid' })
    expect(parsed.success).toBe(false)
  })
})

describe('requestReviewSchema', () => {
  it('defaults priority to normal', () => {
    const parsed = requestReviewSchema.parse({})
    expect(parsed.priority).toBe('normal')
  })
})

describe('coachQueueParamsSchema', () => {
  it('coerces numbers and applies defaults', () => {
    const parsed = coachQueueParamsSchema.parse({ limit: '25', offset: '5' })
    expect(parsed.limit).toBe(25)
    expect(parsed.offset).toBe(5)
    expect(parsed.status).toBe('pending')
    expect(parsed.sortDir).toBe('desc')
  })
})

describe('coachNoteUpdateSchema', () => {
  it('accepts null internal notes', () => {
    const parsed = coachNoteUpdateSchema.safeParse({ internal_notes: null })
    expect(parsed.success).toBe(true)
  })
})
