import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('spot guide publication and ordering (PostgreSQL)', () => {
  let app: INestApplication, sql: ReturnType<typeof postgres>, root = ''
  const adminId = randomUUID(), session = randomUUID(), csrf = randomUUID(), origin = 'http://localhost:3000'
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const privateHeaders = { Cookie: 'xplay_session=' + session + '; xplay_csrf=' + csrf }
  const writeHeaders = { ...privateHeaders, Origin: origin, 'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' }
  const created: string[] = []
  const body = { ops: [{ insert: '説明です。\n' }] }

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(root + '/api' + path, init)
    const text = await response.text()
    const data: any = response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : text
    return { response, data }
  }
  const write = (path: string, method: string, value: unknown) =>
    request(path, { method, headers: writeHeaders, body: JSON.stringify(value) })

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = origin
    process.env.PUBLIC_API_BASE = 'http://localhost:3001/api'
    sql = postgres(process.env.DATABASE_URL!, { max: 2 })
    await sql`INSERT INTO accounts(id,name) VALUES(${adminId},'spot-test')`
    await sql`INSERT INTO account_discord_identities(discord_id,account_id) VALUES(${randomUUID()},${adminId})`
    await sql`INSERT INTO account_roles(account_id,role) VALUES(${adminId},'admin')`
    await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
      VALUES(${digest(session)},${adminId},${digest(csrf)},now()+interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = 'http://127.0.0.1:' + app.getHttpServer().address().port
  })
  afterAll(async () => {
    await app?.close()
    if (!sql) return
    try {
      for (const id of created) await sql`DELETE FROM spots WHERE id=${id}`
      await sql`DELETE FROM images WHERE uploaded_by=${adminId} AND purpose='spot'`
      await sql`DELETE FROM account_sessions WHERE account_id=${adminId}`
      await sql`DELETE FROM account_roles WHERE account_id=${adminId}`
      await sql`DELETE FROM account_discord_identities WHERE account_id=${adminId}`
      await sql`DELETE FROM accounts WHERE id=${adminId}`
    } finally { await sql.end() }
  })

  it('requires administrator and CSRF; only published public spots appear', async () => {
    const payload = { name: '案内' + randomUUID(), dimension: 'minecraft:overworld', x: 10, z: -20, body_delta: body }
    const anonymous = await request('/admin/spots/public', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    expect(anonymous.response.status).toBe(401)
    const missingCsrf = await request('/admin/spots/public', {
      method: 'POST', headers: { ...privateHeaders, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(missingCsrf.response.status).toBe(403)
    const draft = await write('/admin/spots/public', 'POST', payload)
    expect(draft.response.status).toBe(201)
    expect(draft.data.status).toBe('draft')
    created.push(draft.data.id)
    expect((await request('/spots/public/' + draft.data.id)).response.status).toBe(404)
    const publish = await write('/admin/spots/public/' + draft.data.id + '/publish', 'POST', { expected_version: 1 })
    expect(publish.response.status).toBe(201)
    expect(publish.data.status).toBe('published')
    const saved = (await request('/spots/public/' + draft.data.id)).data
    expect(saved.pos_x).toBe(10)
    expect(saved.pos_y).toBeNull()
    expect(saved.pos_z).toBe(-20)
    // Existing rows created before the X/Z-only change can still contain a Y value.
    await sql`UPDATE spots SET pos_y=64 WHERE id=${draft.data.id}`
    const withLegacyY = await write('/admin/spots/public/' + draft.data.id, 'PATCH',
      { expected_version: 2, y: 64, x: 12 })
    expect(withLegacyY.response.status).toBe(200)
    expect(withLegacyY.data.pos_x).toBe(12)
    expect(withLegacyY.data.pos_y).toBeNull()
    const stale = await write('/admin/spots/public/' + draft.data.id, 'PATCH', { expected_version: 1, name: '競合' })
    expect(stale.response.status).toBe(409)
    const images = await request('/spot-images/' + randomUUID())
    expect(images.response.status).toBe(404)
  })

  it('makes public order explicit and independently controlled', async () => {
    const post = await write('/admin/spots/public', 'POST',
      { name: '２番目', dimension: 'world', x: 0, z: 0, body_delta: body })
    expect(post.response.status).toBe(201)
    created.push(post.data.id)
    await write('/admin/spots/public/' + post.data.id + '/publish', 'POST', { expected_version: 1 })
    const before = (await request('/admin/spots/public', { headers: privateHeaders })).data
    const ids = before.map((item: any) => item.id)
    const mine = created.filter(id => ids.includes(id))
    const other = ids.filter((id: string) => !mine.includes(id))
    const desired = [...mine.reverse(), ...other]
    const reordered = await write('/admin/spots/public/order', 'POST', { ids: desired })
    expect(reordered.response.status).toBe(201)
    const list = (await request('/spots/public')).data
    expect(list.filter((item: any) => mine.includes(item.id)).map((item: any) => item.id)).toEqual(mine)
    expect((await write('/admin/spots/public/order', 'POST', { ids: [mine[0]] })).response.status).toBe(409)
  })

  it('binds a tourist spot to an approved territory and requires tags to publish', async () => {
    const territory = (await sql`SELECT id,current_name FROM territories WHERE status='approved' LIMIT 1`)[0]
    expect(territory?.id).toBeTruthy()
    const draft = await write('/admin/spots/tourist', 'POST',
      { name: '観光' + randomUUID(), territory_id: territory.id, body_delta: body, tags: [] })
    expect(draft.response.status).toBe(201)
    created.push(draft.data.id)
    expect((await request('/spots/tourist/' + draft.data.id)).response.status).toBe(404)
    expect((await write('/admin/spots/tourist/' + draft.data.id + '/publish', 'POST',
      { expected_version: 1 })).response.status).toBe(400)
    const tagged = await write('/admin/spots/tourist/' + draft.data.id, 'PATCH',
      { expected_version: 1, tags: ['観光案内'] })
    expect(tagged.response.status).toBe(200)
    const published = await write('/admin/spots/tourist/' + draft.data.id + '/publish', 'POST',
      { expected_version: 2 })
    expect(published.response.status).toBe(201)
    const visible = await request('/spots/tourist/' + draft.data.id)
    expect(visible.response.status).toBe(200)
    expect(visible.data.territory_name).toBe(territory.current_name)
    expect(visible.data.tags[0].name).toBe('観光案内')
    expect((await request('/spots/tags')).data.some((tag: any) => tag.name === '観光案内')).toBe(true)
    expect((await write('/admin/spots/tourist/' + draft.data.id, 'PATCH',
      { expected_version: 3, territory_id: randomUUID() })).response.status).toBe(400)
  })

  it('keeps uploaded spot images private until publication and removes them on deletion', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ4kAAAAASUVORK5CYII=', 'base64')
    const uploaded = await request('/admin/spot-images/file', {
      method: 'POST', headers: { ...privateHeaders, Origin: origin, 'X-XPlay-CSRF': csrf,
        'Content-Type': 'application/octet-stream', 'X-XPlay-Image-Mime': 'image/png' }, body: png,
    })
    expect(uploaded.response.status).toBe(201)
    expect((await request('/spot-images/' + uploaded.data.id)).response.status).toBe(401)
    const spot = await write('/admin/spots/public', 'POST', {
      name: '画像付き', dimension: 'world', x: 0, z: 0,
      main_image_id: uploaded.data.id, body_delta: { ops: [{ insert: { image: uploaded.data.url } }, { insert: '\n' }] },
    })
    expect(spot.response.status).toBe(201)
    created.push(spot.data.id)
    expect((await request('/spot-images/' + uploaded.data.id)).response.status).toBe(401)
    await write('/admin/spots/public/' + spot.data.id + '/publish', 'POST', { expected_version: 1 })
    expect((await request('/spot-images/' + uploaded.data.id)).response.status).toBe(200)
    await write('/admin/spots/public/' + spot.data.id + '/unpublish', 'POST', { expected_version: 2 })
    expect((await request('/spot-images/' + uploaded.data.id)).response.status).toBe(401)
    const removed = await write('/admin/spots/public/' + spot.data.id, 'DELETE', { expected_version: 3 })
    expect(removed.response.status).toBe(204)
    created.splice(created.indexOf(spot.data.id), 1)
    expect((await request('/spot-images/' + uploaded.data.id)).response.status).toBe(404)
  })
})
