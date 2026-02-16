import type { SupabaseClient } from '@supabase/supabase-js'
import { mapAcademyTrackRow } from '@/lib/academy-v3/mappers/academy-row-mappers'

import type { AcademyTrackRepository } from './types'
import type { AcademyTrack } from '@/lib/academy-v3/contracts/domain'

export class SupabaseAcademyTrackRepository implements AcademyTrackRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listActiveTracksForProgram(programId: string): Promise<AcademyTrack[]> {
    const { data, error } = await this.supabase
      .from('academy_tracks')
      .select('id, program_id, code, title, description, position, is_active')
      .eq('program_id', programId)
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (error) {
      throw new Error(`Failed to list academy tracks: ${error.message}`)
    }

    return (data ?? []).map((row) => mapAcademyTrackRow(row))
  }
}
