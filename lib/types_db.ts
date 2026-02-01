// ============================================
// DATABASE TYPES - Auto-generated from schema
// ============================================

// RBAC Permission Types
// ============================================

export interface AppPermission {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface DiscordRolePermission {
  id: string
  discord_role_id: string
  discord_role_name: string | null
  permission_id: string
  created_at: string
}

// Permission names enum for type safety
export type PermissionName =
  | 'view_courses'
  | 'view_premium_content'
  | 'admin_dashboard'
  | 'manage_courses'
  | 'manage_members'

// Course & Lesson Types
// ============================================

export interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  discord_role_required: string | null
  is_published: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  course_id: string
  title: string
  slug: string
  video_url: string | null
  content_markdown: string | null
  is_free_preview: boolean
  duration_minutes: number | null
  display_order: number
  created_at: string
  updated_at: string
}

// Joined/Extended Types for Queries
// ============================================

export interface CourseWithLessons extends Course {
  lessons: Lesson[]
}

export interface LessonWithCourse extends Lesson {
  course: Course
}

export interface DiscordRoleWithPermissions {
  discord_role_id: string
  discord_role_name: string | null
  permissions: AppPermission[]
}

// Insert Types (for creating new records)
// ============================================

export type CourseInsert = Omit<Course, 'id' | 'created_at' | 'updated_at'>
export type LessonInsert = Omit<Lesson, 'id' | 'created_at' | 'updated_at'>
export type AppPermissionInsert = Omit<AppPermission, 'id' | 'created_at'>
export type DiscordRolePermissionInsert = Omit<DiscordRolePermission, 'id' | 'created_at'>

// Update Types (for partial updates)
// ============================================

export type CourseUpdate = Partial<CourseInsert>
export type LessonUpdate = Partial<LessonInsert>

// Trading Journal Types
// ============================================

export interface TradingJournalEntry {
  id: string
  user_id: string
  trade_date: string
  symbol: string | null
  trade_type: string | null
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  profit_loss: number | null
  profit_loss_percent: number | null
  screenshot_url: string | null
  screenshot_thumbnail_url: string | null
  ai_analysis: AITradeAnalysis | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  tags: string[]
  rating: number | null
  is_winner: boolean | null
  created_at: string
  updated_at: string
}

export interface AITradeAnalysis {
  summary: string
  trend_analysis?: {
    direction: 'bullish' | 'bearish' | 'sideways'
    strength: 'strong' | 'moderate' | 'weak'
    notes: string
  }
  entry_analysis?: {
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    observations: string[]
    improvements: string[]
  }
  exit_analysis?: {
    quality: 'excellent' | 'good' | 'fair' | 'poor'
    observations: string[]
    improvements: string[]
  }
  risk_management?: {
    score: number
    observations: string[]
    suggestions: string[]
  }
  market_structure?: {
    key_levels: string[]
    patterns: string[]
    notes: string
  }
  coaching_notes: string
  grade: string
  tags: string[]
  analyzed_at: string
  model: string
}

export interface JournalStreak {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_entry_date: string | null
  total_entries: number
  total_winners: number
  total_losers: number
  created_at: string
  updated_at: string
}

export type TradingJournalEntryInsert = Omit<TradingJournalEntry, 'id' | 'created_at' | 'updated_at'>
export type TradingJournalEntryUpdate = Partial<TradingJournalEntryInsert>
