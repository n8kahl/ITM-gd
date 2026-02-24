import { z } from 'zod'

export const academyDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced'])

export const academyBlockTypeSchema = z.enum([
  'hook',
  'concept_explanation',
  'worked_example',
  'guided_practice',
  'independent_practice',
  'reflection',
  'options_chain_simulator',
  'payoff_diagram_builder',
  'greeks_dashboard',
  'trade_scenario_tree',
  'strategy_matcher',
  'position_builder',
  'flashcard_deck',
  'timed_challenge',
  'market_context_tagger',
  'order_entry_simulator',
  'what_went_wrong',
  'journal_prompt',
])

export const academyLearningEventTypeSchema = z.enum([
  'lesson_started',
  'block_completed',
  'assessment_submitted',
  'assessment_passed',
  'assessment_failed',
  'remediation_assigned',
  'review_completed',
  'activity_completed',
  'achievement_unlocked',
  'streak_milestone',
  'xp_earned',
])

export const academyAssessmentTypeSchema = z.enum([
  'diagnostic',
  'formative',
  'performance',
  'summative',
])

export const academyAssessmentItemTypeSchema = z.enum([
  'single_select',
  'multi_select',
  'ordered_steps',
  'short_answer_rubric',
  'scenario_branch',
])

export const academyProgramSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const academyTrackSchema = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
  isActive: z.boolean(),
})

export const academyModuleSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  slug: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  learningOutcomes: z.array(z.string()),
  estimatedMinutes: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  isPublished: z.boolean(),
})

export const academyLessonSchema = z.object({
  id: z.string().uuid(),
  moduleId: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  learningObjective: z.string().min(1),
  heroImageUrl: z.string().nullable(),
  estimatedMinutes: z.number().int().nonnegative(),
  difficulty: academyDifficultySchema,
  prerequisiteLessonIds: z.array(z.string().uuid()),
  position: z.number().int().nonnegative(),
  isPublished: z.boolean(),
})

export const academyLessonBlockSchema = z.object({
  id: z.string().uuid(),
  lessonId: z.string().uuid(),
  blockType: academyBlockTypeSchema,
  position: z.number().int().nonnegative(),
  title: z.string().nullable(),
  contentJson: z.record(z.string(), z.unknown()),
})

export const academyPlanSchema = z.object({
  program: academyProgramSchema,
  tracks: z.array(
    academyTrackSchema.extend({
      modules: z.array(
        academyModuleSchema.extend({
          lessons: z.array(academyLessonSchema),
        })
      ),
    })
  ),
})

export const academyUserXpSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  totalXp: z.number().int().nonnegative(),
  currentLevel: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const academyUserStreakSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  currentStreakDays: z.number().int().nonnegative(),
  longestStreakDays: z.number().int().nonnegative(),
  lastActivityDate: z.string().nullable(),
  streakFreezeAvailable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const academyAchievementSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  category: z.string(),
  unlockCriteria: z.record(z.string(), z.unknown()),
  xpReward: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

export const academyUserAchievementSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  achievementId: z.string().uuid(),
  unlockedAt: z.string(),
})

export type AcademyDifficulty = z.infer<typeof academyDifficultySchema>
export type AcademyBlockType = z.infer<typeof academyBlockTypeSchema>
export type AcademyLearningEventType = z.infer<typeof academyLearningEventTypeSchema>
export type AcademyAssessmentType = z.infer<typeof academyAssessmentTypeSchema>
export type AcademyAssessmentItemType = z.infer<typeof academyAssessmentItemTypeSchema>

export type AcademyProgram = z.infer<typeof academyProgramSchema>
export type AcademyTrack = z.infer<typeof academyTrackSchema>
export type AcademyModule = z.infer<typeof academyModuleSchema>
export type AcademyLesson = z.infer<typeof academyLessonSchema>
export type AcademyLessonBlock = z.infer<typeof academyLessonBlockSchema>
export type AcademyPlan = z.infer<typeof academyPlanSchema>
export type AcademyUserXp = z.infer<typeof academyUserXpSchema>
export type AcademyUserStreak = z.infer<typeof academyUserStreakSchema>
export type AcademyAchievement = z.infer<typeof academyAchievementSchema>
export type AcademyUserAchievement = z.infer<typeof academyUserAchievementSchema>
