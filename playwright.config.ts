import { defineConfig, devices } from '@playwright/test'

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
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000, // 30 second timeout per test
  expect: {
    timeout: 10000, // 10 second timeout for expect assertions
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
      use: { ...devices['Desktop Chrome'] },
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
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
