/**
 * Academy TypeScript interfaces matching the database schema for the
 * TradeITM Academy gamification and learning system.
 */

export interface AcademyUserXp {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  created_at: string;
  updated_at: string;
}

export interface AcademyUserStreak {
  id: string;
  user_id: string;
  current_streak_days: number;
  longest_streak_days: number;
  last_activity_date: string | null;
  streak_freeze_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface AcademyAchievement {
  id: string;
  key: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  category: string;
  unlock_criteria: Record<string, unknown>;
  xp_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface AcademyUserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface AcademyGamificationStats {
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  streakFreezeAvailable: boolean;
}

export interface AcademyActivitySubmission {
  answer: unknown;
  timeSpentMs: number;
}

export interface AcademyActivityResult {
  score: number;
  maxScore: number;
  feedback: string;
  competencyUpdates: Array<{
    competencyKey: string;
    previousScore: number;
    newScore: number;
  }>;
}

export interface AcademyStudentDashboard {
  xp: { total: number; level: number; nextLevelThreshold: number };
  streak: { current: number; longest: number; freezeAvailable: boolean };
  lessonsCompleted: number;
  totalLessons: number;
  competencyScores: Array<{ key: string; title: string; score: number }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    xpEarned: number;
  }>;
}

export interface AcademyLearningEvent {
  id: string;
  user_id: string;
  event_type: string;
  entity_id: string | null;
  entity_type: string | null;
  xp_earned: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AcademyLessonBlock {
  id: string;
  lesson_id: string;
  block_type: string;
  content_json: Record<string, unknown>;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface AcademyCompetencyMastery {
  id: string;
  user_id: string;
  competency_key: string;
  score: number;
  last_assessed_at: string;
  created_at: string;
  updated_at: string;
}

export interface AcademyAssessmentAttempt {
  id: string;
  user_id: string;
  assessment_id: string;
  score: number;
  max_score: number;
  passed: boolean;
  time_spent_ms: number;
  answers: Record<string, unknown>;
  completed_at: string;
}
