import type { SupabaseClient } from '@supabase/supabase-js'

import type { AcademyMasteryRecord, AcademyMasteryRepository } from './types'

function mapMasteryRecord(row: Record<string, unknown>): AcademyMasteryRecord {
  const competencyRelation = Array.isArray(row.academy_competencies)
    ? row.academy_competencies[0]
    : row.academy_competencies

  const competency =
    competencyRelation && typeof competencyRelation === 'object'
      ? (competencyRelation as Record<string, unknown>)
      : {}

  return {
    competencyId: String(row.competency_id),
    competencyKey: String(competency.key || ''),
    competencyTitle: String(competency.title || 'Competency'),
    currentScore: typeof row.current_score === 'number' ? row.current_score : 0,
    confidence: typeof row.confidence === 'number' ? row.confidence : 0,
    needsRemediation: row.needs_remediation === true,
    lastEvaluatedAt: typeof row.last_evaluated_at === 'string' ? row.last_evaluated_at : null,
  }
}

export class SupabaseAcademyMasteryRepository implements AcademyMasteryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertMastery(input: {
    userId: string
    competencyId: string
    currentScore: number
    confidence: number
    needsRemediation: boolean
    metadata: Record<string, unknown>
  }): Promise<void> {
    const { error } = await this.supabase.from('academy_user_competency_mastery').upsert(
      {
        user_id: input.userId,
        competency_id: input.competencyId,
        current_score: input.currentScore,
        confidence: input.confidence,
        needs_remediation: input.needsRemediation,
        metadata: input.metadata,
        last_evaluated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,competency_id' }
    )

    if (error) {
      throw new Error(`Failed to upsert mastery record: ${error.message}`)
    }
  }

  async listMasteryForUser(userId: string): Promise<AcademyMasteryRecord[]> {
    const { data, error } = await this.supabase
      .from('academy_user_competency_mastery')
      .select(`
        competency_id,
        current_score,
        confidence,
        needs_remediation,
        last_evaluated_at,
        academy_competencies(key, title)
      `)
      .eq('user_id', userId)
      .order('current_score', { ascending: true })

    if (error) {
      throw new Error(`Failed to list mastery records: ${error.message}`)
    }

    return (data || []).map((row) => mapMasteryRecord(row))
  }
}
