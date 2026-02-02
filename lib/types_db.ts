// ============================================
// DATABASE TYPES - Centralized type definitions
// ============================================

// ============================================
// Subscriber & Contact Types
// ============================================

export interface Subscriber {
  id?: string
  name: string
  email: string
  phone?: string
  instagram_handle?: string
  twitter_handle?: string
  referral_source?: string
  session_id?: string
  created_at?: string
  updated_at?: string
}

export interface ContactSubmission {
  id?: string
  name: string
  email: string
  message: string
  phone?: string
  submission_type?: 'contact' | 'cohort_application' | 'general_inquiry'
  metadata?: ApplicationMetadata
  created_at?: string
}

export interface ApplicationMetadata {
  discord_handle?: string
  experience_level?: '< 1 Year' | '1-3 Years' | '3+ Years'
  account_size?: 'Under $5k' | '$5k - $25k' | '$25k+'
  primary_struggle?: 'Psychology' | 'Risk Management' | 'Strategy' | 'Consistency' | 'Other'
  short_term_goal?: string
  source?: string
}

export interface ApplicationData extends Omit<ContactSubmission, 'submission_type' | 'metadata'> {
  submission_type: 'cohort_application'
  discord_handle: string
  experience_level: '< 1 Year' | '1-3 Years' | '3+ Years'
  account_size: 'Under $5k' | '$5k - $25k' | '$25k+'
  primary_struggle: 'Psychology' | 'Risk Management' | 'Strategy' | 'Consistency' | 'Other'
  short_term_goal: string
}

export interface CohortApplication {
  id?: string
  contact_submission_id?: string
  name: string
  email: string
  phone?: string
  message: string
  status: 'pending' | 'approved' | 'rejected' | 'contacted'
  notes?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at?: string
  updated_at?: string
}

// ============================================
// Analytics Types
// ============================================

export interface PageView {
  id?: string
  session_id: string
  page_path: string
  referrer?: string
  user_agent?: string
  device_type?: string
  browser?: string
  os?: string
  screen_width?: number
  screen_height?: number
  country?: string
  city?: string
  ip_address?: string
  created_at?: string
}

export interface ClickEvent {
  id?: string
  session_id: string
  element_type: string
  element_label?: string
  element_value?: string
  page_path: string
  created_at?: string
}

export interface AnalyticsSession {
  id?: string
  session_id: string
  first_seen?: string
  last_seen?: string
  page_views_count?: number
  is_returning?: boolean
}

export interface ConversionEvent {
  id?: string
  session_id: string
  event_type: string
  event_value?: string
  created_at?: string
}

export interface AnalyticsSummary {
  total_page_views: number
  unique_visitors: number
  total_subscribers: number
  total_contacts: number
  total_clicks: number
  device_breakdown: Record<string, number>
}

// ============================================
// Pricing Types
// ============================================

export interface PricingTier {
  id: string
  name: string
  description: string | null
  tagline: string | null
  features: string[]
  monthly_price: string
  yearly_price: string
  monthly_link: string
  yearly_link: string | null
  display_order: number
  is_active: boolean
  discord_role_id?: string | null
  discord_role_name?: string | null
  created_at?: string
  updated_at?: string
}

// ============================================
// RBAC Permission Types
// ============================================

// Simple RBAC: Discord Role → Tabs mapping
export interface RolePermission {
  discord_role_id: string
  role_name: string
  role_color?: string | null
  allowed_tabs: string[]
  created_at: string
  updated_at: string
}

// Tab IDs for type safety
export type MemberTab = 'dashboard' | 'journal' | 'library' | 'profile'

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
  // Tier-based content access
  | 'access_core_content'
  | 'access_pro_content'
  | 'access_executive_content'
  // Feature-specific permissions
  | 'access_trading_journal'
  | 'access_ai_analysis'
  | 'access_course_library'
  | 'access_live_alerts'
  | 'access_community_chat'
  // Premium features
  | 'access_premium_tools'
  | 'access_position_builder'
  | 'access_market_structure'
  // Admin permissions
  | 'admin_dashboard'
  | 'manage_courses'
  | 'manage_members'
  | 'manage_settings'
  | 'manage_journal_entries'
  | 'manage_discord_config'

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

// User Permissions Types (Discord Role Sync)
// ============================================

export interface UserPermission {
  id: string
  user_id: string
  discord_user_id: string | null
  permission_id: string
  granted_by_role_id: string | null
  granted_by_role_name: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface UserDiscordProfile {
  id: string
  user_id: string
  discord_user_id: string
  discord_username: string | null
  discord_discriminator: string | null
  discord_avatar: string | null
  discord_roles: string[]
  last_synced_at: string
  created_at: string
  updated_at: string
}

export interface UserPermissionWithDetails extends UserPermission {
  app_permissions: AppPermission
}

// Discord Sync Response Types
export interface DiscordSyncResult {
  success: boolean
  discord_user_id: string
  discord_username: string
  roles: Array<{
    id: string
    name: string | null
  }>
  permissions: Array<{
    id: string
    name: string
    description: string | null
    granted_by_role: string | null
  }>
  synced_at: string
}

export interface DiscordSyncError {
  success: false
  error: string
}
