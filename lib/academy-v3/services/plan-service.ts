import type { SupabaseClient } from '@supabase/supabase-js'

import { academyPlanSchema, type AcademyPlan } from '@/lib/academy-v3/contracts/domain'
import {
  SupabaseAcademyLessonRepository,
  SupabaseAcademyModuleRepository,
  SupabaseAcademyProgramRepository,
  SupabaseAcademyTrackRepository,
} from '@/lib/academy-v3/repositories'

import { AcademyPlanNotFoundError } from './errors'

const DEFAULT_PROGRAM_CODE = 'titm-core-program'

interface GetAcademyPlanOptions {
  programCode?: string
}

export class AcademyPlanService {
  private readonly programs
  private readonly tracks
  private readonly modules
  private readonly lessons

  constructor(private readonly supabase: SupabaseClient) {
    this.programs = new SupabaseAcademyProgramRepository(supabase)
    this.tracks = new SupabaseAcademyTrackRepository(supabase)
    this.modules = new SupabaseAcademyModuleRepository(supabase)
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
  }

  async getPlan(options: GetAcademyPlanOptions = {}): Promise<AcademyPlan> {
    const requestedCode = options.programCode?.trim() || DEFAULT_PROGRAM_CODE

    let program = await this.programs.getActiveProgramByCode(requestedCode)

    if (!program) {
      const programs = await this.programs.listActivePrograms()
      program = programs[0] ?? null
    }

    if (!program) {
      throw new AcademyPlanNotFoundError()
    }

    const tracks = await this.tracks.listActiveTracksForProgram(program.id)

    const tracksWithModules = await Promise.all(
      tracks.map(async (track) => {
        const modules = await this.modules.listPublishedModulesForTrack(track.id)

        const modulesWithLessons = await Promise.all(
          modules.map(async (module) => {
            const lessons = await this.lessons.listPublishedLessonsForModule(module.id)
            return {
              ...module,
              lessons,
            }
          })
        )

        return {
          ...track,
          modules: modulesWithLessons,
        }
      })
    )

    return academyPlanSchema.parse({
      program,
      tracks: tracksWithModules,
    })
  }
}
