import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    include: [
      'src/services/spx/__tests__/massiveDataValidation.test.ts',
      'src/services/spx/__tests__/setupDetectionPipeline.test.ts',
      'src/services/spx/__tests__/regimeClassifier.test.ts',
      'src/services/spx/__tests__/confluenceHardening.test.ts',
      'src/services/spx/__tests__/contractSelector.test.ts',
      'src/services/spx/__tests__/contractSelectionExpanded.test.ts',
      'src/services/options/__tests__/optionsChainFetcher.test.ts',
      'src/services/spx/__tests__/tickEvaluatorExpanded.test.ts',
      'src/services/spx/__tests__/outcomeTracker.test.ts',
      'src/services/__tests__/websocketReliability.test.ts',
      'src/services/spx/__tests__/levelsPipelineHardening.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
