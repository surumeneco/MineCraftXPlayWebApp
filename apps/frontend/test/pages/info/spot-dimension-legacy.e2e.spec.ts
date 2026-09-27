import { expect, test } from '@nuxt/test-utils/playwright'

test('spot guide editor preserves an unknown legacy dimension until it is explicitly replaced', async ({ page, goto }) => {
  const id = '91b613f9-f82c-4c76-aaec-ff0200000022'
  let submitted: Record<string, unknown> | null = null
  const responseHeaders = (origin: string) => ({
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type,X-XPlay-CSRF',
    'access-control-allow-methods': 'GET,PATCH,OPTIONS',
  })
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: responseHeaders(new URL(route.request().headers()['origin'] ?? 'http://localhost:3000').origin),
    body: JSON.stringify({ authenticated: true, is_admin: true, account_id: id, csrf_token: 'testing' }),
  }))
  await page.route('**/api/admin/spots/public/**', route => {
    const request = route.request()
    const headers = responseHeaders(new URL(request.headers()['origin'] ?? 'http://localhost:3000').origin)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.method() === 'PATCH') submitted = request.postDataJSON()
    const spot = {
      id, kind: 'public', name: submitted?.name ?? '旧ワールドの案内',
      dimension: submitted?.dimension ?? 'world',
      body_delta: { ops: [{ insert: '案内文\\n' }] },
      main_image_id: null, pos_x: 30, pos_z: -20,
      territory_id: null, territory_name: null, tags: [],
      status: 'draft', version: submitted ? 2 : 1,
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify(spot) })
  })

  await goto('/admin/spots/public/' + id + '/edit', { waitUntil: 'hydration' })
  const dimension = page.getByLabel('ディメンション')
  await expect(dimension).toBeVisible()
  await expect(dimension).toHaveValue('world')
  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  await expect(breadcrumb.locator('li').last()).toHaveText('旧ワールドの案内（編集）')
  await expect(dimension.locator('option[value="world"]')).toContainText('旧値：world')
  await expect(dimension.locator('option[value="world"]')).toBeDisabled()
  await dimension.selectOption('minecraft:the_nether')
  await page.getByLabel('名前', { exact: true }).fill('編集後の案内')
  await expect(breadcrumb.locator('li').last()).toHaveText('旧ワールドの案内（編集）')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => submitted).not.toBeNull()
  expect(submitted).toMatchObject({ name: '編集後の案内', dimension: 'minecraft:the_nether', x: 30, z: -20 })
  await expect(breadcrumb.locator('li').last()).toHaveText('編集後の案内（編集）')
  await expect(dimension).toHaveValue('minecraft:the_nether')
})
