import { expect, test } from '@nuxt/test-utils/playwright'

test('spot guide editor sends the X/Z form after numeric input', async ({ page, goto }) => {
  let submitted: Record<string, unknown> | null = null
  const id = '91b613f9-f82c-4c76-aaec-ff0200000021'
  const headers = (origin: string) => ({
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type,X-XPlay-CSRF',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  await page.route('**/api/auth/session', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: headers(new URL(route.request().headers()['origin'] ?? 'http://localhost:3000').origin),
    body: JSON.stringify({ authenticated: true, is_admin: true, csrf_token: 'testing', account_id: id }),
  }))
  await page.route('**/api/admin/spots/public**', route => {
    const request = route.request()
    const responseHeaders = headers(new URL(request.headers()['origin'] ?? 'http://localhost:3000').origin)
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders })
    if (request.method() === 'POST') submitted = request.postDataJSON()
    const spot = {
      id, kind: 'public', name: '案内テスト', body_delta: { ops: [{ insert: '説明文\\n' }] },
      main_image_id: null, dimension: 'minecraft:overworld', pos_x: 30, pos_y: null,
      pos_z: -20, territory_id: null, territory_name: null, tags: [], sort_order: 0,
      status: 'draft', version: 1, published_at: null,
    }
    return route.fulfill({
      status: request.method() === 'POST' ? 201 : 200,
      contentType: 'application/json', headers: responseHeaders, body: JSON.stringify(spot),
    })
  })
  await goto('/admin/spots/public/new', { waitUntil: 'hydration' })
  await expect(page.locator('#spot-name')).toBeVisible({ timeout: 15000 }).catch(async () => {
    throw new Error('Spot editor unavailable: ' + await page.locator('main').innerText())
  })
  await page.getByLabel('名前', { exact: true }).fill('案内テスト')
  const dimension = page.getByLabel('ディメンション')
  await expect(dimension.locator('option')).toHaveText([
    'ディメンションを選択', 'オーバーワールド', 'ネザー', 'エンド',
  ])
  await expect(dimension.locator('option[value="minecraft:overworld"]')).toHaveText('オーバーワールド')
  await expect(dimension.locator('option[value="minecraft:the_nether"]')).toHaveText('ネザー')
  await expect(dimension.locator('option[value="minecraft:the_end"]')).toHaveText('エンド')
  await dimension.selectOption('minecraft:overworld')
  await page.getByLabel('X座標').fill('30')
  await page.getByLabel('Z座標').fill('-20')
  const body = page.locator('.xplay-quill-editor.ql-container.ql-snow .ql-editor')
  const toolbar = page.locator('main .ql-toolbar.ql-snow')
  await expect(body).toBeVisible()
  await body.fill(Array.from({ length: 100 }, (_, i) => '長い説明文 ' + i).join('\\n'))
  await expect.poll(() => body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  const before = await toolbar.boundingBox()
  await body.evaluate(element => { element.scrollTop = element.scrollHeight })
  const after = await toolbar.boundingBox()
  expect(before).not.toBeNull()
  expect(after).not.toBeNull()
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1)
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => submitted).not.toBeNull()
  expect(submitted).toMatchObject({ dimension: 'minecraft:overworld', x: 30, z: -20 })
  expect(submitted).not.toHaveProperty('y')
})
