import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const databaseUrl = process.env.DATABASE_URL
const suite = databaseUrl ? describe : describe.skip

suite('large site images and operator images (PostgreSQL and HTTP)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let root = '', resourceId = ''
  const accountId = randomUUID(), session = randomUUID(), csrf = randomUUID()
  const discordId = `site-large-${randomUUID()}`
  const key = `operator.test_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const cookie = `xplay_session=${session}; xplay_csrf=${csrf}`
  const headers = { Cookie: cookie, Origin: 'http://localhost:3000', 'X-XPlay-CSRF': csrf }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9000 9000"><rect width="9000" height="9000"/>${' '.repeat(5 * 1024 * 1024 + 1)}</svg>`)

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
      if (resourceId) await sql.begin(async tx => {
        await tx`DELETE FROM site_image_preset_items WHERE resource_id=${resourceId}`
        const versions = await tx`SELECT image_id FROM site_image_versions WHERE resource_id=${resourceId} AND image_id IS NOT NULL`
        await tx`DELETE FROM site_image_versions WHERE resource_id=${resourceId}`
        for (const version of versions) await tx`DELETE FROM images WHERE id=${version.image_id}`
        await tx`DELETE FROM site_image_resources WHERE id=${resourceId}`
      })
      await sql`DELETE FROM account_sessions WHERE account_id=${accountId}`
      await sql`DELETE FROM account_roles WHERE account_id=${accountId}`
      await sql`DELETE FROM account_discord_identities WHERE account_id=${accountId}`
      await sql`DELETE FROM accounts WHERE id=${accountId}`
    } finally { await sql.end() }
  })

  it('seeds all five existing member images as preset-managed initial versions', async () => {
    const rows = await sql`
      SELECT r.key, v.static_path, v.version_number, pi.version_id
      FROM site_image_resources r
      JOIN site_image_versions v ON v.resource_id=r.id
      JOIN site_image_presets p ON p.is_default
      JOIN site_image_preset_items pi ON pi.preset_id=p.id AND pi.resource_id=r.id
      WHERE r.key LIKE 'operator.%' AND v.version_number=1
      ORDER BY r.key`
    expect(rows.map(r => [r.key, r.static_path])).toEqual([
      ['operator.loofgald', '/images/operators/Loofgald.png'],
      ['operator.rnad0', '/images/operators/rnad0.png'],
      ['operator.shirokana', '/images/operators/shirokana.png'],
      ['operator.surumeneco', '/images/operators/surumeneco.png'],
      ['operator.zawazawa123', '/images/operators/zawazawa123.png'],
    ])
    expect(rows.every(row => row.version_id)).toBe(true)
  })

  it('authenticates before accepting binary data, stores >5 MiB and leaves notice limit intact', async () => {
    const resource = await fetch(`${root}/api/admin/site-images/resources`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, name: '容量テスト' }),
    })
    expect(resource.status).toBe(201)
    resourceId = (await resource.json()).id
    const url = `${root}/api/admin/site-images/resources/${resourceId}/versions/file`
    const metadata = {
      'Content-Type': 'application/octet-stream',
      'X-XPlay-Image-Name': encodeURIComponent('高解像度の背景'),
      'X-XPlay-Image-Note': encodeURIComponent('5 MiB以上'),
      'X-XPlay-Image-Mime': 'image/svg+xml',
    }
    const noAuth = await fetch(url, { method: 'POST', headers: metadata, body: Buffer.from('x') })
    expect(noAuth.status).toBe(401)
    const noCsrf = await fetch(url, { method: 'POST', headers: { ...metadata, Cookie: cookie, Origin: 'http://localhost:3000' }, body: Buffer.from('x') })
    expect(noCsrf.status).toBe(403)
    const uploaded = await fetch(url, { method: 'POST', headers: { ...headers, ...metadata }, body: svg })
    expect(uploaded.status).toBe(201)
    const version = await uploaded.json()
    expect(version.version_number).toBe(1)
    const [image] = await sql`SELECT i.size, octet_length(i.data) AS bytes
      FROM site_image_versions v JOIN images i ON i.id=v.image_id WHERE v.id=${version.id}`
    expect(Number(image.size)).toBe(svg.length)
    expect(Number(image.bytes)).toBe(svg.length)
    expect(Number(image.bytes)).toBeGreaterThan(5 * 1024 * 1024)
    const preview = await fetch(`${root}/api/admin/site-images/versions/${version.id}/file`, { headers: { Cookie: cookie } })
    expect(preview.status).toBe(200)
    expect((await preview.arrayBuffer()).byteLength).toBe(svg.length)
    await expect(sql`INSERT INTO images(purpose, data, mime_type, size, uploaded_by)
      VALUES ('notice', ${svg}, 'image/png', ${svg.length}, ${accountId})`).rejects.toMatchObject({ code: '23514' })
  })
})
