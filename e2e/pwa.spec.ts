import { expect, test, type Page } from '@playwright/test'
import {
  MOBILE_STUDIO_URL,
  prepareMobileMemberShell,
  seedInstallPromptState,
} from './mobile-test-helpers'

const ROOT_URL = '/?e2eBypassAuth=1'

async function safeGoto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('ERR_ABORTED')) {
      throw error
    }
    await page.goto(url, { waitUntil: 'domcontentloaded' })
  }
}

async function waitForServiceWorkerRegistration(page: Page): Promise<void> {
  const context = page.context()
  await expect.poll(
    () => {
      try {
        return context.serviceWorkers().some((worker) => worker.url().includes('/sw.js'))
      } catch {
        return false
      }
    },
    { timeout: 20_000 },
  ).toBe(true)
}

async function ensureServiceWorkerController(page: Page): Promise<void> {
  await waitForServiceWorkerRegistration(page)

  const hasController = await page.evaluate(() => Boolean(navigator.serviceWorker?.controller)).catch(() => false)
  if (!hasController) {
    await page.reload({ waitUntil: 'domcontentloaded' })
  }

  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)),
    { timeout: 20_000 },
  ).toBe(true)
}

async function clearQueuedJournalMutations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('tradeitm-offline-journal')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })
}

async function readQueuedJournalMutationCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const openRequest = indexedDB.open('tradeitm-offline-journal', 1)

      openRequest.onupgradeneeded = () => {
        const db = openRequest.result
        if (!db.objectStoreNames.contains('mutations')) {
          db.createObjectStore('mutations', { keyPath: 'id' })
        }
      }

      openRequest.onerror = () => reject(openRequest.error)
      openRequest.onsuccess = () => {
        const db = openRequest.result
        if (!db.objectStoreNames.contains('mutations')) {
          db.close()
          resolve(0)
          return
        }

        const tx = db.transaction('mutations', 'readonly')
        const store = tx.objectStore('mutations')
        const countRequest = store.count()
        countRequest.onerror = () => reject(countRequest.error)
        countRequest.onsuccess = () => {
          const count = Number(countRequest.result ?? 0)
          db.close()
          resolve(count)
        }
      }
    })
  })
}

test.describe('PWA regression suite', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
  })

  test('manifest link is present in document head', async ({ page }) => {
    await safeGoto(page, ROOT_URL)
    await expect(page.locator('head link[rel="manifest"][href="/manifest.json"]')).toHaveCount(1)
  })

  test('service worker registers successfully', async ({ page }) => {
    await safeGoto(page, ROOT_URL)
    await waitForServiceWorkerRegistration(page)
  })

  test('offline journal mutation enqueues in IndexedDB queue', async ({ context, page }) => {
    await safeGoto(page, ROOT_URL)
    await ensureServiceWorkerController(page)
    await clearQueuedJournalMutations(page)

    await context.setOffline(true)

    try {
      const result = await page.evaluate(async () => {
        const response = await fetch('/api/members/journal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol: 'SPY',
            trade_date: '2026-03-01',
            entry_price: 500,
            exit_price: 502,
          }),
        })

        const payload = await response.json().catch(() => null)
        return {
          status: response.status,
          queued: Boolean(payload?.meta?.queued),
          offline: Boolean(payload?.meta?.offline),
        }
      })

      expect(result.status).toBe(202)
      expect(result.queued).toBe(true)
      expect(result.offline).toBe(true)
    } finally {
      await context.setOffline(false)
    }

    await expect.poll(
      () => readQueuedJournalMutationCount(page),
      { timeout: 20_000 },
    ).toBeGreaterThan(0)
  })

  test('install prompt hook reacts to beforeinstallprompt event', async ({ page }) => {
    await seedInstallPromptState(page, 2)
    await prepareMobileMemberShell(page)

    await safeGoto(page, MOBILE_STUDIO_URL)

    await expect.poll(
      () => page.evaluate(() => {
        const installEvent = new Event('beforeinstallprompt')
        Object.defineProperty(installEvent, 'prompt', {
          value: () => Promise.resolve(),
        })
        Object.defineProperty(installEvent, 'userChoice', {
          value: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
        })
        window.dispatchEvent(installEvent)
        return document.body.textContent?.includes('Install TradeITM') ?? false
      }),
      { timeout: 15_000 },
    ).toBe(true)

    await expect(page.getByText('Install TradeITM')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Install', exact: true })).toBeVisible()
  })
})
