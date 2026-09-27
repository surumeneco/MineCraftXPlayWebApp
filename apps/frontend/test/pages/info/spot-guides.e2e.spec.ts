import { expect, test } from '@nuxt/test-utils/playwright'

const alpha = '91b613f9-f82c-4c76-aaec-ff0200000011'
const beta = '91b613f9-f82c-4c76-aaec-ff0200000012'
const gamma = '91b613f9-f82c-4c76-aaec-ff0200000013'
const sky = '91b613f9-f82c-4c76-aaec-ff0200000101'
const river = '91b613f9-f82c-4c76-aaec-ff0200000102'

function spot(id: string, kind: 'public' | 'tourist', name: string,
  published: string, updated: string, tags: Array<{ id: string; name: string }> = []) {
  return {
    id, kind, name, body_delta: { ops: [{ insert: name + 'についての案内\n' }] },
    main_image_id: null, dimension: kind === 'public' ? 'minecraft:overworld' : null,
    pos_x: kind === 'public' ? 30 : null, pos_y: null,
    pos_z: kind === 'public' ? -20 : null, territory_id: kind === 'tourist' ? gamma : null,
    territory_name: kind === 'tourist' ? '第一共同建築エリア' : null,
    sort_order: 0, status: 'published', created_at: published,
    published_at: published, updated_at: updated, tags, version: 2,
  }
}
const rows = [
  spot(alpha, 'tourist', '桜の丘', '2026-09-25T00:00:00Z', '2026-09-25T00:00:00Z', [{ id: sky, name: '自然' }]),
  spot(beta, 'tourist', '桜の谷', '2026-09-24T00:00:00Z', '2026-09-27T00:00:00Z', [{ id: river, name: '建築' }]),
  spot(gamma, 'tourist', '湖畔', '2026-09-23T00:00:00Z', '2026-09-26T00:00:00Z', [{ id: sky, name: '自然' }]),
]

async function installSpotApi(page: import('@playwright/test').Page) {
  await page.route('**/api/spots/**', async route => {
    const url = new URL(route.request().url())
    const type = url.pathname.startsWith('/api/spots/tourist') ? 'tourist' : 'public'
    const data = type === 'public'
      ? [spot(alpha, 'public', '案内一', '2026-09-25T00:00:00Z', '2026-09-25T00:00:00Z'),
        spot(beta, 'public', '案内二', '2026-09-24T00:00:00Z', '2026-09-24T00:00:00Z')]
      : rows
    const id = url.pathname.split('/')[4]
    const body = id ? data.find(value => value.id === id) : data
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': new URL(route.request().headers()['origin'] ?? 'http://localhost:3000').origin,
        'access-control-allow-credentials': 'true' },
      body: JSON.stringify(body ?? { statusCode: 404, message: 'Not found' }),
    })
  })
}

test('spot guide public cards navigate to Quill detail with the location', async ({ page, goto }) => {
  await installSpotApi(page)
  await goto('/info/public-spots', { waitUntil: 'hydration' })
  await expect(page.getByRole('heading', { name: '公営スポット案内' })).toBeVisible()
  const cards = page.locator('main a.xplay-card--link')
  await expect(cards).toHaveCount(2)
  await expect(cards.first()).toContainText('案内一')
  await expect(cards.first().locator('img')).toHaveCount(0)
  await cards.first().click()
  await expect(page).toHaveURL(new RegExp('/info/public-spots/' + alpha + '$'))
  await expect(page.getByRole('heading', { name: '案内一' })).toBeVisible()
  await expect(page.locator('main .ql-editor')).toContainText('案内一についての案内')
  await expect(page.locator('main')).toContainText('minecraft:overworld / X:30 Z:-20')
})

test('tourist guide combines name and tag filters and switches between published and updated dates', async ({ page, goto }) => {
  await installSpotApi(page)
  await goto('/info/tourist-spots', { waitUntil: 'hydration' })
  const cards = page.locator('main a.xplay-card--link')
  await expect(cards).toHaveCount(3)
  await expect(cards.first()).toContainText('桜の丘')
  await page.getByRole('switch', { name: '更新日時順で表示' }).check()
  await expect(cards.first()).toContainText('桜の谷')
  await page.getByRole('searchbox', { name: '名前で検索' }).fill('桜')
  await expect(cards).toHaveCount(2)
  await page.getByRole('combobox', { name: 'タグで絞り込み' }).selectOption(sky)
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('桜の丘')
  await page.getByRole('switch', { name: '更新日時順で表示' }).uncheck()
  await expect(cards.first()).toContainText('桜の丘')
})
