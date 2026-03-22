import { describe, expect, it } from 'vitest'
import {
  createCourseSchema,
  updateCourseSchema,
  createLessonSchema,
  updateLessonSchema,
  sendNotificationSchema,
  updateLeadSchema,
  parseRequestBody,
} from '@/lib/admin/validation-schemas'

describe('Admin Validation Schemas', () => {
  describe('createCourseSchema', () => {
    it('accepts valid input', () => {
      const result = createCourseSchema.safeParse({
        title: 'Introduction to Options',
        slug: 'intro-to-options',
        description: 'Learn the basics',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing title', () => {
      const result = createCourseSchema.safeParse({ slug: 'test' })
      expect(result.success).toBe(false)
    })

    it('rejects invalid slug format', () => {
      const result = createCourseSchema.safeParse({
        title: 'Test',
        slug: 'Invalid Slug!',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateCourseSchema', () => {
    it('requires valid UUID for id', () => {
      const result = updateCourseSchema.safeParse({ id: 'not-uuid' })
      expect(result.success).toBe(false)
    })

    it('accepts valid update', () => {
      const result = updateCourseSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Updated Title',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('createLessonSchema', () => {
    it('accepts valid input', () => {
      const result = createLessonSchema.safeParse({
        course_id: '00000000-0000-4000-8000-000000000001',
        title: 'Lesson 1',
        slug: 'lesson-1',
        duration_minutes: 15,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid course_id', () => {
      const result = createLessonSchema.safeParse({
        course_id: 'bad',
        title: 'Lesson',
        slug: 'lesson',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateLessonSchema', () => {
    it('requires UUID for id', () => {
      const result = updateLessonSchema.safeParse({ id: 'bad' })
      expect(result.success).toBe(false)
    })
  })

  describe('sendNotificationSchema', () => {
    it('accepts valid all-target notification', () => {
      const result = sendNotificationSchema.safeParse({
        title: 'Alert',
        body: 'Important update',
        targetType: 'all',
      })
      expect(result.success).toBe(true)
    })

    it('rejects tier target without tiers', () => {
      const result = sendNotificationSchema.safeParse({
        title: 'Alert',
        body: 'Update',
        targetType: 'tier',
        targetTiers: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects individual target without user IDs', () => {
      const result = sendNotificationSchema.safeParse({
        title: 'Alert',
        body: 'Update',
        targetType: 'individual',
        targetUserIds: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid target type', () => {
      const result = sendNotificationSchema.safeParse({
        title: 'Alert',
        body: 'Update',
        targetType: 'invalid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateLeadSchema', () => {
    it('accepts valid status update', () => {
      const result = updateLeadSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'approved',
        notes: 'Looks good',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid status', () => {
      const result = updateLeadSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000001',
        status: 'invalid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('parseRequestBody', () => {
    it('returns formatted error for invalid input', () => {
      const result = parseRequestBody(createCourseSchema, { slug: 'test' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Required')
      }
    })

    it('returns parsed data for valid input', () => {
      const result = parseRequestBody(createCourseSchema, {
        title: 'Test',
        slug: 'test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Test')
      }
    })
  })
})
