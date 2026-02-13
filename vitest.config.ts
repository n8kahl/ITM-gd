import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/__tests__/**/*.test.ts', 'lib/validation/**/__tests__/**/*.test.ts', 'backend/**/__tests__/**/*.test.ts'],
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
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
