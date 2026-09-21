import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('account profiles and protected initial administrator (PostgreSQL)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let root = ''
  const protectedId = randomUUID(), adminId = randomUUID(), memberId = randomUUID(), targetId = randomUUID()
  const protectedDiscord = '981000000000000001', adminDiscord = '981000000000000002'
  const memberDiscord = '981000000000000003', targetDiscord = '981000000000000004'
  const session = randomUUID(), memberSession = randomUUID(), csrf = randomUUID()
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const origin = 'http://localhost:3000'
  const request = async (path: string, method: string, body?: object, loginToken = session) => {
    const response = await fetch(root + path, {
      method,
      headers: { Cookie: `xplay_session=${loginToken}; xplay_csrf=${csrf}`, Origin: origin,
        'X-XPlay-CSRF': csrf, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() as any : null
    return { status: response.status, data }
  }

  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = origin
    process.env.ADMIN_DISCORD_IDS = protectedDiscord
    sql = postgres(process.env.DATABASE_URL!, { max: 2 })
    for (const [id, name, discord] of [
      [protectedId, 'Protected', protectedDiscord], [adminId, 'Admin', adminDiscord],
      [memberId, 'Member', memberDiscord], [targetId, 'Target', targetDiscord],
    ]) {
      await sql`INSERT INTO accounts(id,name) VALUES (${id},${name})`
      await sql`INSERT INTO account_discord_identities(discord_id,account_id,username,display_name)
        VALUES (${discord},${id},${name},${name})`
    }
    await sql`INSERT INTO account_roles(account_id,role) VALUES (${protectedId},'admin'),(${adminId},'admin')`
    await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
      VALUES (${digest(session)},${adminId},${digest(csrf)},now()+interval '1 hour'),
      (${digest(memberSession)},${memberId},${digest(csrf)},now()+interval '1 hour')`
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${app.getHttpServer().address().port}`
  })

  afterAll(async () => {
    await app?.close()
    if (sql) {
      await sql`DELETE FROM accounts WHERE id IN (${protectedId},${adminId},${memberId},${targetId})`
      await sql.end()
    }
    delete process.env.ADMIN_DISCORD_IDS
  })

  it('only adopts stored Discord names, including for protected administrators', async () => {
    const listing = await request('/api/admin/accounts', 'GET')
    expect(listing.status).toBe(200)
    expect(listing.data.find((entry: any) => entry.id === protectedId).is_protected).toBe(true)
    expect(listing.data.find((entry: any) => entry.id === adminId).is_protected).toBe(false)
    expect((await request(`/api/admin/accounts/${protectedId}/name`, 'PATCH', { name: 'Arbitrary' })).status).toBe(404)
    expect((await request('/api/accounts/me/name', 'PATCH', { name: 'Arbitrary' }, memberSession)).status).toBe(404)
    await sql`UPDATE account_discord_identities SET display_name='Updated protected' WHERE discord_id=${protectedDiscord}`
    const renamed = await request(`/api/admin/accounts/${protectedId}/adopt-discord-name`, 'POST', { discord_id: protectedDiscord })
    expect(renamed.status).toBe(201)
    expect(renamed.data.name).toBe('Updated protected')
    await sql`UPDATE account_discord_identities SET display_name='My Discord name' WHERE discord_id=${memberDiscord}`
    const mine = await request('/api/accounts/me/adopt-discord-name', 'POST', { discord_id: memberDiscord }, memberSession)
    expect(mine.status).toBe(201)
    expect(mine.data.name).toBe('My Discord name')
    expect((await request('/api/accounts/me/adopt-discord-name', 'POST', { discord_id: adminDiscord }, memberSession)).status).toBe(400)
    expect((await request(`/api/admin/accounts/${adminId}/adopt-discord-name`, 'POST', { discord_id: adminDiscord }, memberSession)).status).toBe(403)
    const placeholder = '981000000000000099'
    await sql`INSERT INTO account_discord_identities(discord_id,account_id,username,display_name) VALUES (${placeholder},${adminId},${placeholder},${placeholder})`
    expect((await request(`/api/admin/accounts/${adminId}/adopt-discord-name`, 'POST', { discord_id: placeholder })).status).toBe(400)
  })

  it('stores multiple unverified JE and BE names without treating them as authenticated identities', async () => {
    const first = await request('/api/accounts/me/minecraft', 'POST', { edition: 'je', username: 'surumeneko164' }, memberSession)
    expect(first.status).toBe(201)
    expect(first.data.minecraft_ids).toHaveLength(1)
    const second = await request('/api/accounts/me/minecraft', 'POST', { edition: 'be', username: 'surumeneko164' }, memberSession)
    expect(second.status).toBe(201)
    expect(second.data.minecraft_ids).toHaveLength(2)
    expect((await request(`/api/admin/accounts/${targetId}/minecraft`, 'POST', { edition: 'je', username: 'surumeneko164' })).status).toBe(409)
    const removed = await request(`/api/accounts/me/minecraft/${first.data.minecraft_ids[0].id}`, 'DELETE', undefined, memberSession)
    expect(removed.status).toBe(200)
    expect(removed.data.minecraft_ids).toHaveLength(1)
  })

  it('rejects protected administrator demotion, deletion and merge-source removal even with another admin', async () => {
    expect((await request(`/api/admin/accounts/${protectedId}/role`, 'PATCH', { is_admin: false })).status).toBe(409)
    expect((await request(`/api/admin/accounts/${protectedId}`, 'DELETE')).status).toBe(409)
    expect((await request('/api/admin/accounts/merge', 'POST', { target_account_id: adminId, source_account_id: protectedId })).status).toBe(409)
    expect((await request(`/api/admin/accounts/${protectedId}/discord/${protectedDiscord}`, 'DELETE')).status).toBe(409)
    expect((await sql`SELECT 1 FROM account_roles WHERE account_id=${protectedId} AND role='admin'`)).toHaveLength(1)
  })

  it('merges a regular source into a protected destination and moves Minecraft names', async () => {
    const merged = await request('/api/admin/accounts/merge', 'POST', { target_account_id: protectedId, source_account_id: memberId })
    expect(merged.status).toBe(201)
    const retained = merged.data.find((entry: any) => entry.id === protectedId)
    expect(retained.discord_ids).toContain(memberDiscord)
    expect(retained.minecraft_ids.some((identity: any) => identity.username === 'surumeneko164')).toBe(true)
    expect(merged.data.some((entry: any) => entry.id === memberId)).toBe(false)
    expect((await request('/api/accounts/me', 'GET', undefined, memberSession)).status).toBe(401)
  })
})
