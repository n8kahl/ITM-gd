/**
 * Trade Journal Refactor — Agent Orchestration System
 *
 * Validates each phase against the governing spec before allowing progression.
 * Run: npx tsx scripts/journal-refactor/orchestrate.ts <command>
 *
 * Commands:
 *   validate-phase <phase>   Validate a phase's spec compliance + quality gates
 *   status                   Show current execution status
 *   gate <phase>             Run quality gate commands for a phase
 *   check-spec <phase>       Check spec compliance for a phase (file-level)
 *   agent-brief <role>       Generate agent briefing for a specific role
 *   pre-flight               Verify all prerequisites before starting Phase 1
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// ─── Configuration ───────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../..')
const SPEC_PATH = path.join(ROOT, 'docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md')
const TRACKER_PATH = path.join(ROOT, 'docs/specs/journal-refactor-autonomous-2026-02-24/08_AUTONOMOUS_EXECUTION_TRACKER.md')
const PROPOSAL_PATH = path.join(ROOT, 'docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md')

// ─── Phase Definitions (derived from spec) ──────────────────────────────────

interface SpecCheck {
  id: string
  description: string
  validate: () => boolean | string
}

interface PhaseGate {
  commands: string[]
  specChecks: SpecCheck[]
}

const PHASES: Record<number, PhaseGate> = {
  1: {
    commands: [
      'pnpm exec tsc --noEmit',
      'pnpm exec eslint components/journal/ components/ai-coach/ lib/api/ --max-warnings=0',
      'pnpm vitest run lib/journal/__tests__ --reporter=verbose',
      'pnpm vitest run lib/validation/__tests__ --reporter=verbose',
    ],
    specChecks: [
      {
        id: 'P1-SC01',
        description: 'components/ai-coach/trade-journal.tsx deleted',
        validate: () => !fileExists('components/ai-coach/trade-journal.tsx'),
      },
      {
        id: 'P1-SC02',
        description: 'components/ai-coach/journal-insights.tsx deleted (if only used by trade-journal.tsx)',
        validate: () => {
          if (!fileExists('components/ai-coach/journal-insights.tsx')) return true
          // If it exists, check if anything besides trade-journal.tsx imports it
          const imports = grepSync('journal-insights', 'components/ app/ lib/', '--include=*.tsx --include=*.ts')
          const nonDeletedImports = imports.filter(
            (line) => !line.includes('trade-journal.tsx') && !line.includes('journal-insights.tsx')
          )
          return nonDeletedImports.length > 0
            ? true // Still has consumers, keeping is correct
            : 'File exists but has no remaining consumers — should be deleted'
        },
      },
      {
        id: 'P1-SC03',
        description: 'getTrades/createTrade/deleteTrade/getTradeAnalytics removed from lib/api/ai-coach.ts',
        validate: () => {
          if (!fileExists('lib/api/ai-coach.ts')) return true
          const content = readFileSync('lib/api/ai-coach.ts')
          const forbidden = ['getTrades', 'createTrade', 'deleteTrade', 'getTradeAnalytics']
          const found = forbidden.filter((fn) => content.includes(fn))
          return found.length === 0
            ? true
            : `Still exports: ${found.join(', ')}`
        },
      },
      {
        id: 'P1-SC04',
        description: 'analyzeScreenshot preserved in lib/api/ai-coach.ts',
        validate: () => {
          if (!fileExists('lib/api/ai-coach.ts')) return 'File does not exist'
          const content = readFileSync('lib/api/ai-coach.ts')
          return content.includes('analyzeScreenshot')
            ? true
            : 'analyzeScreenshot function missing'
        },
      },
      {
        id: 'P1-SC05',
        description: 'setup_type column migration exists',
        validate: () => {
          const migrations = fs.readdirSync(path.join(ROOT, 'supabase/migrations'))
          const hasSetupType = migrations.some((f) => f.includes('journal_setup_type') || f.includes('journal_refactor'))
          if (!hasSetupType) return 'No migration for setup_type column found'
          // Verify migration content
          const migrationFile = migrations.find((f) => f.includes('journal_setup_type') || f.includes('journal_refactor'))
          if (!migrationFile) return 'Migration file not found'
          const content = fs.readFileSync(path.join(ROOT, 'supabase/migrations', migrationFile), 'utf-8')
          if (!content.includes('setup_type')) return 'Migration does not add setup_type column'
          if (!content.includes('user_id') && !content.includes('idx_journal_user_setup_type'))
            return 'Migration missing index on (user_id, setup_type)'
          return true
        },
      },
      {
        id: 'P1-SC06',
        description: 'Journal slide-over component exists',
        validate: () =>
          fileExists('components/journal/journal-slide-over.tsx')
            ? true
            : 'components/journal/journal-slide-over.tsx not found',
      },
      {
        id: 'P1-SC07',
        description: 'Zero imports of deleted files remain',
        validate: () => {
          const deletedFiles = ['ai-coach/trade-journal', 'ai-coach/journal-insights']
          const violations: string[] = []
          for (const deleted of deletedFiles) {
            const imports = grepSync(deleted, 'components/ app/ lib/ contexts/ hooks/', '--include=*.tsx --include=*.ts')
            const real = imports.filter((l) => !l.includes('node_modules') && !l.includes('.test.') && !l.includes('.spec.'))
            if (real.length > 0) violations.push(`${deleted}: ${real.length} import(s) remain`)
          }
          return violations.length === 0 ? true : violations.join('; ')
        },
      },
    ],
  },
  2: {
    commands: [
      'pnpm exec tsc --noEmit',
      'pnpm exec eslint components/journal/ backend/src/services/journal/ --max-warnings=0',
      'pnpm vitest run lib/journal/__tests__ --reporter=verbose',
      'pnpm exec playwright test e2e/specs/members/journal.spec.ts e2e/specs/members/journal-filters.spec.ts e2e/specs/members/journal-import.spec.ts --project=chromium --workers=1',
    ],
    specChecks: [
      {
        id: 'P2-SC01',
        description: 'Auto-draft creator service exists',
        validate: () =>
          fileExists('backend/src/services/journal/autoDraftCreator.ts')
            ? true
            : 'backend/src/services/journal/autoDraftCreator.ts not found',
      },
      {
        id: 'P2-SC02',
        description: 'Auto-draft creates is_draft:true entries',
        validate: () => {
          if (!fileExists('backend/src/services/journal/autoDraftCreator.ts'))
            return 'Service file not found'
          const content = readFileSync('backend/src/services/journal/autoDraftCreator.ts')
          return content.includes('is_draft')
            ? true
            : 'Service does not reference is_draft field'
        },
      },
      {
        id: 'P2-SC03',
        description: 'Draft notification component exists',
        validate: () =>
          fileExists('components/journal/draft-notification.tsx')
            ? true
            : 'components/journal/draft-notification.tsx not found',
      },
      {
        id: 'P2-SC04',
        description: 'Psychology prompt component exists',
        validate: () =>
          fileExists('components/journal/psychology-prompt.tsx')
            ? true
            : 'components/journal/psychology-prompt.tsx not found',
      },
      {
        id: 'P2-SC05',
        description: 'Context builder service exists',
        validate: () =>
          fileExists('backend/src/services/journal/contextBuilder.ts')
            ? true
            : 'backend/src/services/journal/contextBuilder.ts not found',
      },
      {
        id: 'P2-SC06',
        description: 'Auto-draft only triggers for SPX CC-originated trades',
        validate: () => {
          if (!fileExists('backend/src/services/journal/autoDraftCreator.ts'))
            return 'Service file not found'
          const content = readFileSync('backend/src/services/journal/autoDraftCreator.ts')
          // Must have origin check or SPX CC reference
          return content.includes('spx') || content.includes('SPX') || content.includes('setup_type') || content.includes('origin')
            ? true
            : 'No SPX CC origin check detected — auto-draft may fire for all trades'
        },
      },
      {
        id: 'P2-SC07',
        description: 'Auto-draft pre-fills market_context',
        validate: () => {
          if (!fileExists('backend/src/services/journal/autoDraftCreator.ts'))
            return 'Service file not found'
          const content = readFileSync('backend/src/services/journal/autoDraftCreator.ts')
          return content.includes('market_context')
            ? true
            : 'No market_context pre-fill detected'
        },
      },
    ],
  },
  3: {
    commands: [
      'pnpm exec tsc --noEmit',
      'pnpm exec eslint backend/src/services/journal/ components/journal/ app/api/members/journal/ --max-warnings=0',
      'pnpm vitest run lib/journal/__tests__ --reporter=verbose',
      'pnpm exec playwright test e2e/specs/members/journal.spec.ts --project=chromium --workers=1',
    ],
    specChecks: [
      {
        id: 'P3-SC01',
        description: 'Bias detector service exists with 5 cognitive biases',
        validate: () => {
          if (!fileExists('backend/src/services/journal/biasDetector.ts'))
            return 'backend/src/services/journal/biasDetector.ts not found'
          const content = readFileSync('backend/src/services/journal/biasDetector.ts')
          const biases = ['overconfidence', 'revenge', 'anchoring', 'disposition', 'recency']
          const found = biases.filter((b) => content.toLowerCase().includes(b))
          return found.length >= 5
            ? true
            : `Only ${found.length}/5 biases detected: missing ${biases.filter((b) => !found.includes(b)).join(', ')}`
        },
      },
      {
        id: 'P3-SC02',
        description: 'Bias detection requires minimum 20 trades',
        validate: () => {
          if (!fileExists('backend/src/services/journal/biasDetector.ts'))
            return 'Service file not found'
          const content = readFileSync('backend/src/services/journal/biasDetector.ts')
          return content.includes('20') || content.includes('MIN_TRADES') || content.includes('minimum')
            ? true
            : 'No minimum trade threshold detected — risk of false positives (R-002)'
        },
      },
      {
        id: 'P3-SC03',
        description: 'Regime tagging service exists with 4 regime categories',
        validate: () => {
          if (!fileExists('backend/src/services/journal/regimeTagging.ts'))
            return 'backend/src/services/journal/regimeTagging.ts not found'
          const content = readFileSync('backend/src/services/journal/regimeTagging.ts')
          const regimes = ['vix', 'trend', 'gex', 'time']
          const found = regimes.filter((r) => content.toLowerCase().includes(r))
          return found.length >= 4
            ? true
            : `Only ${found.length}/4 regime categories: missing ${regimes.filter((r) => !found.includes(r)).join(', ')}`
        },
      },
      {
        id: 'P3-SC04',
        description: 'Analytics endpoint returns regime breakdowns',
        validate: () => {
          const content = readFileSync('app/api/members/journal/analytics/route.ts')
          return content.includes('regime') || content.includes('Regime')
            ? true
            : 'Analytics route does not reference regime breakdowns'
        },
      },
      {
        id: 'P3-SC05',
        description: 'Analytics endpoint returns setup-type performance',
        validate: () => {
          const content = readFileSync('app/api/members/journal/analytics/route.ts')
          return content.includes('setup_type') || content.includes('setupType')
            ? true
            : 'Analytics route does not reference setup-type performance'
        },
      },
      {
        id: 'P3-SC06',
        description: 'Bias insights card component exists',
        validate: () =>
          fileExists('components/journal/bias-insights-card.tsx')
            ? true
            : 'components/journal/bias-insights-card.tsx not found',
      },
      {
        id: 'P3-SC07',
        description: 'Regime breakdown component exists',
        validate: () =>
          fileExists('components/journal/regime-breakdown.tsx')
            ? true
            : 'components/journal/regime-breakdown.tsx not found',
      },
      {
        id: 'P3-SC08',
        description: 'Setup performance component exists',
        validate: () =>
          fileExists('components/journal/setup-performance.tsx')
            ? true
            : 'components/journal/setup-performance.tsx not found',
      },
    ],
  },
  4: {
    commands: [
      'pnpm exec tsc --noEmit',
      'pnpm exec eslint . --max-warnings=0',
      'pnpm vitest run --reporter=verbose',
      'pnpm exec playwright test e2e/specs/members/journal.spec.ts --project=chromium --workers=1',
    ],
    specChecks: [
      {
        id: 'P4-SC01',
        description: 'Pre-trade context API endpoint exists',
        validate: () =>
          fileExists('app/api/members/journal/context/route.ts')
            ? true
            : 'app/api/members/journal/context/route.ts not found',
      },
      {
        id: 'P4-SC02',
        description: 'Context endpoint accepts setupType and symbol params',
        validate: () => {
          if (!fileExists('app/api/members/journal/context/route.ts'))
            return 'Endpoint not found'
          const content = readFileSync('app/api/members/journal/context/route.ts')
          return (content.includes('setupType') || content.includes('setup_type'))
            && content.includes('symbol')
            ? true
            : 'Endpoint missing setupType or symbol parameter handling'
        },
      },
      {
        id: 'P4-SC03',
        description: 'Pre-trade context widget component exists',
        validate: () =>
          fileExists('components/journal/pre-trade-context.tsx')
            ? true
            : 'components/journal/pre-trade-context.tsx not found',
      },
      {
        id: 'P4-SC04',
        description: 'AI grading enhanced with history context',
        validate: () => {
          const content = readFileSync('app/api/members/journal/grade/route.ts')
          return content.includes('history') || content.includes('recent') || content.includes('previous')
            ? true
            : 'Grade endpoint does not reference trade history context'
        },
      },
      {
        id: 'P4-SC05',
        description: 'Chart overlay component exists',
        validate: () =>
          fileExists('components/journal/chart-entry-overlay.tsx')
            ? true
            : 'components/journal/chart-entry-overlay.tsx not found',
      },
    ],
  },
  5: {
    commands: [
      'pnpm exec eslint .',
      'pnpm exec tsc --noEmit',
      'pnpm run build',
      'pnpm vitest run',
      'pnpm exec playwright test e2e/specs/members/journal*.spec.ts --project=chromium --workers=1',
    ],
    specChecks: [
      {
        id: 'P5-SC01',
        description: 'New E2E tests exist for smart capture',
        validate: () =>
          fileExists('e2e/specs/members/journal-smart-capture.spec.ts')
            ? true
            : 'e2e/specs/members/journal-smart-capture.spec.ts not found',
      },
      {
        id: 'P5-SC02',
        description: 'New E2E tests exist for analytics v2',
        validate: () =>
          fileExists('e2e/specs/members/journal-analytics-v2.spec.ts')
            ? true
            : 'e2e/specs/members/journal-analytics-v2.spec.ts not found',
      },
      {
        id: 'P5-SC03',
        description: 'Release notes exist',
        validate: () => {
          const files = fs.readdirSync(path.join(ROOT, 'docs/specs'))
          return files.some((f) => f.includes('TRADE_JOURNAL') && f.includes('RELEASE_NOTES'))
            ? true
            : 'No release notes found in docs/specs/'
        },
      },
      {
        id: 'P5-SC04',
        description: 'Runbook exists',
        validate: () => {
          const specs = fs.readdirSync(path.join(ROOT, 'docs/specs'))
          const tradeDocs = fs.existsSync(path.join(ROOT, 'docs/trade-journal'))
            ? fs.readdirSync(path.join(ROOT, 'docs/trade-journal'))
            : []
          return [...specs, ...tradeDocs].some((f) => f.includes('RUNBOOK') && f.toLowerCase().includes('journal'))
            ? true
            : 'No runbook found'
        },
      },
      {
        id: 'P5-SC05',
        description: 'Zero any types in new code',
        validate: () => {
          const newFiles = [
            'backend/src/services/journal/biasDetector.ts',
            'backend/src/services/journal/regimeTagging.ts',
            'backend/src/services/journal/contextBuilder.ts',
            'backend/src/services/journal/autoDraftCreator.ts',
            'components/journal/journal-slide-over.tsx',
            'components/journal/bias-insights-card.tsx',
            'components/journal/regime-breakdown.tsx',
            'components/journal/setup-performance.tsx',
            'components/journal/pre-trade-context.tsx',
            'components/journal/draft-notification.tsx',
            'components/journal/psychology-prompt.tsx',
            'components/journal/chart-entry-overlay.tsx',
            'app/api/members/journal/context/route.ts',
          ]
          const violations: string[] = []
          for (const file of newFiles) {
            if (!fileExists(file)) continue
            const content = readFileSync(file)
            // Match ": any" but not "// any" or "* any"
            const anyMatches = content.match(/:\s*any\b/g)
            if (anyMatches && anyMatches.length > 0) {
              violations.push(`${file}: ${anyMatches.length} \`any\` type(s)`)
            }
          }
          return violations.length === 0
            ? true
            : violations.join('; ')
        },
      },
    ],
  },
}

// ─── Agent Role Definitions ──────────────────────────────────────────────────

interface AgentRole {
  name: string
  model: 'opus' | 'sonnet' | 'haiku'
  owns: string[]
  reads: string[]
  never: string[]
  slices: string[]
}

const AGENT_ROLES: Record<string, AgentRole> = {
  orchestrator: {
    name: 'Orchestrator',
    model: 'opus',
    owns: ['docs/specs/*journal*', 'scripts/journal-refactor/*'],
    reads: ['**/*'],
    never: [],
    slices: ['All gates', 'Coordination'],
  },
  frontend: {
    name: 'Frontend Agent',
    model: 'sonnet',
    owns: [
      'components/journal/**',
      'app/members/journal/**',
      'components/ai-coach/trade-journal.tsx',
      'components/ai-coach/journal-insights.tsx',
      'lib/api/ai-coach.ts',
    ],
    reads: ['lib/types/journal.ts', 'lib/validation/journal-entry.ts', 'app/api/members/journal/**/route.ts'],
    never: ['backend/**', 'supabase/migrations/**', 'lib/spx/**'],
    slices: ['1A', '1B', '1D', '2B', '2C', '2D', '3D', '3E', '4B', '4E'],
  },
  backend: {
    name: 'Backend Agent',
    model: 'sonnet',
    owns: [
      'backend/src/services/journal/**',
      'app/api/members/journal/**/route.ts',
      'backend/src/chatkit/functionHandlers.ts',
    ],
    reads: ['lib/types/journal.ts', 'lib/validation/journal-entry.ts', 'lib/spx/engine.ts'],
    never: ['components/**', 'app/members/**', 'e2e/**'],
    slices: ['2A', '2E', '3A', '3B', '3C', '4A', '4C', '4D'],
  },
  database: {
    name: 'Database Agent',
    model: 'sonnet',
    owns: ['supabase/migrations/*journal*'],
    reads: ['lib/types/journal.ts', 'docs/specs/TRADE_JOURNAL_V2_SPEC.md'],
    never: ['components/**', 'app/**', 'backend/**'],
    slices: ['1C'],
  },
  qa: {
    name: 'QA Agent',
    model: 'sonnet',
    owns: ['e2e/specs/members/journal*.spec.ts', 'e2e/specs/members/journal-test-helpers.ts'],
    reads: ['**/*'],
    never: [],
    slices: ['5A', '5B', '5C'],
  },
  docs: {
    name: 'Docs Agent',
    model: 'haiku',
    owns: ['docs/specs/*journal*', 'docs/trade-journal/**'],
    reads: ['**/*'],
    never: [],
    slices: ['5D'],
  },
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function readFileSync(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8')
}

function grepSync(pattern: string, searchPath: string, flags = ''): string[] {
  try {
    const fullPaths = searchPath.split(' ').map((p) => path.join(ROOT, p)).join(' ')
    const result = execSync(`grep -r "${pattern}" ${fullPaths} ${flags} 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 10_000,
    })
    return result.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function runCommand(cmd: string): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 300_000, // 5 min timeout for build commands
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return { success: true, output: output.trim() }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      success: false,
      output: (err.stdout || '') + '\n' + (err.stderr || err.message || ''),
    }
  }
}

// ─── Commands ───────────────────────────────────────────────────────────────

function validatePhase(phase: number): void {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  PHASE ${phase} VALIDATION`)
  console.log(`${'='.repeat(70)}\n`)

  const phaseDef = PHASES[phase]
  if (!phaseDef) {
    console.error(`Unknown phase: ${phase}. Valid phases: ${Object.keys(PHASES).join(', ')}`)
    process.exit(1)
  }

  // 1. Spec compliance checks
  console.log('--- SPEC COMPLIANCE CHECKS ---\n')
  let specPass = 0
  let specFail = 0

  for (const check of phaseDef.specChecks) {
    const result = check.validate()
    if (result === true) {
      console.log(`  [PASS] ${check.id}: ${check.description}`)
      specPass++
    } else {
      console.log(`  [FAIL] ${check.id}: ${check.description}`)
      console.log(`         Reason: ${result}`)
      specFail++
    }
  }

  console.log(`\n  Spec Compliance: ${specPass} passed, ${specFail} failed`)

  // 2. Quality gate commands
  console.log('\n--- QUALITY GATE COMMANDS ---\n')
  let gatePass = 0
  let gateFail = 0

  for (const cmd of phaseDef.commands) {
    console.log(`  Running: ${cmd}`)
    const result = runCommand(cmd)
    if (result.success) {
      console.log(`  [PASS] ${cmd.split(' ').slice(0, 3).join(' ')}...`)
      gatePass++
    } else {
      console.log(`  [FAIL] ${cmd.split(' ').slice(0, 3).join(' ')}...`)
      // Show first 10 lines of error
      const lines = result.output.split('\n').slice(0, 10)
      for (const line of lines) {
        console.log(`         ${line}`)
      }
      gateFail++
    }
  }

  console.log(`\n  Quality Gates: ${gatePass} passed, ${gateFail} failed`)

  // 3. Summary
  console.log(`\n${'─'.repeat(70)}`)
  const overallPass = specFail === 0 && gateFail === 0
  console.log(`  PHASE ${phase} RESULT: ${overallPass ? 'PASS' : 'FAIL'}`)
  console.log(`  Spec: ${specPass}/${specPass + specFail}  Gates: ${gatePass}/${gatePass + gateFail}`)
  console.log(`${'─'.repeat(70)}\n`)

  if (!overallPass) {
    console.log('  Phase cannot proceed until all checks pass.')
    console.log('  Fix the failures above and re-run: npx tsx scripts/journal-refactor/orchestrate.ts validate-phase ' + phase)
  }

  process.exit(overallPass ? 0 : 1)
}

function checkSpec(phase: number): void {
  console.log(`\n--- PHASE ${phase} SPEC COMPLIANCE ---\n`)

  const phaseDef = PHASES[phase]
  if (!phaseDef) {
    console.error(`Unknown phase: ${phase}`)
    process.exit(1)
  }

  for (const check of phaseDef.specChecks) {
    const result = check.validate()
    if (result === true) {
      console.log(`  [PASS] ${check.id}: ${check.description}`)
    } else {
      console.log(`  [FAIL] ${check.id}: ${check.description}`)
      console.log(`         ${result}`)
    }
  }
}

function runGate(phase: number): void {
  console.log(`\n--- PHASE ${phase} QUALITY GATES ---\n`)

  const phaseDef = PHASES[phase]
  if (!phaseDef) {
    console.error(`Unknown phase: ${phase}`)
    process.exit(1)
  }

  let failures = 0
  for (const cmd of phaseDef.commands) {
    console.log(`\n  $ ${cmd}`)
    const result = runCommand(cmd)
    if (result.success) {
      console.log(`  [PASS]`)
    } else {
      console.log(`  [FAIL]`)
      console.log(result.output.split('\n').map((l) => `    ${l}`).join('\n'))
      failures++
    }
  }

  process.exit(failures > 0 ? 1 : 0)
}

function showStatus(): void {
  console.log(`\n${'='.repeat(70)}`)
  console.log('  TRADE JOURNAL REFACTOR — EXECUTION STATUS')
  console.log(`${'='.repeat(70)}\n`)

  for (const [phaseNum, phaseDef] of Object.entries(PHASES)) {
    console.log(`\n  Phase ${phaseNum}:`)
    let pass = 0
    let fail = 0
    for (const check of phaseDef.specChecks) {
      const result = check.validate()
      if (result === true) {
        pass++
      } else {
        fail++
      }
    }
    const total = pass + fail
    const bar = '█'.repeat(Math.round((pass / total) * 20)) + '░'.repeat(Math.round((fail / total) * 20))
    console.log(`    Spec: [${bar}] ${pass}/${total}`)
    console.log(`    Status: ${fail === 0 ? 'READY' : 'NOT STARTED / IN PROGRESS'}`)
  }

  console.log('')
}

function agentBrief(role: string): void {
  const agent = AGENT_ROLES[role]
  if (!agent) {
    console.error(`Unknown role: ${role}. Valid: ${Object.keys(AGENT_ROLES).join(', ')}`)
    process.exit(1)
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log(`  AGENT BRIEFING: ${agent.name}`)
  console.log(`${'='.repeat(70)}\n`)

  console.log(`  Model: ${agent.model}`)
  console.log(`  Assigned Slices: ${agent.slices.join(', ')}`)
  console.log(`\n  File Ownership:`)
  for (const own of agent.owns) console.log(`    OWNS:  ${own}`)
  for (const read of agent.reads) console.log(`    READS: ${read}`)
  for (const no of agent.never) console.log(`    NEVER: ${no}`)

  console.log('\n  Governing Documents:')
  console.log(`    Spec:     ${SPEC_PATH}`)
  console.log(`    Proposal: ${PROPOSAL_PATH}`)
  console.log(`    Tracker:  ${TRACKER_PATH}`)

  // Show slice details for this agent
  console.log('\n  Slice Details:')
  for (const [phaseNum, phaseDef] of Object.entries(PHASES)) {
    for (const check of phaseDef.specChecks) {
      // Check if this check relates to the agent's slices
      console.log(`    ${check.id}: ${check.description}`)
    }
  }
}

function preFlight(): void {
  console.log(`\n${'='.repeat(70)}`)
  console.log('  PRE-FLIGHT CHECK')
  console.log(`${'='.repeat(70)}\n`)

  const checks = [
    { name: 'Execution spec exists', check: () => fileExists('docs/specs/TRADE_JOURNAL_REFACTOR_EXECUTION_SPEC_2026-02-24.md') },
    { name: 'Proposal exists', check: () => fileExists('docs/trade-journal/TRADE_JOURNAL_CRITIQUE_AND_REFACTOR_PROPOSAL_2026-02-24.md') },
    { name: 'Tracker exists', check: () => fileExists('docs/specs/journal-refactor-autonomous-2026-02-24/08_AUTONOMOUS_EXECUTION_TRACKER.md') },
    { name: 'Change control exists', check: () => fileExists('docs/specs/journal-refactor-autonomous-2026-02-24/06_CHANGE_CONTROL_AND_PR_STANDARD.md') },
    { name: 'Risk register exists', check: () => fileExists('docs/specs/journal-refactor-autonomous-2026-02-24/07_RISK_REGISTER_AND_DECISION_LOG.md') },
    { name: 'Orchestration script exists', check: () => fileExists('scripts/journal-refactor/orchestrate.ts') },
    { name: 'V2 spec exists', check: () => fileExists('docs/specs/TRADE_JOURNAL_V2_SPEC.md') },
    { name: 'Journal types exist', check: () => fileExists('lib/types/journal.ts') },
    { name: 'Journal validation exists', check: () => fileExists('lib/validation/journal-entry.ts') },
    { name: 'Journal page exists', check: () => fileExists('app/members/journal/page.tsx') },
    { name: 'Current journal components intact', check: () => {
      const required = [
        'components/journal/journal-filter-bar.tsx',
        'components/journal/journal-table-view.tsx',
        'components/journal/journal-card-view.tsx',
        'components/journal/trade-entry-sheet.tsx',
        'components/journal/entry-detail-sheet.tsx',
        'components/journal/import-wizard.tsx',
        'components/journal/screenshot-quick-add.tsx',
        'components/journal/journal-summary-stats.tsx',
        'components/journal/quick-entry-form.tsx',
        'components/journal/full-entry-form.tsx',
        'components/journal/analytics-dashboard.tsx',
      ]
      return required.every((f) => fileExists(f))
    }},
    { name: 'Supabase migrations directory exists', check: () => fs.existsSync(path.join(ROOT, 'supabase/migrations')) },
    { name: 'Backend services directory writable', check: () => {
      const dir = path.join(ROOT, 'backend/src/services')
      return fs.existsSync(dir)
    }},
  ]

  let allPass = true
  for (const { name, check } of checks) {
    const result = check()
    console.log(`  ${result ? '[PASS]' : '[FAIL]'} ${name}`)
    if (!result) allPass = false
  }

  console.log(`\n  Pre-flight: ${allPass ? 'ALL CLEAR' : 'BLOCKERS FOUND'}`)
  process.exit(allPass ? 0 : 1)
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [command, arg] = process.argv.slice(2)

switch (command) {
  case 'validate-phase':
    validatePhase(parseInt(arg, 10))
    break
  case 'check-spec':
    checkSpec(parseInt(arg, 10))
    break
  case 'gate':
    runGate(parseInt(arg, 10))
    break
  case 'status':
    showStatus()
    break
  case 'agent-brief':
    agentBrief(arg)
    break
  case 'pre-flight':
    preFlight()
    break
  default:
    console.log(`
Trade Journal Refactor — Agent Orchestration System

Usage: npx tsx scripts/journal-refactor/orchestrate.ts <command> [args]

Commands:
  validate-phase <1-5>   Full validation: spec compliance + quality gates
  check-spec <1-5>       Spec compliance checks only (fast, no build)
  gate <1-5>             Quality gate commands only (lint, types, tests)
  status                 Show current execution status across all phases
  agent-brief <role>     Generate briefing for: orchestrator, frontend, backend, database, qa, docs
  pre-flight             Verify all prerequisites before starting Phase 1
    `)
    process.exit(1)
}
