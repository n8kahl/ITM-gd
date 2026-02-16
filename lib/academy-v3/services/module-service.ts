import type { SupabaseClient } from '@supabase/supabase-js'

import { getAcademyModuleResponseSchema } from '@/lib/academy-v3/contracts/api'
import {
  SupabaseAcademyLessonRepository,
  SupabaseAcademyModuleRepository,
} from '@/lib/academy-v3/repositories'

import { AcademyModuleNotFoundError } from './errors'

export class AcademyModuleService {
  private readonly modules
  private readonly lessons

  constructor(supabase: SupabaseClient) {
    this.modules = new SupabaseAcademyModuleRepository(supabase)
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
  }

  async getModuleBySlug(slug: string) {
    const moduleRecord = await this.modules.getPublishedModuleBySlug(slug)
    if (!moduleRecord) {
      throw new AcademyModuleNotFoundError()
    }

    const lessons = await this.lessons.listPublishedLessonsForModule(moduleRecord.id)

    const payload = getAcademyModuleResponseSchema.parse({
      data: {
        ...moduleRecord,
        lessons,
      },
    })

    return payload.data
  }
}
