import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('account administration integration (PostgreSQL)', () => {
  let app: INestApplication, sql: ReturnType<typeof postgres>, root = ''
  const adminId = randomUUID(), sourceId = randomUUID(), targetId = randomUUID()
  const session = randomUUID(), memberSession = randomUUID(), targetSession = randomUUID(), csrf = randomUUID()
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const origin = 'http://localhost:3000'
  const cookie = (token: string) => `xplay_session=${token}; xplay_csrf=${csrf}`
  async function request(path: string, method = 'GET', body?: object, token = session) {
    const response = await fetch(root + path, { method,
      headers: { Cookie: cookie(token), Origin: origin, 'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() as any : null
    return { status: response.status, data }
  }

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
      (${digest(memberSession)},${sourceId},${digest(csrf)},now()+interval '1 hour'),
      (${digest(targetSession)},${targetId},${digest(csrf)},now()+interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${app.getHttpServer().address().port}`
  })

  afterAll(async () => {
    await app?.close()
    if (sql) {
      const ids = [adminId, sourceId, targetId]
      await sql`DELETE FROM images WHERE uploaded_by IN ${sql(ids)}`
      await sql`UPDATE account_discord_identities SET merge_origin=NULL WHERE merge_origin IN ${sql(ids)}`
      await sql`UPDATE account_minecraft_identities SET merge_origin=NULL WHERE merge_origin IN ${sql(ids)}`
      await sql`DELETE FROM account_merges WHERE source_account_id IN ${sql(ids)} OR target_account_id IN ${sql(ids)}`
      await sql`DELETE FROM accounts WHERE id IN ${sql(ids)}`
      await sql.end()
    }
  })

  it('reflects permissions dynamically and rejects non-administrators', async () => {
    expect((await request('/api/auth/session', 'GET', undefined, memberSession)).data.is_admin).toBe(false)
    expect((await request('/api/admin/accounts', 'GET', undefined, memberSession)).status).toBe(403)
    expect((await request(`/api/admin/accounts/${sourceId}/role`, 'PATCH', { is_admin: true }, memberSession)).status).toBe(403)
    expect((await request(`/api/admin/accounts/${sourceId}/role`, 'PATCH', { is_admin: true })).status).toBe(200)
    expect((await request('/api/auth/session', 'GET', undefined, memberSession)).data.is_admin).toBe(true)
    expect((await request(`/api/admin/accounts/${sourceId}/role`, 'PATCH', { is_admin: false })).status).toBe(200)
    expect((await request('/api/auth/session', 'GET', undefined, memberSession)).data.is_admin).toBe(false)
  })

  it('reverses ownership and roles without losing source account or leaking sessions', async () => {
    const image = await sql`INSERT INTO images(purpose,data,mime_type,size,uploaded_by)
      VALUES ('notice',${Buffer.from([255,216,255])},'image/jpeg',3,${sourceId}) RETURNING id`
    const minecraft = await sql`INSERT INTO account_minecraft_identities(account_id,edition,username)
      VALUES (${sourceId},'je','ReversibleMerge') RETURNING id`
    expect((await request(`/api/admin/accounts/${targetId}/discord`, 'POST', { discord_id: '900000000000000099' })).status).toBe(404)
    expect((await request(`/api/admin/accounts/${sourceId}/role`, 'PATCH', { is_admin: true })).status).toBe(200)
    const merged = await request('/api/admin/accounts/merge', 'POST', { target_account_id: targetId, source_account_id: sourceId })
    expect(merged.status).toBe(201)
    const target = merged.data.find((account: any) => account.id === targetId)
    expect(target.discord_ids).toHaveLength(2)
    expect(target.merged_sources[0].id).toBe(sourceId)
    expect(target.is_admin).toBe(true)
    expect(merged.data.some((account: any) => account.id === sourceId)).toBe(false)
    expect((await sql`SELECT name FROM accounts WHERE id=${sourceId}`)).toHaveLength(1)
    expect((await sql`SELECT account_id, merge_origin FROM account_discord_identities WHERE discord_id='900000000000000002'`)[0]).toMatchObject({ account_id: targetId, merge_origin: sourceId })
    expect((await sql`SELECT uploaded_by, merge_origin FROM images WHERE id=${image[0].id}`)[0]).toMatchObject({ uploaded_by: targetId, merge_origin: sourceId })
    expect((await sql`SELECT account_id, merge_origin FROM account_minecraft_identities WHERE id=${minecraft[0].id}`)[0]).toMatchObject({ account_id: targetId, merge_origin: sourceId })
    expect((await request('/api/auth/session', 'GET', undefined, memberSession)).data.authenticated).toBe(false)
    expect((await request(`/api/admin/accounts/${targetId}/role`, 'PATCH', { is_admin: false })).status).toBe(409)
    expect((await request(`/api/admin/accounts/${targetId}/discord/900000000000000002`, 'DELETE')).status).toBe(409)
    expect((await request(`/api/admin/accounts/${targetId}/minecraft/${minecraft[0].id}`, 'DELETE')).status).toBe(409)
    expect((await request('/api/admin/accounts/merge', 'POST', { target_account_id: adminId, source_account_id: targetId })).status).toBe(409)
    expect((await request(`/api/admin/accounts/merges/${sourceId}/restore`, 'POST', undefined, memberSession)).status).toBe(401)
    const restored = await request(`/api/admin/accounts/merges/${sourceId}/restore`, 'POST')
    expect(restored.status).toBe(201)
    expect(restored.data.find((account: any) => account.id === sourceId).is_admin).toBe(true)
    expect(restored.data.find((account: any) => account.id === targetId).is_admin).toBe(false)
    expect(restored.data.find((account: any) => account.id === targetId).merged_sources).toEqual([])
    expect((await sql`SELECT account_id, merge_origin FROM account_discord_identities WHERE discord_id='900000000000000002'`)[0]).toMatchObject({ account_id: sourceId, merge_origin: null })
    expect((await sql`SELECT uploaded_by, merge_origin FROM images WHERE id=${image[0].id}`)[0]).toMatchObject({ uploaded_by: sourceId, merge_origin: null })
    expect((await sql`SELECT account_id, merge_origin FROM account_minecraft_identities WHERE id=${minecraft[0].id}`)[0]).toMatchObject({ account_id: sourceId, merge_origin: null })
    expect((await sql`SELECT restored_at FROM account_merges WHERE source_account_id=${sourceId}`)[0].restored_at).not.toBeNull()
    expect((await request('/api/auth/session', 'GET', undefined, targetSession)).data.authenticated).toBe(false)
    expect((await request(`/api/admin/accounts/merges/${sourceId}/restore`, 'POST')).status).toBe(404)
    expect((await request(`/api/admin/accounts/${sourceId}`, 'DELETE')).status).toBe(409)
  })
})
