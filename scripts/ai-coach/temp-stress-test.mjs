#!/usr/bin/env node

/**
 * Temporary AI Coach stress harness.
 * Safe to delete after pre-deploy validation.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'

const DEFAULT_BYPASS_USER_ID = '00000000-0000-4000-8000-000000000001'

const FUNCTION_WIDGET_MAP = {
  get_key_levels: 'key_levels',
  get_market_status: 'market_overview',
  get_current_price: 'current_price',
  get_macro_context: 'macro_context',
  get_options_chain: 'options_chain',
  get_gamma_exposure: 'gex_profile',
  get_spx_game_plan: 'spx_game_plan',
  scan_opportunities: 'scan_results',
  get_zero_dte_analysis: 'zero_dte_analysis',
  get_iv_analysis: 'iv_analysis',
  get_earnings_calendar: 'earnings_calendar',
  get_earnings_analysis: 'earnings_analysis',
  get_journal_insights: 'journal_insights',
  get_trade_history: 'trade_history',
  get_trade_history_for_symbol: 'trade_history',
}

const WIDGET_ACTION_MAP = {
  key_levels: ['Show on Chart', 'View Options', 'Ask AI'],
  position_summary: ['Open Chart', 'View Options', 'Analyze'],
  pnl_tracker: ['Ask AI'],
  market_overview: ['Open Chart', 'Ask AI'],
  alert_status: ['Show on Chart', 'Set Alert'],
  macro_context: ['Ask AI'],
  options_chain: ['View Options', 'Open Chart', 'Ask AI'],
  gex_profile: ['Show on Chart', 'View Options', 'Ask AI'],
  scan_results: ['Show on Chart', 'View Options', 'Ask AI'],
  current_price: ['Show on Chart', 'View Options', 'Set Alert'],
  spx_game_plan: ['Show on Chart', 'View Options', 'Set Alert', 'Ask AI'],
  zero_dte_analysis: ['Show on Chart', 'View Options', 'Ask AI'],
  iv_analysis: ['View Options', 'Show on Chart', 'Ask AI'],
  earnings_calendar: ['Ask AI', 'Copy'],
  earnings_analysis: ['View Options', 'Show on Chart', 'Ask AI'],
  journal_insights: ['Ask AI', 'Copy'],
  trade_history: ['Ask AI', 'Copy'],
}

function parseArgs(argv) {
  const opts = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const key = arg.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      opts[key] = true
      continue
    }

    opts[key] = next
    i += 1
  }
  return opts
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseCategoryFilter(value) {
  if (!value || typeof value !== 'string') return null
  const categories = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return categories.length > 0 ? new Set(categories) : null
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index]
}

function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function normalizeFunctionCalls(functionCallsRaw) {
  if (!Array.isArray(functionCallsRaw)) return []
  return functionCallsRaw
    .map((call) => {
      if (!call || typeof call !== 'object') return null
      const fn = typeof call.function === 'string' ? call.function : ''
      const args = call.arguments && typeof call.arguments === 'object' ? call.arguments : {}
      return {
        function: fn,
        arguments: args,
        result: call.result,
      }
    })
    .filter(Boolean)
}

function inferWidgetsFromFunctionCalls(functionCalls) {
  const widgets = []
  for (const fc of functionCalls) {
    if (!fc.function) continue
    const result = fc.result && typeof fc.result === 'object' ? fc.result : {}
    if (result && result.error) continue

    if (fc.function === 'analyze_position') {
      if (result && typeof result === 'object' && result.portfolio) {
        widgets.push('pnl_tracker')
      } else if (result && typeof result === 'object' && result.position) {
        widgets.push('position_summary')
      }
      continue
    }

    const widget = FUNCTION_WIDGET_MAP[fc.function]
    if (widget) widgets.push(widget)
  }

  return widgets
}

function dedupe(values) {
  return [...new Set(values)]
}

function buildActionMatrix(widgets) {
  return widgets.map((widgetType) => ({
    widgetType,
    actions: WIDGET_ACTION_MAP[widgetType] || [],
  }))
}

function clip(text, max = 280) {
  const str = String(text || '').replace(/\s+/g, ' ').trim()
  if (str.length <= max) return str
  return `${str.slice(0, max - 1)}…`
}

function isDataHeavyPrompt(prompt) {
  const haystack = prompt.toLowerCase()
  return [
    'spx', 'levels', 'option', 'gex', 'gamma', 'zero dte', 'earnings', 'scanner', 'journal', 'price', 'macro', 'chart',
  ].some((needle) => haystack.includes(needle))
}

function scoreResult({
  status,
  hasRequiredShape,
  contentLength,
  functionErrorCount,
  expectedWidgetMissCount,
  expectedFunctionMissCount,
  dataPromptWithNoWidgets,
  contractBlockingCount,
  contractWarningCount,
}) {
  if (status !== 200) return 0

  let score = 100
  if (!hasRequiredShape) score -= 35
  if (contentLength < 25) score -= 25
  else if (contentLength < 80) score -= 10

  score -= Math.min(30, functionErrorCount * 10)
  score -= Math.min(24, expectedWidgetMissCount * 8)
  score -= Math.min(15, expectedFunctionMissCount * 5)
  if (dataPromptWithNoWidgets) score -= 12
  score -= Math.min(25, contractBlockingCount * 8)
  score -= Math.min(10, contractWarningCount * 2)

  return Math.max(0, Math.min(100, score))
}

async function loadCases(promptsFile) {
  const raw = await readFile(promptsFile, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error(`Prompt file must be a JSON array: ${promptsFile}`)
  }

  return parsed
    .map((item, idx) => {
      if (!item || typeof item !== 'object') return null
      const id = typeof item.id === 'string' ? item.id : `case-${idx + 1}`
      const category = typeof item.category === 'string' ? item.category : 'general'
      const prompt = typeof item.prompt === 'string' ? item.prompt : ''
      const expectedWidgets = Array.isArray(item.expectedWidgets)
        ? item.expectedWidgets.filter((v) => typeof v === 'string')
        : []
      const expectedFunctions = Array.isArray(item.expectedFunctions)
        ? item.expectedFunctions.filter((v) => typeof v === 'string')
        : []

      if (!prompt.trim()) return null
      return {
        id,
        category,
        prompt: prompt.trim(),
        expectedWidgets,
        expectedFunctions,
      }
    })
    .filter(Boolean)
}

async function runOneCase({ apiBase, token, timeoutMs, caseDef, iteration, strictContract }) {
  const requestId = `${caseDef.id}#${iteration}`
  const start = Date.now()

  const requestBody = {
    sessionId: randomUUID(),
    message: caseDef.prompt,
  }

  let status = 0
  let payload = null
  let rawText = ''
  let networkError = null

  try {
    const response = await fetch(`${apiBase}/api/chat/message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-e2e-bypass-auth': '1',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    })

    status = response.status
    rawText = await response.text()
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch {
      payload = null
    }
  } catch (error) {
    networkError = error instanceof Error ? error.message : String(error)
  }

  const latencyMs = Date.now() - start
  const functionCalls = normalizeFunctionCalls(payload?.functionCalls)
  const calledFunctions = dedupe(functionCalls.map((fc) => fc.function).filter(Boolean))
  const widgets = dedupe(inferWidgetsFromFunctionCalls(functionCalls))
  const actionMatrix = buildActionMatrix(widgets)
  const contractAudit = payload?.contractAudit && typeof payload.contractAudit === 'object'
    ? payload.contractAudit
    : null

  const content = typeof payload?.content === 'string' ? payload.content : ''
  const contentLength = content.trim().length

  const hasRequiredShape = Boolean(
    payload
      && typeof payload === 'object'
      && typeof payload.sessionId === 'string'
      && typeof payload.messageId === 'string'
      && payload.role === 'assistant'
      && typeof payload.content === 'string',
  )

  const expectedWidgetMisses = caseDef.expectedWidgets.filter((w) => !widgets.includes(w))
  const expectedFunctionMisses = caseDef.expectedFunctions.filter((f) => !calledFunctions.includes(f))

  const functionErrorCount = functionCalls
    .map((fc) => fc.result)
    .filter((result) => result && typeof result === 'object' && result.error)
    .length

  const dataPromptWithNoWidgets = isDataHeavyPrompt(caseDef.prompt) && widgets.length === 0
  const contractBlockingViolations = Array.isArray(contractAudit?.blockingViolations)
    ? contractAudit.blockingViolations.filter((v) => typeof v === 'string')
    : []
  const contractWarnings = Array.isArray(contractAudit?.warnings)
    ? contractAudit.warnings.filter((v) => typeof v === 'string')
    : []
  const contractPassed = contractAudit && typeof contractAudit.passed === 'boolean'
    ? contractAudit.passed
    : null

  const warnings = []
  if (status === 200 && contentLength < 80) warnings.push('short_response')
  if (/i apologize|unable to generate response|service unavailable/i.test(content)) warnings.push('fallback_language')
  if (functionErrorCount > 0) warnings.push(`function_errors:${functionErrorCount}`)
  if (dataPromptWithNoWidgets) warnings.push('no_widgets_for_data_prompt')
  if (expectedWidgetMisses.length > 0) warnings.push(`missing_widgets:${expectedWidgetMisses.join(',')}`)
  if (expectedFunctionMisses.length > 0) warnings.push(`missing_functions:${expectedFunctionMisses.join(',')}`)
  if (!hasRequiredShape && status === 200) warnings.push('response_shape_mismatch')
  if (!contractAudit && status === 200) warnings.push('missing_contract_audit')
  if (contractBlockingViolations.length > 0) warnings.push(`contract_blocking:${contractBlockingViolations.join('|')}`)
  if (contractWarnings.length > 0) warnings.push(`contract_warnings:${contractWarnings.join('|')}`)

  const score = scoreResult({
    status,
    hasRequiredShape,
    contentLength,
    functionErrorCount,
    expectedWidgetMissCount: expectedWidgetMisses.length,
    expectedFunctionMissCount: expectedFunctionMisses.length,
    dataPromptWithNoWidgets,
    contractBlockingCount: contractBlockingViolations.length,
    contractWarningCount: contractWarnings.length,
  })

  const contractGatePassed = strictContract
    ? contractPassed === true && contractBlockingViolations.length === 0
    : true
  const passed = status === 200 && hasRequiredShape && contentLength > 0 && contractGatePassed

  return {
    requestId,
    caseId: caseDef.id,
    category: caseDef.category,
    prompt: caseDef.prompt,
    iteration,
    status,
    passed,
    score,
    latencyMs,
    tokensUsed: typeof payload?.tokensUsed === 'number' ? payload.tokensUsed : null,
    responseTime: typeof payload?.responseTime === 'number' ? payload.responseTime : null,
    calledFunctions,
    widgets,
    actionMatrix,
    contractAudit,
    warnings,
    contentPreview: clip(content, 320),
    rawError: networkError || null,
    rawResponsePreview: clip(rawText, 320),
  }
}

function toMarkdownReport({
  summary,
  results,
  outputDir,
  promptsFile,
  apiBase,
  iterations,
  concurrency,
  timeoutMs,
  strictContract,
}) {
  const failures = results.filter((r) => !r.passed)
  const highRisk = results
    .filter((r) => r.score < 70 || r.warnings.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 15)

  const widgetLines = Object.entries(summary.widgetCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([widget, count]) => `- ${widget}: ${count}`)
    .join('\n') || '- none'

  const functionLines = Object.entries(summary.functionCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([fn, count]) => `- ${fn}: ${count}`)
    .join('\n') || '- none'

  const issueBlocks = highRisk.length === 0
    ? 'No high-risk cases detected.'
    : highRisk.map((r) => {
        const actions = r.actionMatrix.length > 0
          ? r.actionMatrix.map((item) => `${item.widgetType}: ${item.actions.join(' | ') || 'none'}`).join('; ')
          : 'none'

        return [
          `### ${r.passed ? 'WARN' : 'FAIL'} ${r.requestId}`,
          `- Category: ${r.category}`,
          `- Status: ${r.status || 'network_error'} | Score: ${r.score} | Latency: ${r.latencyMs}ms`,
          `- Functions: ${r.calledFunctions.join(', ') || 'none'}`,
          `- Widgets: ${r.widgets.join(', ') || 'none'}`,
          `- Widget actions: ${actions}`,
          `- Warnings: ${r.warnings.join(', ') || 'none'}`,
          `- Contract blocking: ${Array.isArray(r.contractAudit?.blockingViolations) ? r.contractAudit.blockingViolations.join(', ') || 'none' : 'missing'}`,
          `- Contract warnings: ${Array.isArray(r.contractAudit?.warnings) ? r.contractAudit.warnings.join(', ') || 'none' : 'missing'}`,
          `- Prompt: ${r.prompt}`,
          `- Response preview: ${r.contentPreview || r.rawResponsePreview || '(empty)'}`,
          '',
        ].join('\n')
      }).join('\n')

  return [
    '# AI Coach Temporary Stress Report',
    '',
    '## Run Config',
    `- API base: ${apiBase}`,
    `- Prompts file: ${promptsFile}`,
    `- Iterations: ${iterations}`,
    `- Concurrency: ${concurrency}`,
    `- Timeout per request: ${timeoutMs}ms`,
    `- Strict contract gating: ${strictContract ? 'enabled' : 'disabled'}`,
    `- Delay between requests: ${summary.config?.delayMs || 0}ms`,
    `- Category filter: ${summary.config?.categoryFilter ? summary.config.categoryFilter.join(', ') : 'all'}`,
    `- Output dir: ${outputDir}`,
    '',
    '## Summary',
    `- Total requests: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Warning cases: ${summary.warningCases}`,
    `- Pass rate: ${summary.passRatePct}%`,
    `- Average score: ${summary.avgScore}`,
    `- Latency p50/p90/p95/max: ${summary.latency.p50}ms / ${summary.latency.p90}ms / ${summary.latency.p95}ms / ${summary.latency.max}ms`,
    `- Duration: ${summary.durationMs}ms`,
    '',
    '## Widget Coverage',
    widgetLines,
    '',
    '## Function Coverage',
    functionLines,
    '',
    '## Findings',
    issueBlocks,
    '',
    failures.length > 0
      ? '## Recommendation\n- Address FAIL cases first (non-200 responses or malformed payloads), then rerun with `--iterations 2 --concurrency 4`.'
      : '## Recommendation\n- No hard failures. Increase `--iterations` and expand prompt corpus before release.',
    '',
  ].join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const repoRoot = process.cwd()
  const promptsFile = path.resolve(
    repoRoot,
    String(args.prompts || process.env.AI_COACH_PROMPTS_FILE || 'scripts/ai-coach/stress-prompts.temp.json'),
  )

  const apiBase = String(args['api-url'] || process.env.AI_COACH_API_URL || process.env.E2E_BACKEND_URL || process.env.NEXT_PUBLIC_AI_COACH_API_URL || 'http://127.0.0.1:3001').replace(/\/$/, '')

  const bypassUserId = process.env.E2E_BYPASS_USER_ID || DEFAULT_BYPASS_USER_ID
  const bypassSharedSecret = process.env.E2E_BYPASS_SHARED_SECRET

  const resolvedToken = String(
    args.token
      || process.env.AI_COACH_TOKEN
      || process.env.E2E_BYPASS_TOKEN
      || (bypassSharedSecret ? `e2e:${bypassSharedSecret}:${bypassUserId}` : `e2e:${bypassUserId}`),
  ).trim()

  if (!resolvedToken) {
    throw new Error('Missing token. Set AI_COACH_TOKEN or E2E_BYPASS_TOKEN.')
  }

  const iterations = toPositiveInt(args.iterations || process.env.AI_COACH_ITERATIONS, 1)
  const concurrency = toPositiveInt(args.concurrency || process.env.AI_COACH_CONCURRENCY, 3)
  const timeoutMs = toPositiveInt(args['timeout-ms'] || process.env.AI_COACH_TIMEOUT_MS, 60000)
  const sampleSize = toPositiveInt(args.sample || process.env.AI_COACH_SAMPLE_SIZE, 0)
  const delayMs = toPositiveInt(args['delay-ms'] || process.env.AI_COACH_DELAY_MS, 0)
  const strictContract = toBoolean(
    args['strict-contract'] || process.env.AI_COACH_STRICT_CONTRACT,
    true,
  )
  const categoryFilter = parseCategoryFilter(
    String(args.category || process.env.AI_COACH_CATEGORY_FILTER || ''),
  )

  const startedAt = Date.now()
  const cases = await loadCases(promptsFile)
  const filteredCases = categoryFilter
    ? cases.filter((caseDef) => categoryFilter.has(caseDef.category.toLowerCase()))
    : cases
  const selectedCases = sampleSize > 0 ? filteredCases.slice(0, sampleSize) : filteredCases

  if (selectedCases.length === 0) {
    throw new Error(
      categoryFilter
        ? `No prompt cases matched category filter from ${promptsFile}: ${Array.from(categoryFilter).join(',')}`
        : `No prompt cases loaded from ${promptsFile}`,
    )
  }

  const expandedCases = []
  for (let i = 1; i <= iterations; i += 1) {
    for (const caseDef of selectedCases) {
      expandedCases.push({ caseDef, iteration: i })
    }
  }

  const results = []
  let cursor = 0

  async function worker() {
    while (cursor < expandedCases.length) {
      const current = expandedCases[cursor]
      cursor += 1
      const result = await runOneCase({
        apiBase,
        token: resolvedToken,
        timeoutMs,
        caseDef: current.caseDef,
        iteration: current.iteration,
        strictContract,
      })
      results.push(result)

      const marker = result.passed ? 'PASS' : 'FAIL'
      const score = String(result.score).padStart(3, ' ')
      console.log(`[${marker}] score=${score} status=${result.status || 'ERR'} ${result.requestId} (${result.latencyMs}ms)`) // eslint-disable-line no-console

      if (delayMs > 0) {
        await sleep(delayMs)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, expandedCases.length) }, () => worker())
  await Promise.all(workers)

  results.sort((a, b) => a.requestId.localeCompare(b.requestId))

  const durationMs = Date.now() - startedAt
  const latencies = results.map((r) => r.latencyMs)

  const widgetCounts = {}
  const functionCounts = {}

  for (const result of results) {
    for (const widget of result.widgets) {
      widgetCounts[widget] = (widgetCounts[widget] || 0) + 1
    }
    for (const fn of result.calledFunctions) {
      functionCounts[fn] = (functionCounts[fn] || 0) + 1
    }
  }

  const passed = results.filter((r) => r.passed).length
  const failed = results.length - passed
  const warningCases = results.filter((r) => r.warnings.length > 0).length
  const avgScore = results.length > 0
    ? Math.round((results.reduce((sum, r) => sum + r.score, 0) / results.length) * 10) / 10
    : 0

  const summary = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs,
    total: results.length,
    passed,
    failed,
    warningCases,
    passRatePct: Math.round((passed / results.length) * 1000) / 10,
    avgScore,
    latency: {
      p50: percentile(latencies, 50),
      p90: percentile(latencies, 90),
      p95: percentile(latencies, 95),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
    widgetCounts,
    functionCounts,
    config: {
      categoryFilter: categoryFilter ? Array.from(categoryFilter) : null,
      delayMs,
      strictContract,
    },
  }

  const outputDir = path.resolve(
    repoRoot,
    String(args['output-dir'] || `.codex-scratch/ai-coach-stress/${timestampSlug(new Date(startedAt))}`),
  )

  await mkdir(outputDir, { recursive: true })

  const summaryPath = path.join(outputDir, 'summary.json')
  const resultsPath = path.join(outputDir, 'results.jsonl')
  const reportPath = path.join(outputDir, 'report.md')

  await writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  await writeFile(resultsPath, `${results.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8')

  const reportMd = toMarkdownReport({
    summary,
    results,
    outputDir,
    promptsFile,
    apiBase,
    iterations,
    concurrency,
    timeoutMs,
    strictContract,
  })

  await writeFile(reportPath, reportMd, 'utf8')

  console.log('\nStress run complete.') // eslint-disable-line no-console
  console.log(`Summary: ${summaryPath}`) // eslint-disable-line no-console
  console.log(`Results: ${resultsPath}`) // eslint-disable-line no-console
  console.log(`Report:  ${reportPath}`) // eslint-disable-line no-console
}

main().catch((error) => {
  console.error(`Stress run failed: ${error instanceof Error ? error.message : String(error)}`) // eslint-disable-line no-console
  process.exitCode = 1
})
