import type { SupabaseClient } from '@supabase/supabase-js'
import { mapAcademyModuleRow } from '@/lib/academy-v3/mappers/academy-row-mappers'

import type { AcademyModuleRepository } from './types'
import type { AcademyModule } from '@/lib/academy-v3/contracts/domain'

export class SupabaseAcademyModuleRepository implements AcademyModuleRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getPublishedModuleBySlug(slug: string): Promise<AcademyModule | null> {
    const { data, error } = await this.supabase
      .from('academy_modules')
      .select('id, track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published, metadata')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch academy module by slug: ${error.message}`)
    }

    return data ? mapAcademyModuleRow(data) : null
  }

  async listPublishedModulesForTrack(trackId: string): Promise<AcademyModule[]> {
    const { data, error } = await this.supabase
      .from('academy_modules')
      .select('id, track_id, slug, code, title, description, learning_outcomes, estimated_minutes, position, is_published, metadata')
      .eq('track_id', trackId)
      .eq('is_published', true)
      .order('position', { ascending: true })

    if (error) {
      throw new Error(`Failed to list academy modules: ${error.message}`)
    }

    return (data ?? []).map((row) => mapAcademyModuleRow(row))
  }
}
