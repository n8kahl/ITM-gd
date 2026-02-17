/**
 * Academy Frontend Contract Tests
 *
 * Validates production quality guardrails for the academy redesign:
 * - Components use design system primitives
 * - Error boundaries and loading states exist across academy routes
 * - Forbidden legacy gold color does not appear
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const COMPONENTS_DIR = path.resolve(process.cwd(), 'components/academy')
const ROUTES_DIR = path.resolve(process.cwd(), 'app/members/academy')

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...getAllTsxFiles(fullPath))
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return files
}

describe('design system compliance', () => {
  it('academy components do not use hardcoded bg-[#111318]', () => {
    const componentFiles = getAllTsxFiles(COMPONENTS_DIR)
    const violations: string[] = []

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('bg-[#111318]')) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('no forbidden gold color #D4AF37 in academy files', () => {
    const allFiles = [...getAllTsxFiles(COMPONENTS_DIR), ...getAllTsxFiles(ROUTES_DIR)]
    const violations: string[] = []

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('#D4AF37') || content.includes('#d4af37')) {
        violations.push(path.relative(process.cwd(), file))
      }
    }

    expect(violations).toEqual([])
  })

  it('academy shell uses glass-card-heavy', () => {
    const shellContent = readFileIfExists(path.join(COMPONENTS_DIR, 'academy-shell.tsx'))
    expect(shellContent).not.toBeNull()
    expect(shellContent).toContain('glass-card-heavy')
  })

  it('academy sub-nav composes the shared FeatureSubNav', () => {
    const navContent = readFileIfExists(path.join(COMPONENTS_DIR, 'academy-sub-nav.tsx'))
    expect(navContent).not.toBeNull()
    expect(navContent).toContain('FeatureSubNav')
  })
})

describe('error boundary coverage', () => {
  const ERROR_BOUNDARY_PATHS = [
    path.join(ROUTES_DIR, 'error.tsx'),
    path.join(ROUTES_DIR, 'modules/error.tsx'),
    path.join(ROUTES_DIR, 'modules/[slug]/error.tsx'),
    path.join(ROUTES_DIR, 'lessons/[id]/error.tsx'),
    path.join(ROUTES_DIR, 'review/error.tsx'),
    path.join(ROUTES_DIR, 'progress/error.tsx'),
  ]

  for (const errorPath of ERROR_BOUNDARY_PATHS) {
    const relativePath = path.relative(process.cwd(), errorPath)

    it(`error boundary exists: ${relativePath}`, () => {
      expect(fs.existsSync(errorPath)).toBe(true)
    })

    it(`error boundary is a client component: ${relativePath}`, () => {
      const content = fs.readFileSync(errorPath, 'utf-8')
      expect(content).toContain("'use client'")
    })

    it(`error boundary has reset function: ${relativePath}`, () => {
      const content = fs.readFileSync(errorPath, 'utf-8')
      expect(content).toContain('reset')
    })

    it(`error boundary uses glass-card-heavy: ${relativePath}`, () => {
      const content = fs.readFileSync(errorPath, 'utf-8')
      expect(content).toContain('glass-card-heavy')
    })
  }
})

describe('loading state coverage', () => {
  const LOADING_PATHS = [
    path.join(ROUTES_DIR, 'loading.tsx'),
    path.join(ROUTES_DIR, 'modules/loading.tsx'),
    path.join(ROUTES_DIR, 'modules/[slug]/loading.tsx'),
    path.join(ROUTES_DIR, 'lessons/[id]/loading.tsx'),
    path.join(ROUTES_DIR, 'review/loading.tsx'),
    path.join(ROUTES_DIR, 'progress/loading.tsx'),
  ]

  for (const loadingPath of LOADING_PATHS) {
    const relativePath = path.relative(process.cwd(), loadingPath)

    it(`loading state exists: ${relativePath}`, () => {
      expect(fs.existsSync(loadingPath)).toBe(true)
    })

    it(`loading state uses Skeleton component: ${relativePath}`, () => {
      const content = fs.readFileSync(loadingPath, 'utf-8')
      expect(content).toContain('Skeleton')
    })

    it(`loading state is a client component: ${relativePath}`, () => {
      const content = fs.readFileSync(loadingPath, 'utf-8')
      expect(content).toContain("'use client'")
    })
  }
})

describe('component quality checks', () => {
  it('interactive academy components are client components', () => {
    const components = [
      'academy-dashboard.tsx',
      'academy-module-catalog.tsx',
      'academy-module-detail.tsx',
      'academy-lesson-viewer.tsx',
      'academy-review-queue.tsx',
      'academy-progress-overview.tsx',
      'academy-sub-nav.tsx',
      'academy-module-card.tsx',
      'academy-lesson-row.tsx',
    ]

    for (const component of components) {
      const content = readFileIfExists(path.join(COMPONENTS_DIR, component))
      expect(content).not.toBeNull()
      expect(content).toContain("'use client'")
    }
  })

  it('lesson viewer uses AcademyMarkdown rendering', () => {
    const content = readFileIfExists(path.join(COMPONENTS_DIR, 'academy-lesson-viewer.tsx'))
    expect(content).toContain('AcademyMarkdown')
  })

  it('dashboard and progress components use Analytics tracking', () => {
    const components = ['academy-dashboard.tsx', 'academy-review-queue.tsx', 'academy-progress-overview.tsx']

    for (const component of components) {
      const content = readFileIfExists(path.join(COMPONENTS_DIR, component))
      expect(content).toContain('Analytics.trackAcademyAction')
    }
  })
})
