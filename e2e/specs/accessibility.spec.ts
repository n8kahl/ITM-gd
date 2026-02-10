import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { authenticateAsMember } from '../helpers/member-auth'

function formatViolations(violations: Array<{ id: string; help: string }>): string {
  return violations
    .map((violation) => `${violation.id}: ${violation.help}`)
    .join('\n')
}

async function expectNoWcagViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  const levelAViolations = results.violations.filter((violation) => (
    violation.tags.includes('wcag2a') || violation.tags.includes('wcag21a')
  ))

  const levelAAViolations = results.violations.filter((violation) => (
    violation.tags.includes('wcag2aa') || violation.tags.includes('wcag21aa')
  ))

  expect(
    levelAViolations,
    `WCAG 2.1 Level A violations found:\n${formatViolations(levelAViolations)}`,
  ).toEqual([])

  expect(
    levelAAViolations,
    `WCAG 2.1 Level AA violations found:\n${formatViolations(levelAAViolations)}`,
  ).toEqual([])
}

test.describe('Accessibility', () => {
  test('landing page has no WCAG 2.1 A/AA violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expectNoWcagViolations(page)
  })

  test('login page has no WCAG 2.1 A/AA violations', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    await expectNoWcagViolations(page)
  })

  test('members dashboard has no WCAG 2.1 A/AA violations', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members')
    await page.waitForLoadState('domcontentloaded')
    await expectNoWcagViolations(page)
  })

  test('journal page has no WCAG 2.1 A/AA violations', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/journal')
    await page.waitForLoadState('domcontentloaded')
    await expectNoWcagViolations(page)
  })

  test('AI coach page has no WCAG 2.1 A/AA violations', async ({ page }) => {
    await authenticateAsMember(page)
    await page.goto('/members/ai-coach')
    await page.waitForLoadState('domcontentloaded')
    await expectNoWcagViolations(page)
  })
})
