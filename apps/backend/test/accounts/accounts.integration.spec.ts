import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('account administration integration (PostgreSQL)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let root = ''
  const adminId = randomUUID(), sourceId = randomUUID(), targetId = randomUUID()
  const session = randomUUID(), memberSession = randomUUID(), csrf = randomUUID()
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const origin = 'http://localhost:3000'
  const cookie = (value: string) => `xplay_session=${value}; xplay_csrf=${csrf}`

  async function call(path: string, options: RequestInit = {}) {
    const res = await fetch(root + path, options)
    return { status: res.status, data: res.headers.get('content-type')?.includes('json') ? await res.json() as any : await res.text() }
  }
  const request = (path: string, method: string, body: any, token = session) => call(path, {
    method, headers: { Cookie: cookie(token), Origin: origin, 'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = origin
    sql = postgres(process.env.DATABASE_URL!, { max: 2 })
    for (const id of [adminId, sourceId, targetId]) await sql`INSERT INTO accounts(id) VALUES (${id})`
    for (const [discord, id] of [['900000000000000001', adminId], ['900000000000000002', sourceId], ['900000000000000003', targetId]]) {
      await sql`INSERT INTO account_discord_identities(discord_id,account_id) VALUES (${discord},${id})`
    }
    await sql`INSERT INTO account_roles(account_id,role) VALUES (${adminId},'admin')`
    await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
      VALUES (${digest(session)},${adminId},${digest(csrf)},now()+interval '1 hour'),
      (${digest(memberSession)},${sourceId},${digest(csrf)},now()+interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${app.getHttpServer().address().port}`
  })

  afterAll(async () => {
    await app?.close()
    if (sql) {
      await sql`DELETE FROM account_merges WHERE source_account_id IN (${adminId},${sourceId},${targetId}) OR target_account_id IN (${adminId},${sourceId},${targetId})`
      await sql`DELETE FROM accounts WHERE id IN (${adminId},${sourceId},${targetId})`
      await sql.end()
    }
  })

  it('automatically reflects permissions and rejects non-administrators', async () => {
    const self = await call('/api/auth/session', { headers: { Cookie: cookie(memberSession) } })
    expect(self.data.authenticated).toBe(true)
    expect(self.data.is_admin).toBe(false)
    expect((await call('/api/admin/accounts', { headers: { Cookie: cookie(memberSession) } })).status).toBe(403)
    expect((await request('/api/admin/accounts/' + sourceId + '/role', 'PATCH', { is_admin: true }, memberSession)).status).toBe(403)
    expect((await request('/api/admin/accounts/' + sourceId + '/role', 'PATCH', { is_admin: true })).status).toBe(200)
    const promoted = await call('/api/auth/session', { headers: { Cookie: cookie(memberSession) } })
    expect(promoted.data.is_admin).toBe(true)
    expect((await request('/api/admin/accounts/' + sourceId + '/role', 'PATCH', { is_admin: false })).status).toBe(200)
    expect((await call('/api/auth/session', { headers: { Cookie: cookie(memberSession) } })).data.is_admin).toBe(false)
    const admins = await sql`SELECT COUNT(*)::INTEGER AS count FROM account_roles WHERE role='admin'`
    if (Number(admins[0].count) === 1) {
      expect((await request('/api/admin/accounts/' + adminId + '/role', 'PATCH', { is_admin: false })).status).toBe(409)
    }
  })

  it('retains source UUID and provenance, supports restoring identities and image ownership', async () => {
    const image = await sql`INSERT INTO images(purpose,data,mime_type,size,uploaded_by)
      VALUES ('notice',${Buffer.from([255, 216, 255])},'image/jpeg',3,${sourceId}) RETURNING id`
    const minecraft = await sql`INSERT INTO account_minecraft_identities(account_id,edition,username)
      VALUES (${sourceId},'je','ReversibleMerge') RETURNING id`
    const before = await call('/api/admin/accounts', { headers: { Cookie: cookie(session) } })
    expect(before.status).toBe(200)
    expect(before.data.find((entry: any) => entry.id === sourceId).discord_ids).toHaveLength(1)
    expect((await request('/api/admin/accounts/' + targetId + '/discord', 'POST', { discord_id: '900000000000000099' })).status).toBe(404)
    const result = await request('/api/admin/accounts/merge', 'POST', { target_account_id: targetId, source_account_id: sourceId })
    expect(result.status).toBe(201)
    const retained = result.data.find((entry: any) => entry.id === targetId)
    expect(retained.discord_ids).toHaveLength(2)
    expect(retained.merged_sources[0].id).toBe(sourceId)
    expect(result.data.some((entry: any) => entry.id === sourceId)).toBe(false)
    expect((await sql`SELECT 1 FROM accounts WHERE id=${sourceId}`)).toHaveLength(1)
    expect((await sql`SELECT account_id, merge_origin FROM account_discord_identities WHERE discord_id='900000000000000002'`)[0]).toMatchObject({ account_id: targetId, merge_origin: sourceId })
    expect((await sql`SELECT uploaded_by, merge_origin FROM images WHERE id=${image[0].id}`)[0]).toMatchObject({ uploaded_by: targetId, merge_origin: sourceId })
    expect((await sql`SELECT account_id, merge_origin FROM account_minecraft_identities WHERE id=${minecraft[0].id}`)[0]).toMatchObject({ account_id: targetId, merge_origin: sourceId })
    expect((await call('/api/auth/session', { headers: { Cookie: cookie(memberSession) } })).data.authenticated).toBe(false)
    expect((await request('/api/admin/accounts/' + targetId + '/role', 'PATCH', { is_admin: true })).status).toBe(409)
    expect((await request('/api/admin/accounts/' + targetId + '/discord/900000000000000002', 'DELETE', undefined)).status).toBe(409)
    expect((await request('/api/admin/accounts/' + targetId + '/minecraft/' + minecraft[0].id, 'DELETE', undefined)).status).toBe(409)
    expect((await request('/api/admin/accounts/merge', 'POST', { target_account_id: adminId, source_account_id: targetId })).status).toBe(409)
    expect((await request('/api/admin/accounts/merges/' + sourceId + '/restore', 'POST', undefined, memberSession)).status).toBe(401)
    const restored = await request('/api/admin/accounts/merges/' + sourceId + '/restore', 'POST', undefined)
    expect(restored.status).toBe(201)
    expect(restored.data.some((entry: any) => entry.id === sourceId)).toBe(true)
    expect(restored.data.find((entry: any) => entry.id === targetId).merged_sources).toEqual([])
    expect((await sql`SELECT account_id, merge_origin FROM account_discord_identities WHERE discord_id='900000000000000002'`)[0]).toMatchObject({ account_id: sourceId, merge_origin: null })
    expect((await sql`SELECT uploaded_by, merge_origin FROM images WHERE id=${image[0].id}`)[0]).toMatchObject({ uploaded_by: sourceId, merge_origin: null })
    expect((await sql`SELECT account_id, merge_origin FROM account_minecraft_identities WHERE id=${minecraft[0].id}`)[0]).toMatchObject({ account_id: sourceId, merge_origin: null })
    expect((await sql`SELECT restored_at FROM account_merges WHERE source_account_id=${sourceId}`)[0].restored_at).not.toBeNull()
    expect((await request('/api/admin/accounts/merges/' + sourceId + '/restore', 'POST', undefined)).status).toBe(401)
    // Restore invalidates all target sessions; reinstate test administrator to check history safely.
    await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
      VALUES (${digest(session)},${adminId},${digest(csrf)},now()+interval '1 hour') ON CONFLICT DO NOTHING`
    expect((await request('/api/admin/accounts/' + sourceId, 'DELETE', undefined)).status).toBe(409)
    await sql`DELETE FROM images WHERE id=${image[0].id}`
    await sql`DELETE FROM account_minecraft_identities WHERE id=${minecraft[0].id}`
  })
})
