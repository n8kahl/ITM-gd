import { z } from 'zod'

export const coachReviewStatusSchema = z.enum([
  'pending',
  'in_review',
  'completed',
  'dismissed',
])

export const coachGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F'])

export const coachImprovementItemSchema = z.object({
  point: z.string().min(1).max(300),
  instruction: z.string().min(1).max(500),
})

export const coachDrillSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
})

export const coachResponsePayloadSchema = z.object({
  what_went_well: z.array(z.string().max(300)).min(1).max(5),
  areas_to_improve: z.array(coachImprovementItemSchema).min(1).max(5),
  specific_drills: z.array(coachDrillSchema).min(1).max(3),
  overall_assessment: z.string().min(1).max(1000),
  grade: coachGradeSchema,
  grade_reasoning: z.string().min(1).max(500),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const coachNoteUpdateSchema = z.object({
  coach_response: coachResponsePayloadSchema.partial().optional(),
  internal_notes: z.string().max(10000).nullable().optional(),
})

export const coachAIGenerateSchema = z.object({
  journal_entry_id: z.string().uuid(),
  coach_preliminary_notes: z.string().max(5000).optional(),
})

export const requestReviewSchema = z.object({
  priority: z.enum(['normal', 'urgent']).default('normal'),
})

export const coachQueueParamsSchema = z.object({
  status: z.enum(['pending', 'in_review', 'completed', 'dismissed', 'all']).default('pending'),
  priority: z.enum(['normal', 'urgent', 'all']).default('all'),
  symbol: z.string().max(16).optional(),
  member: z.string().max(100).optional(),
  sortBy: z.enum(['requested_at', 'trade_date', 'pnl']).default('requested_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const coachBrowseParamsSchema = z.object({
  symbol: z.string().max(16).optional(),
  direction: z.enum(['long', 'short', 'all']).default('all'),
  contractType: z.enum(['stock', 'call', 'put', 'all']).default('all'),
  memberId: z.string().uuid().optional(),
  memberSearch: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  hasCoachNote: z.coerce.boolean().optional(),
  sortBy: z.enum(['trade_date', 'pnl', 'created_at']).default('trade_date'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
