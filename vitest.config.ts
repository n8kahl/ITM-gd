import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    include: [
      'lib/**/__tests__/**/*.test.ts?(x)',
      'lib/validation/**/__tests__/**/*.test.ts?(x)',
      'components/**/__tests__/**/*.test.ts?(x)',
    ],
    exclude: [
      'backend/**',
      'e2e/**',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'lib/journal/trade-grading.ts',
        'lib/sanitize.ts',
        'lib/error-handler.ts',
        'lib/rate-limit.ts',
        'lib/validation/journal-entry.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 85,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
