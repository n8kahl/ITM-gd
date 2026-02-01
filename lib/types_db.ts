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
