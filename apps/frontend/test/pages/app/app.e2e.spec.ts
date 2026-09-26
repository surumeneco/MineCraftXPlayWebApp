import { expect, test } from '@nuxt/test-utils/playwright'

test('navigates from the centered hover menu and returns home through the logo', async ({ page, goto }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await goto('/', { waitUntil: 'hydration' })

  await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  const logo = page.locator('header a.xplay-site-logo')
  await expect(logo).toHaveText('もふもふ広場')
  await expect(logo).toHaveAttribute('href', '/')
  const nav = page.locator('#header-navigation')
  await expect(nav).toBeVisible()
  const headerBounds = await page.locator('header').boundingBox()
  const initialNavBounds = await nav.boundingBox()
  expect(headerBounds).not.toBeNull()
  expect(initialNavBounds).not.toBeNull()
  const headerCenterX = headerBounds!.x + headerBounds!.width / 2
  const headerCenterY = headerBounds!.y + headerBounds!.height / 2
  expect(Math.abs(initialNavBounds!.x + initialNavBounds!.width / 2 - headerCenterX)).toBeLessThanOrEqual(1)
  expect(Math.abs(initialNavBounds!.y + initialNavBounds!.height / 2 - headerCenterY)).toBeLessThanOrEqual(1)
  await expect(page.locator('#header-navigation a[href="/"]')).toHaveCount(0)
  await page.getByRole('button', { name: '情報' }).hover()
  const expandedNavBounds = await nav.boundingBox()
  const dropdownBounds = await nav.locator('.dropdown-menu').first().boundingBox()
  expect(expandedNavBounds).not.toBeNull()
  expect(dropdownBounds).not.toBeNull()
  expect(Math.abs(expandedNavBounds!.y - initialNavBounds!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(expandedNavBounds!.height - initialNavBounds!.height)).toBeLessThanOrEqual(1)
  expect(Math.abs(expandedNavBounds!.x + expandedNavBounds!.width / 2 - headerCenterX)).toBeLessThanOrEqual(1)
  expect(dropdownBounds!.y).toBeGreaterThanOrEqual(initialNavBounds!.y + initialNavBounds!.height - 1)
  await expect(page.getByRole('link', { name: 'お知らせ', exact: true }).first()).toBeVisible()
  await page.locator('#header-navigation a[href="/info/notice"]').click()
  await expect(page).toHaveURL(/\/info\/notice$/)
  await logo.click()
  await expect(page).toHaveURL(/\/$/)
})

test('centers the administrator menu at the viewport midpoint', async ({ page, goto }) => {
  await page.route('**/api/auth/session', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': new URL(route.request().headers()['origin'] ?? 'http://localhost:3000').origin,
        'access-control-allow-credentials': 'true',
      },
      body: JSON.stringify({ authenticated: true, is_admin: true, account_id: 'ci-admin' }),
    })
  })
  await page.setViewportSize({ width: 2200, height: 900 })
  await goto('/', { waitUntil: 'hydration' })

  const nav = page.locator('#header-navigation')
  const adminGroup = nav.getByRole('button', { name: '申請管理' })
  await expect(adminGroup).toBeVisible()
  const header = page.locator('header')
  const midpoint = (await header.boundingBox())!.x + (await header.boundingBox())!.width / 2
  const before = (await nav.boundingBox())!
  expect(Math.abs(before.x + before.width / 2 - midpoint)).toBeLessThanOrEqual(1)
  await adminGroup.hover()
  await expect(nav.getByRole('link', { name: '領地承認' })).toBeVisible()
  const after = (await nav.boundingBox())!
  expect(Math.abs(after.x + after.width / 2 - midpoint)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1)
})

test('uses branded document titles and declares the favicon', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await expect(page).toHaveTitle('もふもふ広場 - ホーム')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.ico')

  await page.goto('/info/about')
  await expect(page).toHaveTitle('もふもふ広場 - コミュニティ概要')
})

test('mobile hamburgers open modal overlays with legible white links without pushing content down', async ({ page, goto }) => {
  await page.setViewportSize({ width: 375, height: 720 })
  await goto('/', { waitUntil: 'hydration' })
  const main = page.locator('main')
  const initialTop = (await main.boundingBox())?.y
  const side = page.getByRole('button', { name: 'サイドメニュー' })
  const navigation = page.getByRole('button', { name: 'ナビゲーションメニュー' })
  const drawer = page.locator('#mobile-menu-drawer')

  await side.click()
  await expect(drawer).toHaveAttribute('open', '')
  await expect(drawer).toHaveCSS('position', 'fixed')
  await expect(drawer.locator('#mobile-side-menu')).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await expect.poll(async () => (await main.boundingBox())?.y).toBe(initialTop)
  await drawer.getByRole('button', { name: /閉じる/ }).click()
  await expect(drawer).not.toHaveAttribute('open', '')
  await expect(side).toBeFocused()

  await navigation.click()
  await expect(drawer.locator('#mobile-navigation')).toBeVisible()
  await expect(drawer.locator('#mobile-navigation a[href="/"]')).toHaveCount(0)
  const accordion = drawer.getByRole('button', { name: '情報' })
  await expect(accordion).toHaveAttribute('aria-expanded', 'true')
  const noticeLink = drawer.locator('#mobile-navigation a[href="/info/notice"]')
  await expect(noticeLink).toBeVisible()
  await expect(noticeLink).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.keyboard.press('Escape')
  await expect(drawer).not.toHaveAttribute('open', '')
  await expect(navigation).toBeFocused()

  await navigation.click()
  await drawer.locator('.xplay-mobile-drawer__scrim').click({ position: { x: 2, y: 2 }, force: true })
  await expect(drawer).not.toHaveAttribute('open', '')
  await navigation.click()
  await noticeLink.click()
  await expect(page).toHaveURL(/\/info\/notice$/)
})
