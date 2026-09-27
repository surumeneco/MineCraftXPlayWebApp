import { expect, test } from '@nuxt/test-utils/playwright'

test('tourist spot editor shows the saved name in breadcrumbs and refreshes it after renaming', async ({ page, goto }) => {
  const id = '91b613f9-f82c-4c76-aaec-ff0200000031'
  const territoryId = '91b613f9-f82c-4c76-aaec-ff0200000032'
  let savedName = '観光スポット旧名称'
  let version = 1
  const headers = (route: import('@playwright/test').Route) => ({
    'access-control-allow-origin': new URL(route.request().headers()['origin'] ?? 'http://localhost:3000').origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type,X-XPlay-CSRF',
    'access-control-allow-methods': 'GET,PATCH,OPTIONS',
  })
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: headers(route),
    body: JSON.stringify({ authenticated: true, is_admin: true, account_id: id, csrf_token: 'testing' }),
  }))
  await page.route('**/api/territories?status=approved', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: headers(route),
    body: JSON.stringify([{ id: territoryId, name: '承認済み領地', status: 'approved' }]),
  }))
  await page.route('**/api/admin/spots/tags', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: headers(route), body: '[]',
  }))
  await page.route('**/api/admin/spots/tourist/**', route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: headers(route) })
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON()
      savedName = body.name
      version++
    }
    return route.fulfill({
      status: 200, contentType: 'application/json', headers: headers(route),
      body: JSON.stringify({
        id, kind: 'tourist', name: savedName, body_delta: { ops: [{ insert: '観光案内\n' }] },
        main_image_id: null, dimension: null, pos_x: null, pos_z: null,
        territory_id: territoryId, territory_name: '承認済み領地', tags: [],
        status: 'draft', version,
      }),
    })
  })
  await goto('/admin/spots/tourist/' + id + '/edit', { waitUntil: 'hydration' })
  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  await expect(page.getByLabel('名前', { exact: true })).toHaveValue('観光スポット旧名称')
  await expect(breadcrumb.locator('a[href="/admin/spots/tourist"]')).toHaveText('観光スポット管理')
  await expect(breadcrumb.locator('li').last()).toHaveText('観光スポット旧名称（編集）')
  await page.getByLabel('名前', { exact: true }).fill('観光スポット新名称')
  await expect(breadcrumb.locator('li').last()).toHaveText('観光スポット旧名称（編集）')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(breadcrumb.locator('li').last()).toHaveText('観光スポット新名称（編集）')
})
