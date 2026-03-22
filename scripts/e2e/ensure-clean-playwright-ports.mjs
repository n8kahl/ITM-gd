#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const WORKSPACE_ROOT = process.cwd()
const DEFAULT_PORTS = [3000, 3001]
const SOFT_KILL_TIMEOUT_MS = 5_000
const POLL_INTERVAL_MS = 100

function parsePortFromUrl(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    if (parsed.port) return Number(parsed.port)
    return parsed.protocol === 'https:' ? 443 : 80
  } catch {
    return null
  }
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' })
}

function listPidsForPort(port) {
  const result = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
  if (result.status !== 0 || !result.stdout.trim()) return []
  return result.stdout
    .split('\n')
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0)
}

function getProcessCommand(pid) {
  const result = run('ps', ['-o', 'command=', '-p', String(pid)])
  return result.status === 0 ? result.stdout.trim() : ''
}

function getProcessCwd(pid) {
  const result = run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
  if (result.status !== 0) return null

  const cwdLine = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('n'))

  if (!cwdLine) return null
  return cwdLine.slice(1)
}

function isWorkspaceOwnedProcess(pid) {
  const cwd = getProcessCwd(pid)
  if (!cwd) return false
  return cwd === WORKSPACE_ROOT || cwd.startsWith(`${WORKSPACE_ROOT}/`)
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function terminatePid(pid) {
  if (!isAlive(pid)) return

  process.kill(pid, 'SIGTERM')
  const deadline = Date.now() + SOFT_KILL_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (!isAlive(pid)) return
    await sleep(POLL_INTERVAL_MS)
  }

  if (isAlive(pid)) {
    process.kill(pid, 'SIGKILL')
  }
}

async function main() {
  const ports = new Set(DEFAULT_PORTS)
  const frontendPort = parsePortFromUrl(process.env.PLAYWRIGHT_BASE_URL)
  const backendPort = parsePortFromUrl(process.env.E2E_BACKEND_URL)

  if (frontendPort != null) ports.add(frontendPort)
  if (backendPort != null) ports.add(backendPort)

  const pidToPorts = new Map()

  for (const port of ports) {
    const pids = listPidsForPort(port)
    for (const pid of pids) {
      const bucket = pidToPorts.get(pid) ?? []
      bucket.push(port)
      pidToPorts.set(pid, bucket)
    }
  }

  if (pidToPorts.size === 0) {
    console.log('[e2e-preflight] No stale listeners found on Playwright ports.')
    return
  }

  const foreignProcesses = []
  for (const [pid, boundPorts] of pidToPorts.entries()) {
    if (!isWorkspaceOwnedProcess(pid)) {
      foreignProcesses.push({
        pid,
        boundPorts,
        command: getProcessCommand(pid),
        cwd: getProcessCwd(pid),
      })
    }
  }

  if (foreignProcesses.length > 0) {
    console.error('[e2e-preflight] Refusing to kill non-workspace listeners on required ports.')
    for (const foreign of foreignProcesses) {
      console.error(`- pid=${foreign.pid} ports=${foreign.boundPorts.join(',')} cwd=${foreign.cwd ?? 'unknown'} cmd=${foreign.command || 'unknown'}`)
    }
    process.exit(1)
  }

  for (const [pid, boundPorts] of pidToPorts.entries()) {
    await terminatePid(pid)
    console.log(`[e2e-preflight] Terminated stale listener pid=${pid} ports=${boundPorts.join(',')}`)
  }
}

main().catch((error) => {
  console.error('[e2e-preflight] Failed to clean Playwright ports.', error)
  process.exit(1)
})
