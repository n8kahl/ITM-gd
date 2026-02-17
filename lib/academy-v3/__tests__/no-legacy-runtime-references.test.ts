import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const RUNTIME_DIRS = ['app', 'lib', 'components', 'backend']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const EXCLUDED_SEGMENTS = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '__tests__',
  'supabase',
  'docs',
])

const LEGACY_PATTERNS = [
  ".from('courses')",
  '.from("courses")',
  ".from('lessons')",
  '.from("lessons")',
  ".from('learning_paths')",
  '.from("learning_paths")',
  ".from('learning_path_courses')",
  '.from("learning_path_courses")',
  ".from('user_course_progress')",
  '.from("user_course_progress")',
  ".from('user_lesson_progress')",
  '.from("user_lesson_progress")',
  ".from('user_learning_activity_log')",
  '.from("user_learning_activity_log")',
  ".from('user_learning_profiles')",
  '.from("user_learning_profiles")',
  ".from('user_learning_insights')",
  '.from("user_learning_insights")',
  ".rpc('increment_user_xp')",
  '.rpc("increment_user_xp")',
  ".rpc('update_streak')",
  '.rpc("update_streak")',
]

function shouldSkipDir(name: string): boolean {
  return EXCLUDED_SEGMENTS.has(name)
}

function collectSourceFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue
      files.push(...collectSourceFiles(absolutePath))
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    if (!SOURCE_EXTENSIONS.has(extension)) continue
    files.push(absolutePath)
  }

  return files
}

describe('academy v3 retirement guardrails', () => {
  it('does not reference legacy academy tables in runtime source', () => {
    const violations: string[] = []

    for (const runtimeDir of RUNTIME_DIRS) {
      const absoluteDir = path.join(ROOT, runtimeDir)
      if (!fs.existsSync(absoluteDir)) continue

      const files = collectSourceFiles(absoluteDir)
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8')
        for (const pattern of LEGACY_PATTERNS) {
          if (content.includes(pattern)) {
            violations.push(`${path.relative(ROOT, filePath)}: ${pattern}`)
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
