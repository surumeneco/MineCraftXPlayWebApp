import { expect, test } from '@nuxt/test-utils/playwright'

test('renders the home page and navigates to a published information page', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })

  await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  await page.getByRole('button', { name: '情報' }).click()
  await page.getByRole('link', { name: 'お知らせ' }).click()

  await expect(page).toHaveURL(/\/info\/notice$/)
  await expect(page.getByRole('heading', { name: 'お知らせ' })).toBeVisible()
})

test('mobile hamburgers open modal overlays without pushing content down', async ({ page, goto }) => {
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
  const accordion = drawer.getByRole('button', { name: '情報' })
  await expect(accordion).toHaveAttribute('aria-expanded', 'true')
  await expect(drawer.getByRole('link', { name: 'お知らせ' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).not.toHaveAttribute('open', '')
  await expect(navigation).toBeFocused()

  await navigation.click()
  await drawer.locator('.xplay-mobile-drawer__scrim').click({ position: { x: 2, y: 2 }, force: true })
  await expect(drawer).not.toHaveAttribute('open', '')
  await navigation.click()
  await drawer.getByRole('link', { name: 'お知らせ' }).click()
  await expect(page).toHaveURL(/\/info\/notice$/)
})
