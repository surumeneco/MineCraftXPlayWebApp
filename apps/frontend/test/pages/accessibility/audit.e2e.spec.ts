import { expect, test } from '@nuxt/test-utils/playwright'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/**
 * Automated baseline: WCAG 2.2 A/AA detectable rules in Chromium.
 * Manual keyboard, screen-reader, zoom/reflow and comprehension checks are separate.
 */
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

const publicRoutes = [
  '/',
  '/info',
  '/info/about',
  '/info/notice',
  '/info/operators',
  '/info/rules',
  '/info/server',
  '/lists',
  '/applications',
  '/territories',
  '/companies',
  '/request',
  '/login',
] as const

function describeViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations.map(violation => {
    const nodes = violation.nodes
      .slice(0, 8)
      .map(node => `  - ${node.target.join(' ')}: ${node.failureSummary ?? 'no details'}`)
      .join('\n')
    return `${violation.id} [${violation.impact ?? 'unknown'}]: ${violation.help} (${violation.helpUrl})\n${nodes}`
  }).join('\n\n')
}

async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  expect(result.violations.length, describeViolations(result.violations)).toBe(0)
}

test.describe('public page accessibility @a11y', () => {
  for (const route of publicRoutes) {
    test(`${route} has no detectable WCAG 2.2 A/AA violations`, async ({ page, goto }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await goto(route, { waitUntil: 'hydration' })
      await expect(page.locator('main')).toBeVisible()
      await audit(page)
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    })
  }

  for (const route of ['/', '/request', '/info/notice'] as const) {
    test(`${route} works at a narrow viewport`, async ({ page, goto }) => {
      await page.setViewportSize({ width: 375, height: 780 })
      await goto(route, { waitUntil: 'hydration' })
      await audit(page)
    })
  }

  test('opened mobile navigation is accessible', async ({ page, goto }) => {
    await page.setViewportSize({ width: 375, height: 780 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await goto('/', { waitUntil: 'hydration' })
    await page.getByRole('button', { name: 'ナビゲーションメニュー' }).click()
    await expect(page.locator('#mobile-menu-drawer')).toHaveAttribute('open', '')
    await audit(page)
  })

  test('visible desktop navigation dropdown is accessible', async ({ page, goto }) => {
    await page.setViewportSize({ width: 2200, height: 900 })
    await goto('/', { waitUntil: 'hydration' })
    const trigger = page.locator('#header-navigation').getByRole('button', { name: '情報' })
    await expect(trigger).toBeVisible()
    await trigger.focus()
    await trigger.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await audit(page)
  })

  test('light theme has accessible contrast', async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goto('/request', { waitUntil: 'hydration' })
    await page.locator('html').evaluate(html => html.setAttribute('data-bs-theme', 'light'))
    await audit(page)
  })
})

test.describe('administrator accessibility @a11y', () => {
  test('administrator homepage navigation is accessible', async ({ page, goto }) => {
    await page.route('**/api/auth/session', async route => {
      const origin = route.request().headers()['origin'] ?? 'http://localhost:3000'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': new URL(origin).origin,
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify({ authenticated: true, is_admin: true, account_id: 'ci-admin' }),
      })
    })
    await page.setViewportSize({ width: 2200, height: 900 })
    await goto('/', { waitUntil: 'hydration' })
    await expect(page.locator('#header-navigation').getByRole('button', { name: '申請管理' })).toBeVisible()
    await audit(page)
  })
})
