import type { SupabaseClient } from '@supabase/supabase-js'

import { getMasteryResponseSchema } from '@/lib/academy-v3/contracts/api'
import { SupabaseAcademyMasteryRepository } from '@/lib/academy-v3/repositories'

export class AcademyMasteryService {
  private readonly mastery

  constructor(supabase: SupabaseClient) {
    this.mastery = new SupabaseAcademyMasteryRepository(supabase)
  }

  async getMastery(userId: string) {
    const items = await this.mastery.listMasteryForUser(userId)

    return getMasteryResponseSchema.parse({
      data: {
        items: items.map((item) => ({
          competencyId: item.competencyId,
          competencyKey: item.competencyKey,
          competencyTitle: item.competencyTitle,
          currentScore: item.currentScore,
          confidence: item.confidence,
          needsRemediation: item.needsRemediation,
          lastEvaluatedAt: item.lastEvaluatedAt,
        })),
      },
    }).data
  }
}
