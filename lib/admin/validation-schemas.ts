import { z } from 'zod'

// ─── Course Schemas ───────────────────────────────────────────────────────────

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  discord_role_required: z.string().nullable().optional(),
  is_published: z.boolean().optional().default(false),
})

export const updateCourseSchema = z.object({
  id: z.string().uuid('Course ID must be a valid UUID'),
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().max(2000).nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  discord_role_required: z.string().nullable().optional(),
  is_published: z.boolean().optional(),
  display_order: z.number().int().nonnegative().optional(),
})

// ─── Lesson Schemas ───────────────────────────────────────────────────────────

export const createLessonSchema = z.object({
  course_id: z.string().uuid('Course ID must be a valid UUID'),
  title: z.string().min(1, 'Title is required').max(300),
  slug: z.string().min(1, 'Slug is required').max(300).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  video_url: z.string().url().nullable().optional(),
  content_markdown: z.string().max(100000).nullable().optional(),
  is_free_preview: z.boolean().optional().default(false),
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
})

export const updateLessonSchema = z.object({
  id: z.string().uuid('Lesson ID must be a valid UUID'),
  title: z.string().min(1).max(300).optional(),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  video_url: z.string().url().nullable().optional(),
  content_markdown: z.string().max(100000).nullable().optional(),
  is_free_preview: z.boolean().optional(),
  duration_minutes: z.number().int().nonnegative().nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
})

// ─── Notification Schemas ─────────────────────────────────────────────────────

export const sendNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Body is required').max(2000),
  url: z.string().max(500).optional(),
  tag: z.string().max(100).nullable().optional(),
  requireInteraction: z.boolean().optional().default(false),
  targetType: z.enum(['all', 'tier', 'individual']),
  targetTiers: z.array(z.string()).optional(),
  targetUserIds: z.array(z.string().uuid()).optional(),
  scheduleAt: z.string().datetime().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.targetType === 'tier' && (!data.targetTiers || data.targetTiers.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one tier must be selected',
      path: ['targetTiers'],
    })
  }
  if (data.targetType === 'individual' && (!data.targetUserIds || data.targetUserIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one user must be selected',
      path: ['targetUserIds'],
    })
  }
})

// ─── Lead/Application Schemas ─────────────────────────────────────────────────

export const updateLeadSchema = z.object({
  id: z.string().uuid('Application ID must be a valid UUID'),
  status: z.enum(['pending', 'approved', 'rejected', 'waitlisted']).optional(),
  notes: z.string().max(5000).nullable().optional(),
  reviewed_by: z.string().max(200).nullable().optional(),
})

// ─── Shared Validation Helper ─────────────────────────────────────────────────

export function parseRequestBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.errors[0]
    const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : ''
    return { success: false, error: `${path}${firstError.message}` }
  }
  return { success: true, data: result.data }
}
