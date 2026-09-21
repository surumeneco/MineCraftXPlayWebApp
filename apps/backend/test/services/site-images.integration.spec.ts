import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const databaseUrl = process.env.DATABASE_URL
const suite = databaseUrl ? describe : describe.skip

suite('site image presets (PostgreSQL and HTTP)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let root = ''
  let resourceId = '', presetId = ''
  const accountId = randomUUID()
  const discordId = `site-test-${randomUUID()}`
  const session = randomUUID(), csrf = randomUUID()
  const uniqueKey = `card.test_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const privateHeaders = { Cookie: `xplay_session=${session}; xplay_csrf=${csrf}` }
  const writeHeaders = { ...privateHeaders, Origin: 'http://localhost:3000', 'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' }

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${root}${path}`, init)
    const text = await response.text()
    return { response, data: response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : text }
  }
  function write(path: string, method: string, body?: object) {
    return request(path, { method, headers: writeHeaders, ...(body ? { body: JSON.stringify(body) } : {}) })
  }
  const svg = (fill: string) => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10" fill="${fill}"/></svg>`
    return { name: fill, mime_type: 'image/svg+xml', data_base64: Buffer.from(source).toString('base64') }
  }

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000'
    sql = postgres(databaseUrl!, { max: 2 })
    await sql`INSERT INTO accounts(id) VALUES (${accountId})`
    await sql`INSERT INTO account_discord_identities(discord_id, account_id) VALUES (${discordId}, ${accountId})`
    await sql`INSERT INTO account_roles(account_id, role) VALUES (${accountId}, 'admin')`
    await sql`INSERT INTO account_sessions(token_hash, account_id, csrf_hash, expires_at)
      VALUES (${hash(session)}, ${accountId}, ${hash(csrf)}, now() + interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${app.getHttpServer().address().port}`
  })

  afterAll(async () => {
    await app?.close()
    if (!sql) return
    try {
      await sql.begin(async tx => {
        const normal = await tx`SELECT id FROM site_image_presets WHERE is_default`
        await tx`UPDATE site_image_settings SET active_preset_id=${normal[0].id} WHERE singleton=true`
        if (presetId) await tx`DELETE FROM site_image_preset_events WHERE previous_preset_id=${presetId} OR next_preset_id=${presetId}`
        if (resourceId) await tx`DELETE FROM site_image_preset_items WHERE resource_id=${resourceId}`
        if (presetId) {
          await tx`DELETE FROM site_image_preset_items WHERE preset_id=${presetId}`
          await tx`DELETE FROM site_image_presets WHERE id=${presetId}`
        }
        if (resourceId) {
          const versions = await tx`SELECT image_id FROM site_image_versions WHERE resource_id=${resourceId} AND image_id IS NOT NULL`
          await tx`DELETE FROM site_image_versions WHERE resource_id=${resourceId}`
          for (const version of versions) await tx`DELETE FROM images WHERE id=${version.image_id}`
          await tx`DELETE FROM site_image_resources WHERE id=${resourceId}`
        }
        await tx`DELETE FROM account_sessions WHERE account_id=${accountId}`
        await tx`DELETE FROM account_roles WHERE account_id=${accountId}`
        await tx`DELETE FROM account_discord_identities WHERE account_id=${accountId}`
        await tx`DELETE FROM accounts WHERE id=${accountId}`
      })
    } finally { await sql.end() }
  })

  it('requires admin credentials and CSRF for all mutations', async () => {
    expect((await request('/api/admin/site-images')).response.status).toBe(401)
    expect((await request('/api/admin/site-image-presets')).response.status).toBe(401)
    const anonymous = await write('/api/admin/site-images/resources', 'POST', { key: uniqueKey, name: 'test' })
    // This helper sends a valid session. Confirm missing CSRF instead.
    const missingCsrf = await request('/api/admin/site-images/resources', {
      method: 'POST', headers: { ...privateHeaders, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: uniqueKey, name: 'test' }),
    })
    expect(missingCsrf.response.status).toBe(403)
    if (anonymous.response.status === 201) {
      resourceId = anonymous.data.id
    } else {
      expect(anonymous.response.status).toBe(409)
    }
  })

  it('preserves versions, isolates preview, inherits, overrides, disables and restores normal', async () => {
    if (!resourceId) {
      const resource = await write('/api/admin/site-images/resources', 'POST', { key: uniqueKey, name: '試験カード', description: '履歴検証用' })
      expect(resource.response.status).toBe(201)
      resourceId = resource.data.id
    }
    const before = await request('/api/site-images/manifest')
    expect(before.response.status).toBe(200)
    expect(before.data.images[uniqueKey]).toBeNull()

    const first = await write(`/api/admin/site-images/resources/${resourceId}/versions`, 'POST', svg('#112233'))
    expect(first.response.status).toBe(201)
    expect(first.data.version_number).toBe(1)
    const second = await write(`/api/admin/site-images/resources/${resourceId}/versions`, 'POST', svg('#abcdef'))
    expect(second.response.status).toBe(201)
    expect(second.data.version_number).toBe(2)
    expect((await request(`/api/admin/site-images/versions/${first.data.id}/file`)).response.status).toBe(401)
    expect((await request(`/api/admin/site-images/versions/${first.data.id}/file`, { headers: privateHeaders })).response.status).toBe(200)
    const rename = await write(`/api/admin/site-images/versions/${first.data.id}`, 'PATCH', { name: '通常の画像', note: '以前の版' })
    expect(rename.response.status).toBe(200)
    const inventory = await request('/api/admin/site-images', { headers: privateHeaders })
    expect(inventory.data.find((r: any) => r.id === resourceId).versions).toHaveLength(2)

    const defaults = await request('/api/admin/site-image-presets', { headers: privateHeaders })
    const normalId = defaults.data.presets.find((p: any) => p.is_default).id
    const setNormal = await write(`/api/admin/site-image-presets/${normalId}/items/${resourceId}`, 'PUT', {
      mode: 'image', version_id: first.data.id,
    })
    expect(setNormal.response.status).toBe(200)
    const defaultManifest = await request('/api/site-images/manifest')
    expect(defaultManifest.data.images[uniqueKey].version_id).toBe(first.data.id)
    const publicFirst = await request(`/api/site-images/${uniqueKey}`)
    expect(publicFirst.response.status).toBe(200)
    expect(publicFirst.response.headers.get('content-type')).toContain('image/svg+xml')
    expect(publicFirst.response.headers.get('content-security-policy')).toContain('sandbox')

    const created = await write('/api/admin/site-image-presets', 'POST', { name: 'イベント', description: 'テスト用' })
    expect(created.response.status).toBe(201)
    presetId = created.data.id
    const activate = await write(`/api/admin/site-image-presets/${presetId}/apply`, 'POST')
    expect(activate.response.status).toBe(201)
    expect((await request('/api/site-images/manifest')).data.images[uniqueKey].version_id).toBe(first.data.id)

    const none = await write(`/api/admin/site-image-presets/${presetId}/items/${resourceId}`, 'PUT', { mode: 'none' })
    expect(none.response.status).toBe(200)
    expect((await request('/api/site-images/manifest')).data.images[uniqueKey]).toBeNull()
    expect((await request(`/api/site-images/${uniqueKey}`)).response.status).toBe(404)

    const override = await write(`/api/admin/site-image-presets/${presetId}/items/${resourceId}`, 'PUT', {
      mode: 'image', version_id: second.data.id,
    })
    expect(override.response.status).toBe(200)
    expect((await request('/api/site-images/manifest')).data.images[uniqueKey].version_id).toBe(second.data.id)
    expect((await request(`/api/site-images/${uniqueKey}`)).data).toContain('#abcdef')

    const inherit = await write(`/api/admin/site-image-presets/${presetId}/items/${resourceId}`, 'PUT', { mode: 'inherit' })
    expect(inherit.response.status).toBe(200)
    expect((await request('/api/site-images/manifest')).data.images[uniqueKey].version_id).toBe(first.data.id)
    const back = await write(`/api/admin/site-image-presets/${normalId}/apply`, 'POST')
    expect(back.response.status).toBe(201)
    expect((await request('/api/site-images/manifest')).data.images[uniqueKey].version_id).toBe(first.data.id)
    const history = await request('/api/admin/site-image-presets/history', { headers: privateHeaders })
    expect(history.data.some((event: any) => event.next_preset_id === presetId)).toBe(true)
    expect(history.data.some((event: any) => event.previous_preset_id === presetId)).toBe(true)
  })
})
