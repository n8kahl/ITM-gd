// ========== Enums ==========
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type LessonType = 'video' | 'text' | 'interactive' | 'scenario' | 'practice' | 'guided'
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type AchievementType = 'track_complete' | 'course_complete' | 'milestone' | 'streak' | 'rank_up'
export type Tier = 'core' | 'pro' | 'executive'

// ========== Rank System ==========
export const XP_THRESHOLDS = {
  'Rookie': 0,
  'Rising Bull': 100,
  'Sniper Apprentice': 500,
  'Certified Sniper': 1500,
  'Elite Operator': 4000,
} as const

export type Rank = keyof typeof XP_THRESHOLDS

export const TIER_HIERARCHY: Record<string, number> = { core: 1, pro: 2, executive: 3 }

export function getAccessibleTiers(userTier: string): string[] {
  const level = TIER_HIERARCHY[userTier] || 1
  return Object.entries(TIER_HIERARCHY)
    .filter(([, l]) => l <= level)
    .map(([tier]) => tier)
}

// ========== XP Awards ==========
export const XP_AWARDS = {
  ONBOARDING_COMPLETE: 50,
  LESSON_VIEW: 5,
  LESSON_COMPLETE: 10,
  QUIZ_PASS_FIRST: 50,
  QUIZ_PASS_RETAKE: 25,
  QUIZ_PERFECT: 100,
  COURSE_COMPLETE: 100,
  TRACK_COMPLETE: 500,
  STREAK_DAY: 5,
  TUTOR_QUESTION: 2,
} as const

// ========== Learning Paths ==========
export interface LearningPath {
  id: string
  name: string
  slug: string
  description: string | null
  tier_required: Tier
  difficulty_level: DifficultyLevel
  estimated_hours: number | null
  display_order: number
  is_published: boolean
  icon_name: string | null
  created_at: string
  updated_at: string
}

// ========== Courses (extended) ==========
export interface AcademyCourse {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  difficulty_level: DifficultyLevel
  tier_required: Tier
  estimated_hours: number | null
  passing_score: number
  is_published: boolean
  display_order: number
  lesson_count?: number
  lessons_completed?: number
  progress_percent?: number
}

// ========== Lessons (extended) ==========
export interface AcademyLesson {
  id: string
  course_id: string
  title: string
  slug: string
  video_url: string | null
  content_markdown: string | null
  lesson_type: LessonType
  estimated_minutes: number | null
  display_order: number
  quiz_data: QuizData | null
  activity_data: Record<string, unknown> | null
  ai_tutor_context: string | null
  ai_tutor_chips: string[]
  key_takeaways: string[] | null
}

// ========== Quiz ==========
export interface QuizData {
  questions: QuizQuestion[]
  passing_score: number
}

export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'scenario' | 'matching'
  text: string
  options: QuizOption[]
  correct_answer: string
  explanation: string
}

export interface QuizOption {
  id: string
  text: string
}

export interface QuizResult {
  quiz_score: number
  questions_correct: number
  questions_total: number
  passed: boolean
  xp_earned: number
  answers: QuizAnswerResult[]
  achievements_unlocked: AchievementEarned[]
}

export interface QuizAnswerResult {
  question_id: string
  selected: string
  correct: string
  is_correct: boolean
  explanation: string
}

// ========== Progress ==========
export interface UserLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  course_id: string
  status: ProgressStatus
  started_at: string | null
  completed_at: string | null
  time_spent_seconds: number
  quiz_score: number | null
  quiz_attempts: number
  activity_completed: boolean
}

export interface UserCourseProgress {
  id: string
  user_id: string
  course_id: string
  status: ProgressStatus
  lessons_completed: number
  total_lessons: number
  overall_quiz_average: number | null
  started_at: string | null
  completed_at: string | null
  certificate_issued: boolean
}

// ========== XP & Achievements ==========
export interface UserXP {
  total_xp: number
  current_rank: Rank
  current_streak: number
  longest_streak: number
  last_activity_date: string | null
  lessons_completed_count: number
  courses_completed_count: number
  quizzes_passed_count: number
}

export interface AchievementEarned {
  id: string
  achievement_type: AchievementType
  achievement_key: string
  achievement_data: Record<string, unknown>
  xp_earned: number
  trade_card_image_url: string | null
  verification_code: string
  earned_at: string
}

// ========== Dashboard ==========
export interface AcademyDashboard {
  current_lesson: {
    id: string
    title: string
    course_title: string
    course_id: string
    progress_percent: number
    lesson_type: LessonType
  } | null
  xp: UserXP
  stats: {
    total_lessons_completed: number
    total_courses_completed: number
    total_time_hours: number
    average_quiz_score: number
  }
  streak: {
    current: number
    longest: number
    days: boolean[]
  }
  recommendations: RecommendedLesson[]
  achievements: AchievementEarned[]
}

export interface RecommendedLesson {
  lesson_id: string
  title: string
  course_title: string
  course_id: string
  reason: string
  difficulty: DifficultyLevel
  estimated_minutes: number
}

// ========== Onboarding ==========
export interface OnboardingFormData {
  experience_level: 'never' | 'paper' | 'beginner' | 'intermediate' | 'advanced'
  knowledge_quiz_answers: { question_id: number; answer: string }[]
  goals: string[]
  weekly_time_minutes: number
  broker_status: 'choosing' | 'not_setup' | 'setup'
}

// ========== Greeks (Interactive) ==========
export interface BlackScholesInputs {
  stockPrice: number
  strikePrice: number
  daysToExpiration: number
  impliedVolatility: number
  interestRate: number
  optionType: 'call' | 'put'
}

export interface GreekValues {
  optionPrice: number
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
}

// ========== Trade Card ==========
export type TradeCardFormat = 'landscape' | 'story' | 'square'

export const TRADE_CARD_DIMENSIONS: Record<TradeCardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

export interface TradeCardMetadata {
  achievementTitle: string
  memberName: string
  earnedDate: string
  verificationCode: string
  achievementIcon: string
  tier: string
  stats: {
    coursesCompleted: number
    totalCourses: number
    quizAverage: number
    totalLessons: number
    dayStreak: number
    currentRank: string
  }
  coursesCompletedList: string[]
}
