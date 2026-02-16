import type { SupabaseClient } from '@supabase/supabase-js'

import { getAcademyLessonResponseSchema } from '@/lib/academy-v3/contracts/api'
import { SupabaseAcademyLessonRepository } from '@/lib/academy-v3/repositories'

import { AcademyLessonNotFoundError } from './errors'

export class AcademyLessonService {
  private readonly lessons

  constructor(supabase: SupabaseClient) {
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
  }

  async getLessonById(id: string) {
    const lesson = await this.lessons.getPublishedLessonById(id)
    if (!lesson) {
      throw new AcademyLessonNotFoundError()
    }

    const blocks = await this.lessons.listBlocksForLesson(lesson.id)

    const payload = getAcademyLessonResponseSchema.parse({
      data: {
        ...lesson,
        blocks,
      },
    })

    return payload.data
  }
}
