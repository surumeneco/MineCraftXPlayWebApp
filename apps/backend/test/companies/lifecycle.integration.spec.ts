import { createHash, randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'

const suite=process.env.DATABASE_URL?describe:describe.skip
suite('company lifecycle and company-owned territory (PostgreSQL)',()=>{
  let app:INestApplication,bot:Server,sql:ReturnType<typeof postgres>,root=''
  const admin=randomUUID(),member=randomUUID(),other=randomUUID()
  const session={admin:randomUUID(),member:randomUUID(),other:randomUUID()}
  const discord=['992000000000000001','992000000000000002','992000000000000003']
  const csrf=randomUUID(),origin='http://localhost:3000'
  const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
  const sent:Array<{path:string;body:any}>=[]
  const territoryIds:string[]=[],companyIds:string[]=[]
  const req=async(path:string,method:'GET'|'POST'='GET',body?:any,token:string|null=session.member)=>{
    const resp=await fetch(root+path,{method,headers:{'Content-Type':'application/json',Origin:origin,'X-XPlay-CSRF':csrf,
      ...(token?{Cookie:`xplay_session=${token}; xplay_csrf=${csrf}`}:{})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {status:resp.status,body:resp.headers.get('content-type')?.includes('json')?await resp.json() as any:null}
  }
  const territory=async(owner:'account'|'shared_area'|'administration'|'protected_area',ownerId:string|null,name:string)=>{
    const id=randomUUID();territoryIds.push(id)
    await sql`INSERT INTO territories(id,applicant_account_id,owner_type,owner_account_id,status,current_name,approved_at)
      VALUES (${id},${admin},${owner},${ownerId},'approved',${name},now())`
    await sql`INSERT INTO territory_applications(territory_id,application_type,submitted_by_account_id,
      name,coordinates,status,decided_at)
      VALUES (${id},'new',${admin},${name},${sql.json([{x:40000,z:40000},{x:40001,z:40000},{x:40001,z:40001}])},'approved',now())`
    return id
  }
  let ownHQ='',sharedHQ='',publicCompany=''
  beforeAll(async()=>{
    bot=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));
      sent.push({path:req.url??'',body:JSON.parse(Buffer.concat(chunks).toString('utf8'))});res.writeHead(204).end()})
    await new Promise<void>((resolve,reject)=>{bot.once('error',reject);bot.listen(0,'127.0.0.1',()=>{bot.off('error',reject);resolve()})})
    process.env.FRONTEND_ORIGIN=origin;process.env.TERRITORY_BOT_URL=`http://127.0.0.1:${(bot.address() as AddressInfo).port}`;
    process.env.TERRITORY_NOTIFY_SECRET='company-test-secret';process.env.TERRITORY_PUBLIC_BASE_URL=origin
    sql=postgres(process.env.DATABASE_URL!,{max:2})
    for(const [id,name,dId,token] of [[admin,'企業テスト管理者',discord[0],session.admin],[member,'企業テスト代表者',discord[1],session.member],[other,'企業テスト所属者',discord[2],session.other]]){
      await sql`INSERT INTO accounts(id,name) VALUES (${id},${name})`
      await sql`INSERT INTO account_discord_identities(discord_id,account_id,username,display_name)
        VALUES (${dId},${id},${name},${name})`
      await sql`INSERT INTO account_sessions(token_hash,account_id,csrf_hash,expires_at)
        VALUES (${hash(token)},${id},${hash(csrf)},now()+interval '2 hours')`
    }
    await sql`INSERT INTO account_roles(account_id,role) VALUES (${admin},'admin')`
    await sql`INSERT INTO account_minecraft_identities(account_id,edition,username)
      VALUES (${member},'je',${'comp_'+member.slice(0,6)}),(${member},'be',${'comp_'+member.slice(0,7)}),(${admin},'je',${'comp_'+admin.slice(0,7)})`
    ownHQ=await territory('account',member,'企業テスト代表者領地')
    sharedHQ=await territory('shared_area',null,'企業テスト共同建築')
    app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1')
    root=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })
  afterAll(async()=>{
    await app?.close();if(bot)await new Promise<void>(resolve=>bot.close(()=>resolve()))
    if(sql){
      for(const id of territoryIds.slice(2).reverse())await sql`DELETE FROM territories WHERE id=${id}`
      for(const id of companyIds)await sql`DELETE FROM companies WHERE id=${id}`
      for(const id of territoryIds.slice(0,2).reverse())await sql`DELETE FROM territories WHERE id=${id}`
      await sql`DELETE FROM images WHERE purpose='company' AND uploaded_by IN (${admin},${member},${other})`
      await sql`DELETE FROM account_roles WHERE account_id IN (${admin},${member},${other})`
      await sql`DELETE FROM accounts WHERE id IN (${admin},${member},${other})`
      await sql.end()
    }
    delete process.env.TERRITORY_BOT_URL;delete process.env.TERRITORY_NOTIFY_SECRET;delete process.env.TERRITORY_PUBLIC_BASE_URL
  })
  const createBody=(id:string,name='企業テスト株式会社')=>({operation_id:id,name,tags:['建築','インフラ'],
    activities:'道路を敷設します',member_account_ids:[other],headquarters_territory_id:ownHQ,
    introduction_delta:{ops:[{insert:'企業紹介\n'}]}})
  it('requires members, approved eligible HQ and nonadmin representative restrictions',async()=>{
    expect((await req('/api/companies','POST',{...createBody(randomUUID()),member_account_ids:[]})).status).toBe(400)
    expect((await req('/api/companies','POST',{...createBody(randomUUID()),headquarters_territory_id:randomUUID()})).status).toBe(400)
    expect((await req('/api/companies','POST',{...createBody(randomUUID()),representative_account_id:other})).status).toBe(403)
    expect((await req('/api/companies','POST',{...createBody(randomUUID()),is_public:true})).status).toBe(403)
    expect((await req('/api/companies','POST',{...createBody(randomUUID()),tags:['無効']})).status).toBe(400)
  })
  it('hides initial pending applications, approves idempotently, and displays MC IDs',async()=>{
    const id=randomUUID();companyIds.push(id)
    const before=sent.length
    const created=await req('/api/companies','POST',createBody(id))
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({id,name:'企業テスト株式会社',status:'pending'})
    expect(sent).toHaveLength(before+1)
    expect(sent.at(-1)?.path).toBe('/internal/companies')
    expect(sent.at(-1)?.body.event_id).toBe(`company:${id}:application`)
    const retry=await req('/api/companies','POST',createBody(id))
    expect(retry.status).toBe(201);expect(sent).toHaveLength(before+1)
    expect((await req('/api/companies','GET',undefined,null)).body).not.toEqual(expect.arrayContaining([expect.objectContaining({id})]))
    expect((await req('/api/companies','GET',undefined,session.other)).body).not.toEqual(expect.arrayContaining([expect.objectContaining({id})]))
    expect((await req('/api/companies')).body).toEqual(expect.arrayContaining([expect.objectContaining({id})]))
    expect((await req(`/api/companies/${id}`,'GET',undefined,session.other)).status).toBe(404)
    expect((await req(`/api/admin/companies/${id}/review`,'GET',undefined,session.other)).status).toBe(403)
    expect((await req('/api/admin/companies','GET',undefined,session.admin)).body).toEqual(expect.arrayContaining([expect.objectContaining({id})]))
    const approved=await req(`/api/admin/companies/${id}/review`,'POST',{operation_id:randomUUID(),action:'approve'},session.admin)
    expect(approved.status).toBe(201)
    expect(approved.body.status).toBe('approved')
    const visible=await req(`/api/companies/${id}`,'GET',undefined,null)
    expect(visible.status).toBe(200)
    expect(visible.body.representative.minecraft_ids).toEqual(expect.arrayContaining([expect.objectContaining({edition:'je'}),expect.objectContaining({edition:'be'})]))
    expect((await req('/api/companies?tag=建築&account=所属者&headquarters=代表者領地&sort=name','GET',undefined,null)).body).toEqual(expect.arrayContaining([expect.objectContaining({id})]))
    const accounts=await req('/api/companies/accounts?name=所属','GET',undefined,session.member)
    expect(accounts.body).toEqual(expect.arrayContaining([expect.objectContaining({id:other})]))
    const hqs=await req('/api/companies/headquarters?mode=edit&company_id='+id)
    expect(hqs.body).toEqual(expect.arrayContaining([expect.objectContaining({id:ownHQ})]))
  })
  it('isolates reviewed edits from public current values, including returned changes',async()=>{
    const id=companyIds[0]
    const edit=await req(`/api/companies/${id}/edit`,'POST',{
      operation_id:randomUUID(),name:'変更申請中企業',tags:['資材'],activities:'物資供給',
      representative_account_id:member,headquarters_territory_id:sharedHQ})
    expect(edit.status).toBe(201)
    expect(edit.body).toMatchObject({name:'変更申請中企業',status:'pending'})
    const publicBefore=await req(`/api/companies/${id}`,'GET',undefined,null)
    expect(publicBefore.body).toMatchObject({name:'企業テスト株式会社',status:'approved'})
    expect((await req(`/api/companies/${id}/edit`,'POST',{operation_id:randomUUID(),name:'重複'})).status).toBe(409)
    const returning=await req(`/api/admin/companies/${id}/review`,'POST',
      {operation_id:randomUUID(),action:'return',reason:'活動内容を確認してください'},session.admin)
    expect(returning.status).toBe(201)
    expect((await req(`/api/companies/${id}`,'GET',undefined,null)).body.name).toBe('企業テスト株式会社')
    expect(sent.at(-1)?.body.reason).toBe('活動内容を確認してください')
    const second=await req(`/api/companies/${id}/edit`,'POST',{
      operation_id:randomUUID(),name:'承認後企業',tags:['回路'],activities:'回路建築',representative_account_id:member,
      headquarters_territory_id:sharedHQ})
    expect(second.status).toBe(201)
    expect((await req(`/api/admin/companies/${id}/review`,'POST',
      {operation_id:randomUUID(),action:'approve'},session.admin)).status).toBe(201)
    expect((await req(`/api/companies/${id}`,'GET',undefined,null)).body).toMatchObject({name:'承認後企業',tags:['回路'],activities:'回路建築'})
    expect((await req('/api/companies?name=承認後','GET',undefined,null)).body).toEqual(expect.arrayContaining([expect.objectContaining({id})]))
  })
  it('includes private company territory applications in representative area limit',async()=>{
    const companyId=companyIds[0]
    expect((await req('/api/companies/territory-owners')).body).toEqual(expect.arrayContaining([expect.objectContaining({id:companyId,is_public:false})]))
    expect((await req('/api/companies/territory-owners','GET',undefined,session.other)).body).not.toEqual(expect.arrayContaining([expect.objectContaining({id:companyId})]))
    const firstId=randomUUID();territoryIds.push(firstId)
    const first=await req('/api/territories','POST',{
      operation_id:firstId,name:'企業名義の試験領地',owner_type:'company',owner_company_id:companyId,
      coordinates:[{x:10000,z:10000},{x:10600,z:10000},{x:10600,z:10300}],
    })
    expect(first.status).toBe(201)
    expect(first.body.owner).toMatchObject({type:'company',company_id:companyId,name:'承認後企業'})
    const failed=await req('/api/territories','POST',{
      operation_id:randomUUID(),name:'上限超過の個人申請',owner_type:'account',
      coordinates:[{x:20000,z:20000},{x:20100,z:20000},{x:20100,z:20210}],
    })
    expect(failed.status).toBe(400)
    expect(JSON.stringify(failed.body)).toContain('100,000')
  })
  it('allows public company applications only for administrators and excludes them from area limit',async()=>{
    const publicId=randomUUID();companyIds.push(publicId)
    const created=await req('/api/companies','POST',{
      ...createBody(publicId,'公営企業テスト'),headquarters_territory_id:sharedHQ,
      representative_account_id:admin,is_public:true,member_account_ids:[member],
    },session.admin)
    expect(created.status).toBe(201)
    expect((await req(`/api/admin/companies/${publicId}/review`,'POST',
      {operation_id:randomUUID(),action:'approve'},session.admin)).status).toBe(201)
    publicCompany=publicId
    expect((await req('/api/companies/territory-owners','GET',undefined,session.admin)).body).toEqual(expect.arrayContaining([expect.objectContaining({id:publicCompany,is_public:true})]))
    expect((await req('/api/companies/territory-owners','GET',undefined,session.other)).body).not.toEqual(expect.arrayContaining([expect.objectContaining({id:publicCompany})]))
    const territoryId=randomUUID();territoryIds.push(territoryId)
    const createdTerritory=await req('/api/territories','POST',{
      operation_id:territoryId,name:'公営企業テスト領地',owner_type:'company',owner_company_id:publicCompany,
      coordinates:[{x:30000,z:30000},{x:31000,z:30000},{x:31000,z:31000}],
    },session.admin)
    expect(createdTerritory.status).toBe(201)
    expect((await req('/api/territories','POST',{
      operation_id:randomUUID(),name:'他人の公営企業の領地',owner_type:'company',owner_company_id:publicCompany,
      coordinates:[{x:35000,z:35000},{x:35100,z:35000},{x:35100,z:35100}],
    },session.other)).status).toBe(403)
  })
})
