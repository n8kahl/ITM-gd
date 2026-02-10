import { defineConfig, devices } from '@playwright/test'

const aiCoachMode = process.env.E2E_AI_COACH_MODE || 'mock'
const isAICoachLiveMode = aiCoachMode === 'live'
const defaultLiveBackendUrl = 'http://localhost:3101'
const e2eBackendUrl = process.env.E2E_BACKEND_URL
  || process.env.NEXT_PUBLIC_AI_COACH_API_URL
  || (isAICoachLiveMode ? defaultLiveBackendUrl : 'http://localhost:3001')

if (isAICoachLiveMode && !process.env.E2E_BACKEND_URL) {
  process.env.E2E_BACKEND_URL = e2eBackendUrl
}

function shouldStartLocalBackendServer(): boolean {
  if (!isAICoachLiveMode) return false

  try {
    const hostname = new URL(e2eBackendUrl).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

const webServers: NonNullable<ReturnType<typeof defineConfig>['webServer']> = [
  {
    command: `E2E_BYPASS_AUTH=true NEXT_PUBLIC_E2E_BYPASS_AUTH=true NEXT_PUBLIC_E2E_BYPASS_SHARED_SECRET=${process.env.E2E_BYPASS_SHARED_SECRET || ''} NEXT_PUBLIC_AI_COACH_API_URL=${e2eBackendUrl} pnpm dev`,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
]

if (shouldStartLocalBackendServer()) {
  const backendPort = new URL(e2eBackendUrl).port || '3001'
  webServers.push({
    command: `PORT=${backendPort} E2E_BYPASS_AUTH=true E2E_BYPASS_SHARED_SECRET=${process.env.E2E_BYPASS_SHARED_SECRET || ''} npm run dev`,
    cwd: 'backend',
    url: e2eBackendUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  })
}

/**
 * Playwright E2E Test Configuration
 *
 * Run all tests: pnpm test:e2e
 * Run critical auth tests: pnpm test:e2e:auth
 * Run health checks: pnpm test:e2e:health
 * Run with UI: pnpm test:e2e:ui
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  timeout: 30000, // 30 second timeout per test
  expect: {
    timeout: 10000, // 10 second timeout for expect assertions
    toHaveScreenshot: {
      // Allow minor anti-aliasing/font rendering variance across CI runners.
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    // GitHub Actions reporter for better CI integration
    ...(process.env.CI ? [['github'] as const] : []),
    // Console output
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Viewport for consistent testing
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    // Critical auth tests - run first, fail fast
    {
      name: 'auth-critical',
      testMatch: /auth-health-check\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Full auth flow tests
    {
      name: 'auth-flow',
      testMatch: /discord-auth-flow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // AI Coach tests
    {
      name: 'ai-coach',
      testMatch: /ai-coach.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'x-e2e-bypass-auth': '1',
        },
      },
    },
    // All other tests
    {
      name: 'chromium',
      testIgnore: /auth-health-check\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile testing for responsive auth
    {
      name: 'mobile',
      testMatch: /auth-health-check\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
    // Mobile regression coverage for member academy UX
    {
      name: 'mobile-members',
      testMatch: /academy-layout\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        extraHTTPHeaders: {
          'x-e2e-bypass-auth': '1',
        },
      },
    },
  ],
  webServer: webServers,
})
