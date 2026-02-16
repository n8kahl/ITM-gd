import type { SupabaseClient } from '@supabase/supabase-js'
import { mapAcademyProgramRow } from '@/lib/academy-v3/mappers/academy-row-mappers'

import type { AcademyProgramRepository } from './types'
import type { AcademyProgram } from '@/lib/academy-v3/contracts/domain'

export class SupabaseAcademyProgramRepository implements AcademyProgramRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getActiveProgramByCode(code: string): Promise<AcademyProgram | null> {
    const { data, error } = await this.supabase
      .from('academy_programs')
      .select('id, code, title, description, is_active, created_at, updated_at')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch academy program by code: ${error.message}`)
    }

    return data ? mapAcademyProgramRow(data) : null
  }

  async listActivePrograms(): Promise<AcademyProgram[]> {
    const { data, error } = await this.supabase
      .from('academy_programs')
      .select('id, code, title, description, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to list academy programs: ${error.message}`)
    }

    return (data ?? []).map((row) => mapAcademyProgramRow(row))
  }
}
