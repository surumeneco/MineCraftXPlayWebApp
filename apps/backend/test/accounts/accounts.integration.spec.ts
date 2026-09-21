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
    body: JSON.stringify(body),
  })

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = origin
    sql = postgres(process.env.DATABASE_URL!, { max: 2 })
    for (const id of [adminId, sourceId, targetId]) await sql`INSERT INTO accounts(id) VALUES (${id})`
    for (const [discord, id] of [['900000000000000001', adminId], ['900000000000000002', sourceId], ['900000000000000003', targetId]]) {
      await sql`INSERT INTO account_discord_identities(discord_id,account_id) VALUES (${discord},${id}) ON CONFLICT DO NOTHING`
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
    expect((await request('/api/admin/accounts/' + adminId + '/role', 'PATCH', { is_admin: false })).status).toBe(409)
  })

  it('merges identities without leaking previous sessions', async () => {
    const before = await call('/api/admin/accounts', { headers: { Cookie: cookie(session) } })
    expect(before.data.find((entry: any) => entry.id === sourceId).discord_ids.length).toBe(1)
    const result = await request('/api/admin/accounts/merge', 'POST', { target_account_id: targetId, source_account_id: sourceId })
    expect(result.status).toBe(201)
    expect(result.data.find((entry: any) => entry.id === targetId).discord_ids).toHaveLength(2)
    expect(result.data.some((entry: any) => entry.id === sourceId)).toBe(false)
    expect((await call('/api/auth/session', { headers: { Cookie: cookie(memberSession) } })).data.authenticated).toBe(false)
    expect((await request('/api/admin/accounts/merge', 'POST', { target_account_id: targetId, source_account_id: targetId })).status).toBe(400)
  })
})
