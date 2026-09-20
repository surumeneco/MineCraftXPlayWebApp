import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const databaseUrl = process.env.DATABASE_URL
const suite = databaseUrl ? describe : describe.skip

suite('notice integration (PostgreSQL)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let root = ''
  const admin = `test-${randomUUID()}`
  const session = randomUUID(), csrf = randomUUID()
  const hash = (text: string) => createHash('sha256').update(text).digest('hex')
  const origin = 'http://localhost:3000'
  const privateHeaders = { Cookie: `xplay_session=${session}; xplay_csrf=${csrf}` }
  const writeHeaders = { ...privateHeaders, Origin: origin, 'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' }
  const testTitle = `試験${randomUUID()}`
  const renamedTitle = `変更${randomUUID()}`
  const temp = randomUUID()
  const created: string[] = []

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${root}${path}`, init)
    const text = await response.text()
    const data: any = response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : text
    return { response, data }
  }
  function write(path: string, method: string, body: object) {
    return request(path, { method, headers: writeHeaders, body: JSON.stringify(body) })
  }

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = origin
    process.env.PUBLIC_API_BASE = 'http://localhost:3001/api'
    process.env.ADMIN_DISCORD_IDS = admin
    sql = postgres(databaseUrl!, { max: 2 })
    await sql`INSERT INTO admin_users (discord_id) VALUES (${admin}) ON CONFLICT DO NOTHING`
    await sql`INSERT INTO admin_sessions (token_hash, discord_id, csrf_hash, expires_at)
      VALUES (${hash(session)}, ${admin}, ${hash(csrf)}, now() + interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    const address = app.getHttpServer().address()
    root = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await app?.close()
    if (sql) {
      for (const id of created) {
        await sql`DELETE FROM images WHERE id IN (SELECT image_id FROM notice_images WHERE notice_id=${id})`
        await sql`DELETE FROM notices WHERE id=${id}`
      }
      await sql`DELETE FROM images WHERE uploaded_by=${admin}`
      await sql`DELETE FROM admin_users WHERE discord_id=${admin}`
      await sql.end()
    }
  })

  it('protects administrative mutations and creates a draft with a real DB row', async () => {
    const invalid = await request('/api/admin/notices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: testTitle, body_delta: { ops: [] }, tags: [] }),
    })
    expect(invalid.response.status).toBe(401)
    const badCsrf = await request('/api/admin/notices', {
      method: 'POST', headers: { ...privateHeaders, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: testTitle, body_delta: { ops: [] }, tags: [] }),
    })
    expect(badCsrf.response.status).toBe(403)
    const draft = await write('/api/admin/notices', 'POST', {
      title: testTitle, body_delta: { ops: [] }, tags: ['重要'], upload_session_id: temp,
    })
    expect(draft.response.status).toBe(201)
    expect(draft.data.status).toBe('draft')
    expect(draft.data.published_at).toBeNull()
    expect(draft.data.updated_at).toBeTruthy()
    expect(draft.data.created_at).toBeTruthy()
    expect(draft.data.version).toBe(1)
    created.push(draft.data.id)
    expect((await request(`/api/notices/${encodeURIComponent(testTitle)}`)).response.status).toBe(404)
    const blankPublish = await write(`/api/admin/notices/${draft.data.id}/publish`, 'POST', { expected_version: 1 })
    expect(blankPublish.response.status).toBe(400)
    const duplicate = await write('/api/admin/notices', 'POST', {
      title: testTitle, body_delta: { ops: [] }, tags: [],
    })
    expect(duplicate.response.status).toBe(409)
  })

  it('uploads a temporary image and promotes it through edit and publication', async () => {
    const id = created[0]
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ4kAAAAASUVORK5CYII=', 'base64')
    const image = await write('/api/admin/images', 'POST', {
      purpose: 'notice', mime_type: 'image/png', data_base64: png.toString('base64'), upload_session_id: temp,
    })
    expect(image.response.status).toBe(201)
    const imageId = image.data.id
    expect((await request(`/api/images/${imageId}`)).response.status).toBe(401)
    expect((await request(`/api/images/${imageId}`, { headers: privateHeaders })).response.status).toBe(200)
    const edited = await write(`/api/admin/notices/${id}`, 'PATCH', {
      title: testTitle, expected_version: 1, upload_session_id: temp,
      body_delta: { ops: [{ insert: '前文\n' }, { insert: { image: image.data.url } }, { insert: '\n後文\n' }] },
      tags: ['重要', '案内'],
    })
    expect(edited.response.status).toBe(200)
    expect(edited.data.version).toBe(2)
    const published = await write(`/api/admin/notices/${id}/publish`, 'POST', { expected_version: 2 })
    expect(published.response.status).toBe(201)
    expect(published.data.status).toBe('published')
    expect(published.data.published_at).toBe(published.data.updated_at)
    expect((await request(`/api/notices/${encodeURIComponent(testTitle)}`)).response.status).toBe(200)
    expect((await request(`/api/images/${imageId}`)).response.status).toBe(200)
    expect((await request('/api/tags')).data.some((tag: any) => tag.name === '案内')).toBe(true)
    const noTitleChange = await write(`/api/admin/notices/${id}`, 'PATCH', {
      expected_version: 3, title: renamedTitle,
    })
    expect(noTitleChange.response.status).toBe(409)
    expect((await write(`/api/admin/notices/${id}`, 'DELETE', { expected_version: 3 })).response.status).toBe(409)
    const unpublished = await write(`/api/admin/notices/${id}/unpublish`, 'POST', { expected_version: 3 })
    expect(unpublished.response.status).toBe(201)
    expect(unpublished.data.status).toBe('unpublished')
    expect(unpublished.data.updated_at).not.toBe(published.data.updated_at)
    expect((await request(`/api/notices/${encodeURIComponent(testTitle)}`)).response.status).toBe(404)
    expect((await request(`/api/images/${imageId}`)).response.status).toBe(401)
    expect((await request('/api/tags')).data.some((tag: any) => tag.name === '案内')).toBe(false)
    const renamed = await write(`/api/admin/notices/${id}`, 'PATCH', {
      expected_version: 4, title: renamedTitle,
    })
    expect(renamed.response.status).toBe(200)
    expect(renamed.data.version).toBe(5)
    const republished = await write(`/api/admin/notices/${id}/publish`, 'POST', { expected_version: 5 })
    expect(republished.response.status).toBe(201)
    expect(republished.data.published_at).toBe(republished.data.updated_at)
    expect((await request(`/api/notices/${encodeURIComponent(renamedTitle)}`)).response.status).toBe(200)
    const takenDown = await write(`/api/admin/notices/${id}/unpublish`, 'POST', { expected_version: 6 })
    expect(takenDown.response.status).toBe(201)
    const deleted = await write(`/api/admin/notices/${id}`, 'DELETE', { expected_version: 7 })
    expect(deleted.response.status).toBe(204)
    created.splice(created.indexOf(id), 1)
    expect((await request(`/api/images/${imageId}`)).response.status).toBe(404)
  })
})
