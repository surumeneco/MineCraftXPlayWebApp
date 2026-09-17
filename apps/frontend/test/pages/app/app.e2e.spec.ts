import { expect, test } from '@nuxt/test-utils/playwright'

test('renders the home page and navigates to a published information page', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })

  await expect(page.getByRole('heading', { name: 'ホーム' })).toBeVisible()
  await page.getByRole('button', { name: '情報' }).click()
  await page.getByRole('link', { name: 'お知らせ' }).click()

  await expect(page).toHaveURL(/\/info\/notice$/)
  await expect(page.getByRole('heading', { name: 'お知らせ' })).toBeVisible()
})
