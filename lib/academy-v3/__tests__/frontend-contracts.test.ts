/**
 * Academy V3 Frontend Contract Tests
 *
 * Validates that frontend components follow production quality standards:
 * - All components use glass-card-heavy (not hardcoded bg-[#111318])
 * - Error boundaries exist at every route level
 * - Loading states use skeleton-loader pattern
 * - No forbidden D4AF37 gold color
 * - Design system CSS variables used consistently
 *
 * PASSING CRITERIA:
 * - 0 occurrences of bg-[#111318] in academy components
 * - error.tsx exists at root + 3 sub-routes (4 total)
 * - loading.tsx exists at root + 3 sub-routes (4 total)
 * - 0 occurrences of #D4AF37 anywhere
 */
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const COMPONENTS_DIR = path.resolve(process.cwd(), 'components/academy-v3')
const ROUTES_DIR = path.resolve(process.cwd(), 'app/members/academy-v3')

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
    const allFiles = [
      ...getAllTsxFiles(COMPONENTS_DIR),
      ...getAllTsxFiles(ROUTES_DIR),
    ]
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
    const shellContent = readFileIfExists(path.join(COMPONENTS_DIR, 'academy-v3-shell.tsx'))
    expect(shellContent).not.toBeNull()
    expect(shellContent).toContain('glass-card-heavy')
  })

  it('academy sub-nav composes the shared FeatureSubNav', () => {
    const navContent = readFileIfExists(path.join(COMPONENTS_DIR, 'academy-v3-sub-nav.tsx'))
    expect(navContent).not.toBeNull()
    expect(navContent).toContain('FeatureSubNav')
  })
})

describe('error boundary coverage', () => {
  const ERROR_BOUNDARY_PATHS = [
    path.join(ROUTES_DIR, 'error.tsx'),
    path.join(ROUTES_DIR, 'modules/error.tsx'),
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
  it('all academy components are client components', () => {
    const components = [
      'plan-dashboard.tsx',
      'modules-catalog.tsx',
      'progress-overview.tsx',
      'review-workbench.tsx',
      'academy-v3-sub-nav.tsx',
    ]

    for (const comp of components) {
      const content = readFileIfExists(path.join(COMPONENTS_DIR, comp))
      expect(content).not.toBeNull()
      expect(content).toContain("'use client'")
    }
  })

  it('modules-catalog uses Image component from next/image', () => {
    const content = readFileIfExists(path.join(COMPONENTS_DIR, 'modules-catalog.tsx'))
    expect(content).toContain("import Image from 'next/image'")
  })

  it('components use Analytics tracking', () => {
    const components = ['plan-dashboard.tsx', 'modules-catalog.tsx', 'review-workbench.tsx']

    for (const comp of components) {
      const content = readFileIfExists(path.join(COMPONENTS_DIR, comp))
      expect(content).toContain('Analytics.trackAcademyAction')
    }
  })
})
