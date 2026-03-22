#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const WORKSPACE_ROOT = process.cwd()
const FRONTEND_PORT = '3000'
const BACKEND_PORT = '3001'
const READY_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 1_000

function runPreflightCleanup() {
  const result = spawnSync(process.execPath, ['scripts/e2e/ensure-clean-playwright-ports.mjs'], {
    cwd: WORKSPACE_ROOT,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHttpReady(url, label) {
  const deadline = Date.now() + READY_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) {
        return
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`${label} did not become ready at ${url} within ${READY_TIMEOUT_MS}ms`)
}

function spawnManagedProcess(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    detached: true,
    stdio: 'inherit',
  })

  child.on('error', (error) => {
    console.error(`[journal-e2e] Failed to start ${options?.name ?? command}:`, error)
  })

  return child
}

function stopManagedProcess(child, label) {
  if (!child || child.killed) return

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    return
  }

  setTimeout(() => {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      // Already exited.
    }
  }, 5_000).unref()

  console.log(`[journal-e2e] Stopped ${label}`)
}

function getJournalSpecFiles() {
  const membersSpecDir = path.join(WORKSPACE_ROOT, 'e2e/specs/members')
  return readdirSync(membersSpecDir)
    .filter((name) => /^journal.*\.spec\.ts$/.test(name))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => `e2e/specs/members/${name}`)
}

async function main() {
  runPreflightCleanup()

  const backendProcess = spawnManagedProcess('pnpm', ['--dir', 'backend', 'run', 'dev'], {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PORT: BACKEND_PORT,
      E2E_BYPASS_AUTH: 'true',
      E2E_BYPASS_SHARED_SECRET: process.env.E2E_BYPASS_SHARED_SECRET || '',
      E2E_DETERMINISTIC_MODE: 'true',
    },
    name: 'backend',
  })

  const frontendProcess = spawnManagedProcess(
    'pnpm',
    ['exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', FRONTEND_PORT],
    {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        E2E_BYPASS_AUTH: 'true',
        NEXT_PUBLIC_E2E_BYPASS_AUTH: 'true',
        NEXT_PUBLIC_E2E_BYPASS_SHARED_SECRET: process.env.E2E_BYPASS_SHARED_SECRET || '',
        NEXT_PUBLIC_AI_COACH_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
        NEXT_PUBLIC_SPX_E2E_ALLOW_STALE_ENTRY: 'true',
      },
      name: 'frontend',
    },
  )

  const cleanup = () => {
    stopManagedProcess(frontendProcess, 'frontend')
    stopManagedProcess(backendProcess, 'backend')
  }

  process.on('SIGINT', () => {
    cleanup()
    process.exit(130)
  })

  process.on('SIGTERM', () => {
    cleanup()
    process.exit(143)
  })

  try {
    await waitForHttpReady(`http://127.0.0.1:${BACKEND_PORT}/`, 'backend server')
    await waitForHttpReady(`http://127.0.0.1:${FRONTEND_PORT}/`, 'frontend server')
  } catch (error) {
    cleanup()
    throw error
  }

  const testArgs = [
    'exec',
    'playwright',
    'test',
    ...getJournalSpecFiles(),
    'e2e/specs/admin/trade-review.spec.ts',
    '--project=chromium',
    '--workers=1',
  ]

  const testResult = spawnSync('pnpm', testArgs, {
    cwd: WORKSPACE_ROOT,
    env: {
      ...process.env,
      PLAYWRIGHT_REUSE_SERVER: 'true',
      E2E_DETERMINISTIC_MODE: 'true',
    },
    stdio: 'inherit',
  })

  cleanup()
  process.exit(testResult.status ?? 1)
}

main().catch((error) => {
  console.error('[journal-e2e] Failed to execute journal e2e run.', error)
  process.exit(1)
})
