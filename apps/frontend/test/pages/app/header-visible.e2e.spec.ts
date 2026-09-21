import { expect, test } from '@nuxt/test-utils/playwright'

test('both mobile drawers leave the entire header above the shade and panel', async ({ page, goto }) => {
  await page.setViewportSize({ width: 375, height: 720 })
  await goto('/', { waitUntil: 'hydration' })

  const header = page.locator('header')
  const drawer = page.locator('#mobile-menu-drawer')
  const logo = header.locator('a.xplay-site-logo')
  const side = header.getByRole('button', { name: 'サイドメニュー', exact: true })
  const navigation = header.getByRole('button', { name: 'ナビゲーションメニュー', exact: true })

  for (const opener of [side, navigation]) {
    await opener.click()
    await expect(drawer).toHaveAttribute('open', '')
    await expect(logo).toBeVisible()
    await expect(side).toBeVisible()
    await expect(navigation).toBeVisible()

    const headerBounds = await header.boundingBox()
    const shadeBounds = await drawer.locator('.xplay-mobile-drawer__scrim').boundingBox()
    const panelBounds = await drawer.locator('.xplay-mobile-drawer__panel').boundingBox()
    expect(headerBounds).not.toBeNull()
    expect(shadeBounds).not.toBeNull()
    expect(panelBounds).not.toBeNull()
    const headerBottom = headerBounds!.y + headerBounds!.height
    expect(shadeBounds!.y).toBeGreaterThanOrEqual(headerBottom - 1)
    expect(panelBounds!.y).toBeGreaterThanOrEqual(headerBottom - 1)

    await drawer.locator('.xplay-mobile-drawer__close').click()
    await expect(drawer).not.toHaveAttribute('open', '')
  }
})
