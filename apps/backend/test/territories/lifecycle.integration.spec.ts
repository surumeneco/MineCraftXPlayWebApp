import { createHash, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('territory lifecycle (PostgreSQL)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>
  let bot: Server
  let root = ''
  const adminId = randomUUID(), memberId = randomUUID()
  const adminDiscord = '991000000000000001', memberDiscord = '991000000000000002'
  const adminSession = randomUUID(), memberSession = randomUUID(), csrf = randomUUID()
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const origin = 'http://localhost:3000'
  const secret = 'territory-test-secret-'.padEnd(48, 'x')
  const events: any[] = []

  const request = async (path: string, method: string, body?: object, token = memberSession) => {
    const response = await fetch(root + path, {
      method,
      headers: {
        Cookie: `xplay_session=${token}; xplay_csrf=${csrf}`,
        Origin: origin,
        'X-XPlay-CSRF': csrf,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = response.headers.get('content-type')?.includes('json') ? await response.json() as any : null
    return { status: response.status, data }
  }

  beforeAll(async () => {
    bot = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      events.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      res.writeHead(204).end()
    })
    await new Promise<void>((resolve, reject) => {
      bot.once('error', reject)
      bot.listen(0, '127.0.0.1', () => { bot.off('error', reject); resolve() })
    })
    const botPort = (bot.address() as AddressInfo).port
    process.env.FRONTEND_ORIGIN = origin
    process.env.TERRITORY_BOT_URL = `http://127.0.0.1:${botPort}`
    process.env.TERRITORY_NOTIFY_SECRET = secret
    process.env.TERRITORY_PUBLIC_BASE_URL = origin

    sql = postgres(process.env.DATABASE_URL!, { max: 2 })
    for (const [id, name, discord] of [
      [adminId, 'Territory Admin', adminDiscord],
      [memberId, 'Territory Member', memberDiscord],
    ]) {
      await sql`INSERT INTO accounts(id,name) VALUES (${id},${name})`
      await sql`INSERT INTO account_discord_identities(discord_id,account_id,username,display_name)
        VALUES (${discord},${id},${name},${name})`
    }
    await sql`INSERT INTO account_roles(account_id,role) VALUES (${adminId},'admin')`
    await sql`INSERT INTO account_minecraft_identities(account_id,edition,username)
      VALUES (${memberId},'je',${'territory_' + memberId.slice(0, 6)})`
    await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
      VALUES (${digest(adminSession)},${adminId},${digest(csrf)},now()+interval '1 hour'),
      (${digest(memberSession)},${memberId},${digest(csrf)},now()+interval '1 hour')`

    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app?.close()
    if (bot) await new Promise<void>((resolve) => bot.close(() => resolve()))
    if (sql) {
      await sql`DELETE FROM territories WHERE applicant_account_id IN (${adminId},${memberId}) OR owner_account_id IN (${adminId},${memberId})`
      await sql`DELETE FROM accounts WHERE id IN (${adminId},${memberId})`
      await sql.end()
    }
    delete process.env.TERRITORY_BOT_URL
    delete process.env.TERRITORY_NOTIFY_SECRET
    delete process.env.TERRITORY_PUBLIC_BASE_URL
  })

  it('keeps create retries idempotent and restores approved data after a returned edit', async () => {
    const createOperation = randomUUID()
    const original = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }]
    const createBody = {
      operation_id: createOperation,
      name: '海辺',
      owner_type: 'account',
      coordinates: original,
    }
    const created = await request('/api/territories', 'POST', createBody)
    expect(created.status).toBe(201)
    expect(created.data.id).toBe(createOperation)
    expect(events).toHaveLength(1)
    expect(events[0].event_id).toBe(`${createOperation}:application`)

    const retried = await request('/api/territories', 'POST', createBody)
    expect(retried.status).toBe(201)
    expect(retried.data.id).toBe(createOperation)
    expect(events).toHaveLength(1)
    expect(await sql`SELECT id FROM territories WHERE id=${createOperation}`).toHaveLength(1)

    const approveOperation = randomUUID()
    const approved = await request(`/api/admin/territories/${createOperation}/review`, 'POST',
      { operation_id: approveOperation, action: 'approve' }, adminSession)
    expect(approved.status).toBe(201)
    expect(events.at(-1).event_id).toBe(`${approveOperation}:approved`)

    const editOperation = randomUUID()
    const edited = await request(`/api/territories/${createOperation}/edit`, 'POST', {
      operation_id: editOperation,
      name: '海辺拡張',
      replacement: { start: 0, end: 1, intermediate: [{ x: 5, z: -5 }] },
    })
    expect(edited.status).toBe(201)
    expect(events.at(-1).event_id).toBe(`${editOperation}:application`)

    const pending = await request(`/api/territories/${createOperation}`, 'GET')
    expect(pending.status).toBe(200)
    expect(pending.data.status).toBe('pending')
    expect(pending.data.approved_coordinates).toEqual(original)
    expect(pending.data.pending_coordinates).toEqual([
      { x: 0, z: 0 }, { x: 5, z: -5 }, { x: 10, z: 0 }, { x: 10, z: 10 },
    ])

    const returnOperation = randomUUID()
    const returned = await request(`/api/admin/territories/${createOperation}/review`, 'POST',
      { operation_id: returnOperation, action: 'return', reason: '境界を確認してください' }, adminSession)
    expect(returned.status).toBe(201)
    expect(events.at(-1).event_id).toBe(`${returnOperation}:returned`)

    const restored = await request(`/api/territories/${createOperation}`, 'GET')
    expect(restored.status).toBe(200)
    expect(restored.data.status).toBe('approved')
    expect(restored.data.name).toBe('海辺')
    expect(restored.data.coordinates).toEqual(original)
    expect(restored.data.pending_coordinates).toBeNull()
    expect(events).toHaveLength(4)
  })
})
