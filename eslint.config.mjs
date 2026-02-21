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
      'docs/specs/mockups/**',
      'app/members/ai-coach/mockup/**',
      'member-dashboard-mockup.jsx',
      'member-journal-mockup.jsx',
      'AICoachSpatialHUD.jsx',
      'spx-spatial-hud-mockup.jsx',
    ],
  },
]

export default eslintConfig
