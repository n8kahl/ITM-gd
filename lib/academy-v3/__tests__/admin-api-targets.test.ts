import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ADMIN_API_FILES = [
  'app/api/admin/courses/route.ts',
  'app/api/admin/lessons/route.ts',
  'app/api/admin/academy/generate-lesson/route.ts',
  'app/api/admin/academy/analytics/route.ts',
  'app/api/admin/academy/seed-health/route.ts',
]

const LEGACY_TABLE_PATTERNS = [
  ".from('courses')",
  ".from('lessons')",
  ".from('learning_paths')",
  ".from('learning_path_courses')",
  ".from('user_lesson_progress')",
  ".from('user_course_progress')",
  ".from('user_learning_profiles')",
  ".from('user_learning_activity_log')",
]

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8')
}

describe('academy admin APIs target academy_v3 tables', () => {
  it('does not reference legacy academy tables in migrated admin routes', () => {
    const violations: string[] = []

    for (const file of ADMIN_API_FILES) {
      const content = read(file)
      for (const pattern of LEGACY_TABLE_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push(`${file}: ${pattern}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('references academy_v3 tables in migrated admin routes', () => {
    const requiredSignals = [
      ".from('academy_modules')",
      ".from('academy_lessons')",
      ".from('academy_lesson_blocks')",
    ]

    const allContent = ADMIN_API_FILES.map(read).join('\n')
    for (const signal of requiredSignals) {
      expect(allContent).toContain(signal)
    }
  })
})
