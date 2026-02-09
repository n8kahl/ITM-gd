import nextConfig from 'eslint-config-next'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      'node_modules/',
      '.next/',
      'out/',
      'backend/',
      'supabase/functions/',
      'playwright-report/',
      'test-results/',
    ],
  },
]

export default eslintConfig
