import type { SupabaseClient } from '@supabase/supabase-js'

import { getRecommendationsResponseSchema } from '@/lib/academy-v3/contracts/api'
import {
  SupabaseAcademyLessonRepository,
  SupabaseAcademyMasteryRepository,
  SupabaseAcademyReviewRepository,
} from '@/lib/academy-v3/repositories'

export class AcademyRecommendationService {
  private readonly mastery
  private readonly lessons
  private readonly review

  constructor(supabase: SupabaseClient) {
    this.mastery = new SupabaseAcademyMasteryRepository(supabase)
    this.lessons = new SupabaseAcademyLessonRepository(supabase)
    this.review = new SupabaseAcademyReviewRepository(supabase)
  }

  async getRecommendations(userId: string) {
    const [masteryItems, dueReviewItems] = await Promise.all([
      this.mastery.listMasteryForUser(userId),
      this.review.listDueQueueItemsForUser(userId, 5),
    ])

    const items: Array<{
      type: 'review' | 'lesson'
      title: string
      reason: string
      actionLabel: string
      actionTarget: string
    }> = []

    if (dueReviewItems.length > 0) {
      items.push({
        type: 'review',
        title: 'Clear your review queue',
        reason: `${dueReviewItems.length} review item${dueReviewItems.length === 1 ? '' : 's'} are due now.`,
        actionLabel: 'Start review',
        actionTarget: '/members/academy-v3/review',
      })
    }

    const weakest = masteryItems
      .filter((item) => item.needsRemediation || item.currentScore < 70)
      .sort((a, b) => a.currentScore - b.currentScore)
      .slice(0, 3)

    const weakCompetencyIds = weakest.map((item) => item.competencyId)

    const lessonRecommendations = await this.lessons.listRecommendedLessonsForCompetencies(
      weakCompetencyIds,
      3
    )

    for (const lesson of lessonRecommendations) {
      const competency = weakest.find((item) => item.competencyId === lesson.competencyId)
      const competencyLabel = competency?.competencyTitle || 'priority competency'

      items.push({
        type: 'lesson',
        title: lesson.lessonTitle,
        reason: `Targets ${competencyLabel} improvement.`,
        actionLabel: 'Open lesson',
        actionTarget: `/members/academy-v3/modules?lesson=${lesson.lessonId}`,
      })
    }

    return getRecommendationsResponseSchema.parse({
      data: {
        items,
      },
    }).data
  }
}
