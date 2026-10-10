import { expect, test } from '@nuxt/test-utils/playwright'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

// Axe detects a subset of WCAG criteria. Keyboard, zoom, screen readers and content
// loaded only after authentication require additional functional/manual verification.
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

const publicRoutes = [
  '/', '/info', '/info/about', '/info/notice', '/info/operators',
  '/info/rules', '/info/server', '/info/public-spots', '/info/tourist-spots',
  '/lists', '/applications', '/territories', '/companies', '/request', '/login',
] as const

function describeViolations(violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
  return violations.map(violation => {
    const nodes = violation.nodes.slice(0, 6)
      .map(node => `  - ${node.target.join(' ')}: ${node.failureSummary ?? 'no details'}`)
      .join('\n')
    return `${violation.id} [${violation.impact ?? 'unknown'}]: ${violation.help} (${violation.helpUrl})\n${nodes}`
  }).join('\n\n')
}

async function reportViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  return result.violations.length ? describeViolations(result.violations) : ''
}

async function check(page: Page, label: string, findings: string[]) {
  const report = await reportViolations(page)
  if (report) findings.push(`${label}:\n${report}`)
}

function assertNoViolations(findings: string[]) {
  expect(findings, findings.join('\n\n') || 'No detectable violations').toEqual([])
}

test.describe('WebApp WCAG 2.2 A/AA audit @a11y', () => {
  test('all public routes on desktop', async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const findings: string[] = []
    for (const route of publicRoutes) {
      await goto(route, { waitUntil: 'hydration' })
      await expect(page.locator('main')).toBeVisible()
      await check(page, route, findings)
    }
    assertNoViolations(findings)
  })

  test('narrow routes and expanded mobile navigation', async ({ page, goto }) => {
    await page.setViewportSize({ width: 375, height: 780 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const findings: string[] = []
    for (const route of ['/', '/request', '/info/notice']) {
      await goto(route, { waitUntil: 'hydration' })
      await check(page, `mobile ${route}`, findings)
    }
    await goto('/', { waitUntil: 'hydration' })
    await page.getByRole('button', { name: 'ナビゲーションメニュー' }).click()
    await expect(page.locator('#mobile-menu-drawer')).toHaveAttribute('open', '')
    await check(page, 'expanded mobile navigation', findings)
    assertNoViolations(findings)
  })

  test('expanded desktop navigation', async ({ page, goto }) => {
    await page.setViewportSize({ width: 2200, height: 900 })
    await goto('/', { waitUntil: 'hydration' })
    const trigger = page.locator('#header-navigation').getByRole('button', { name: '情報' })
    await expect(trigger).toBeVisible()
    await trigger.focus()
    await trigger.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const report = await reportViolations(page)
    expect(report, report).toBe('')
  })

  test('light theme on request form', async ({ page, goto }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await goto('/request', { waitUntil: 'hydration' })
    await page.locator('html').evaluate(html => html.setAttribute('data-bs-theme', 'light'))
    const report = await reportViolations(page)
    expect(report, report).toBe('')
  })

  test('administrator navigation with authenticated mock', async ({ page, goto }) => {
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
    const report = await reportViolations(page)
    expect(report, report).toBe('')
  })
})
