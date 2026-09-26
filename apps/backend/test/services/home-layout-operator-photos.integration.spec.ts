import { createHash, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const databaseUrl = process.env.DATABASE_URL
const suite = databaseUrl ? describe : describe.skip
suite('home layout and member photo management (PostgreSQL and HTTP)', () => {
  let sql: ReturnType<typeof postgres>, app: INestApplication, root = ''
  let saved: { revision: number; data: any }, operator: any
  const adminId = randomUUID(), memberId = randomUUID()
  const adminSession = randomUUID(), memberSession = randomUUID(), csrf = randomUUID()
  const digest = (value: string) => createHash('sha256').update(value).digest('hex')
  const auth = (token: string) => ({ Cookie: `xplay_session=${token}; xplay_csrf=${csrf}`, Origin:'http://localhost:3000',
    'X-XPlay-CSRF': csrf })
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle r="7" cx="10" cy="10"/></svg>')
  const imageIds: string[] = []
  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${root}/api${path}`,init)
  }
  function json(path: string, method: string, body: unknown, token = adminSession) {
    return request(path, { method, headers: { ...auth(token), 'Content-Type':'application/json' }, body:JSON.stringify(body) })
  }
  function binary(path: string, token: string, body = svg) {
    return request(path, { method:'POST', headers: {
      ...auth(token), 'Content-Type':'application/octet-stream', 'X-XPlay-Image-Mime':'image/svg+xml',
    },body })
  }
  beforeAll(async () => {
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000'
    sql = postgres(databaseUrl!,{max:2})
    saved = (await sql`SELECT revision,data FROM home_layout WHERE singleton=true`)[0] as any
    operator = (await sql`SELECT * FROM operator_members WHERE member_key='rnad0'`)[0]
    for (const [id, role, token] of [[adminId,true,adminSession],[memberId,false,memberSession]] as const) {
      await sql`INSERT INTO accounts(id,name) VALUES (${id},'portrait-test')`
      await sql`INSERT INTO account_discord_identities(discord_id,account_id) VALUES (${String(randomUUID())},${id})`
      if (role) await sql`INSERT INTO account_roles(account_id,role) VALUES (${id},'admin')`
      await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
        VALUES (${digest(token)},${id},${digest(csrf)},now()+interval '1 hour')`
    }
    await sql`UPDATE operator_members SET account_id=${memberId},merge_origin=NULL WHERE member_key='rnad0'`
    app = await NestFactory.create(AppModule,{logger:false})
    app.setGlobalPrefix('api')
    await app.listen(0,'127.0.0.1')
    root = `http://127.0.0.1:${app.getHttpServer().address().port}`
  })
  afterAll(async () => {
    await app?.close()
    if (!sql) return
    try {
      if (saved) await sql`UPDATE home_layout SET data=${sql.json(saved.data)},revision=${saved.revision}
        WHERE singleton=true`
      if (operator) await sql`UPDATE operator_members SET account_id=${operator.account_id},
        merge_origin=${operator.merge_origin},image_id=${operator.image_id},static_path=${operator.static_path}
        WHERE member_key='rnad0'`
      for (const id of imageIds) await sql`DELETE FROM images WHERE id=${id}`
      await sql`DELETE FROM account_sessions WHERE account_id IN (${adminId},${memberId})`
      await sql`DELETE FROM account_roles WHERE account_id IN (${adminId},${memberId})`
      await sql`DELETE FROM account_discord_identities WHERE account_id IN (${adminId},${memberId})`
      await sql`DELETE FROM accounts WHERE id IN (${adminId},${memberId})`
    } finally { await sql.end() }
  })
  it('migrates all existing home cards and fixed destination links', async () => {
    const response = await request('/home-layout')
    expect(response.status).toBe(200)
    const result = await response.json() as any
    expect(result.data.categories.map((category:any) => category.title)).toEqual(['クイックリンク','サイト案内'])
    expect(result.data.categories.flatMap((category:any) => category.cards)).toHaveLength(5)
    expect(result.data.hubs).toHaveLength(7)
    expect(result.links.map((link:any) => link.url)).toContain('/territories/apply')
    const master = await request('/admin/site-images',{headers:auth(adminSession)})
    expect((await master.json() as any[]).some(image => image.key.startsWith('operator.'))).toBe(false)
  })
  it('rejects unauthenticated, non-admin and CSRF-free layout edits', async () => {
    expect((await request('/admin/home-layout')).status).toBe(401)
    expect((await json('/admin/home-layout','PUT',{revision:1,categories:[],hubs:[]},memberSession)).status).toBe(403)
    const response = await request('/admin/home-layout',{headers:auth(adminSession)})
    expect(response.status).toBe(200)
    const noCsrf = await request('/admin/home-layout',{method:'PUT',
      headers:{Cookie:auth(adminSession).Cookie,Origin:'http://localhost:3000','Content-Type':'application/json'},
      body:JSON.stringify({revision:1,categories:[],hubs:[]})})
    expect(noCsrf.status).toBe(403)
  })
  it('validates links, round-trips ordered home references and refuses stale revisions', async () => {
    const original = await (await request('/home-layout')).json() as any
    const proposed = structuredClone(original.data)
    proposed.categories[0].cards.push({id:'new-link',type:'custom',title:'安全でないリンク',url:'javascript:alert(1)',image:null})
    expect((await json('/admin/home-layout','PUT',{revision:original.revision,...proposed})).status).toBe(400)
    proposed.categories[0].cards.pop()
    proposed.categories.reverse()
    proposed.categories[0].cards.push({id:'new-hub',type:'hub',hub_key:'info.rules',
      title:'変更禁止のタイトル',url:'https://attacker.invalid/'})
    proposed.hubs.reverse()
    const updated = await json('/admin/home-layout','PUT',{revision:original.revision,...proposed})
    expect(updated.status).toBe(200)
    const result = await updated.json() as any
    expect(result.data.categories[0].title).toBe('サイト案内')
    expect(result.data.categories[0].cards.at(-1)).toEqual({id:'new-hub',type:'hub',hub_key:'info.rules'})
    expect(result.data.hubs[0].key).toBe('applications.territories')
    expect((await json('/admin/home-layout','PUT',{revision:original.revision,...proposed})).status).toBe(409)
  })
  it('stores card images independently of image presets', async () => {
    const uploaded = await binary('/admin/home-layout/images/file',adminSession)
    expect(uploaded.status).toBe(201)
    const {image_id:id} = await uploaded.json() as any
    imageIds.push(id)
    const initial = await (await request('/home-layout')).json() as any
    const next = structuredClone(initial.data)
    next.categories[0].cards[0].image = {image_id:id}
    const updated = await json('/admin/home-layout','PUT',{revision:initial.revision,...next})
    expect(updated.status).toBe(200)
    const image = await request(`/home-layout/images/${id}`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-security-policy')).toContain('sandbox')
    expect(await image.text()).toContain('<svg')
    const presets = await (await request('/site-images/manifest')).json() as any
    expect(presets.images['operator.rnad0']).toBeUndefined()
  })
  it('allows only the bound account to change an operator photo', async () => {
    const me = await request('/accounts/me/operator-photos',{headers:auth(memberSession)})
    expect(me.status).toBe(200)
    expect((await me.json() as any[]).map(row=>row.member_key)).toContain('rnad0')
    expect((await binary('/accounts/me/operator-photos/rnad0/file',adminSession)).status).toBe(403)
    const uploaded = await binary('/accounts/me/operator-photos/rnad0/file',memberSession)
    expect(uploaded.status).toBe(201)
    imageIds.push((await uploaded.json() as any).image_id)
    const photo = await request('/operator-photos/rnad0')
    expect(photo.status).toBe(200)
    expect(await photo.text()).toContain('<svg')
    const removed = await request('/accounts/me/operator-photos/rnad0',{method:'DELETE',headers:auth(memberSession)})
    expect(removed.status).toBe(200)
    expect((await request('/operator-photos/rnad0')).status).toBe(404)
  })
})
