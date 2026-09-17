import { expect, test } from '@nuxt/test-utils/playwright'

test('renders the home page', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('MineCraftXPlayWebApp')
})
