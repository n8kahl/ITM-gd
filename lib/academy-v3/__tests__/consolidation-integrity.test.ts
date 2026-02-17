import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const CONSOLIDATED_FILES = [
  'app/api/admin/analytics/route.ts',
  'app/api/admin/academy/analytics/route.ts',
  'lib/academy/resume.ts',
  'lib/academy/xp-utils.ts',
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
  ".rpc('increment_user_xp')",
  ".rpc('update_streak')",
]

function read(filePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8')
}

describe('academy consolidation integrity', () => {
  it('does not reference legacy academy progress tables in consolidated runtime paths', () => {
    const violations: string[] = []

    for (const file of CONSOLIDATED_FILES) {
      const content = read(file)
      for (const pattern of LEGACY_TABLE_PATTERNS) {
        if (content.includes(pattern)) {
          violations.push(`${file}: ${pattern}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('counts completed lesson attempts using passed status in v3 analytics', () => {
    const content = read('app/api/admin/academy/analytics/route.ts')
    const lessonAttemptsQueryPattern = /\.from\('academy_user_lesson_attempts'\)[\s\S]*?\.eq\('status', 'passed'\)/

    expect(content).toContain(".from('academy_user_lesson_attempts')")
    expect(content).toMatch(lessonAttemptsQueryPattern)
  })
})
