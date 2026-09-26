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
  const adminId = randomUUID(), memberId = randomUUID(), otherId = randomUUID()
  const adminDiscord = '991000000000000001', memberDiscord = '991000000000000002', otherDiscord = '991000000000000003'
  const adminSession = randomUUID(), memberSession = randomUUID(), otherSession = randomUUID(), csrf = randomUUID()
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

  const samplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XWGhxwAAAABJRU5ErkJggg==', 'base64')
  const uploadImage = async (token = memberSession, mime = 'image/png', bytes = samplePng) => {
    const response = await fetch(`${root}/api/territory-images/file`, {
      method: 'POST',
      headers: {
        Cookie: `xplay_session=${token}; xplay_csrf=${csrf}`,
        Origin: origin,
        'X-XPlay-CSRF': csrf,
        'X-XPlay-Image-Mime': mime,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(bytes),
    })
    return { status: response.status, data: await response.json() as any }
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
      [otherId, 'Territory Recipient', otherDiscord],
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
      (${digest(memberSession)},${memberId},${digest(csrf)},now()+interval '1 hour'),
      (${digest(otherSession)},${otherId},${digest(csrf)},now()+interval '1 hour')`

    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix('api')
    await app.listen(0, '127.0.0.1')
    root = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app?.close()
    if (bot) await new Promise<void>((resolve) => bot.close(() => resolve()))
    if (sql) {
      await sql`DELETE FROM territory_change_history WHERE territory_id IN (
        SELECT id FROM territories WHERE applicant_account_id IN (${adminId},${memberId},${otherId}))`
      await sql`DELETE FROM territories WHERE applicant_account_id IN (${adminId},${memberId},${otherId}) OR owner_account_id IN (${adminId},${memberId},${otherId})`
      await sql`DELETE FROM images WHERE purpose='territory' AND uploaded_by IN (${memberId},${otherId})`
      await sql`DELETE FROM accounts WHERE id IN (${adminId},${memberId},${otherId})`
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

  it('keeps image and metadata revisions separate from boundary review and sends only real renames', async () => {
    const original = [{ x: 1000, z: 1000 }, { x: 1010, z: 1000 }, { x: 1010, z: 1010 }]
    const territoryId = randomUUID()
    const first = await uploadImage()
    expect(first.status).toBe(201)
    expect(first.data.image_id).toMatch(/^[0-9a-f-]{36}$/)
    const wrongMime = await uploadImage(memberSession, 'image/jpeg')
    expect(wrongMime.status).toBe(400)
    const otherImage = await uploadImage(otherSession)
    expect(otherImage.status).toBe(201)
    const foreignImage = await request('/api/territories', 'POST', {
      operation_id: randomUUID(), name: '他人の画像', owner_type: 'account',
      image_id: otherImage.data.image_id, coordinates: original,
    })
    expect(foreignImage.status).toBe(403)
    const created = await request('/api/territories', 'POST', {
      operation_id: territoryId, name: '元の領地', owner_type: 'account',
      image_id: first.data.image_id, coordinates: original,
    })
    expect(created.status).toBe(201)
    expect(created.data.image_id).toBe(first.data.image_id)
    const imageResponse = await fetch(`${root}/api/territory-images/${first.data.image_id}`)
    expect(imageResponse.status).toBe(200)
    expect(imageResponse.headers.get('content-type')).toBe('image/png')
    expect((await imageResponse.arrayBuffer()).byteLength).toBe(samplePng.length)

    const approveId = randomUUID()
    const approved = await request(`/api/admin/territories/${territoryId}/review`, 'POST',
      { operation_id: approveId, action: 'approve' }, adminSession)
    expect(approved.status).toBe(201)
    expect(approved.data.image_id).toBe(first.data.image_id)
    const firstRename = randomUUID(), renameBody = { operation_id: firstRename, name: '改名後' }
    const renamed = await request(`/api/territories/${territoryId}/edit`, 'POST', renameBody)
    expect(renamed.status).toBe(201)
    expect(renamed.data.status).toBe('approved')
    expect(renamed.data.image_id).toBe(first.data.image_id)
    expect(events.filter(e => e.event_id === `${firstRename}:renamed`)).toHaveLength(1)
    expect(events.find(e => e.event_id === `${firstRename}:renamed`)?.previous_name).toBe('元の領地')
    const renameRetry = await request(`/api/territories/${territoryId}/edit`, 'POST', renameBody)
    expect(renameRetry.status).toBe(201)
    expect(events.filter(e => e.event_id === `${firstRename}:renamed`)).toHaveLength(1)
    expect(await sql`SELECT id FROM territory_applications WHERE territory_id=${territoryId}`).toHaveLength(1)

    const secondImage = await uploadImage()
    expect(secondImage.status).toBe(201)
    const imageChange = randomUUID()
    const imageOnly = await request(`/api/territories/${territoryId}/edit`, 'POST', {
      operation_id: imageChange, name: '改名後', image_id: secondImage.data.image_id,
    })
    expect(imageOnly.status).toBe(201)
    expect(imageOnly.data.status).toBe('approved')
    expect(imageOnly.data.image_id).toBe(secondImage.data.image_id)
    expect(events.filter(e => e.event_id === `${imageChange}:renamed`)).toHaveLength(0)
    const history = await sql`SELECT kind,old_name,new_name,old_image_id,new_image_id,actor_account_id
      FROM territory_change_history WHERE operation_id=${imageChange}`
    expect(history).toHaveLength(1)
    expect(history[0].actor_account_id).toBe(memberId)
    expect(history[0].old_image_id).toBe(first.data.image_id)
    expect(history[0].new_image_id).toBe(secondImage.data.image_id)

    const thirdImage = await uploadImage()
    const boundaryId = randomUUID()
    const pending = await request(`/api/territories/${territoryId}/edit`, 'POST', {
      operation_id: boundaryId, name: '未承認名', image_id: thirdImage.data.image_id,
      replacement: { start: 0, end: 1, intermediate: [{ x: 1005, z: 995 }] },
    })
    expect(pending.status).toBe(201)
    expect(pending.data.status).toBe('pending')
    expect(pending.data.approved_image_id).toBe(secondImage.data.image_id)
    expect(pending.data.pending_image_id).toBe(thirdImage.data.image_id)
    expect((await request(`/api/territories/${territoryId}/edit`, 'POST',
      { operation_id: randomUUID(), name: '同時変更' })).status).toBe(409)
    const returned = await request(`/api/admin/territories/${territoryId}/review`, 'POST', {
      operation_id: randomUUID(), action: 'return', reason: '変更後の境界を再確認してください',
    }, adminSession)
    expect(returned.status).toBe(201)
    expect(returned.data.status).toBe('approved')
    expect(returned.data.name).toBe('改名後')
    expect(returned.data.image_id).toBe(secondImage.data.image_id)
    expect(returned.data.approved_image_id).toBe(secondImage.data.image_id)
    expect(returned.data.pending_image_id).toBeNull()

    const lookup = await request('/api/admin/territories/owners?name=Recipient', 'GET', undefined, adminSession)
    expect(lookup.status).toBe(200)
    expect(lookup.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: otherId })]))
    expect((await request('/api/admin/territories/owners?name=Recipient', 'GET')).status).toBe(403)
    const transferOperation = randomUUID()
    const transferBody = { operation_id: transferOperation, owner_type: 'account', owner_account_id: otherId }
    expect((await request(`/api/admin/territories/${territoryId}/owner`, 'POST', transferBody)).status).toBe(403)
    const transferred = await request(`/api/admin/territories/${territoryId}/owner`, 'POST', transferBody, adminSession)
    expect(transferred.status).toBe(201)
    expect(transferred.data.owner.account_id).toBe(otherId)
    expect(transferred.data.applicant.id).toBe(memberId)
    const retriedTransfer = await request(`/api/admin/territories/${territoryId}/owner`, 'POST', transferBody, adminSession)
    expect(retriedTransfer.status).toBe(201)
    const audit = await sql`SELECT old_owner_account_id,new_owner_account_id,new_owner_name,actor_account_id
      FROM territory_change_history WHERE operation_id=${transferOperation}`
    expect(audit).toHaveLength(1)
    expect(audit[0].old_owner_account_id).toBe(memberId)
    expect(audit[0].new_owner_account_id).toBe(otherId)
    expect(audit[0].actor_account_id).toBe(adminId)
    expect(audit[0].new_owner_name).toBe('Territory Recipient')
    expect((await request(`/api/territories/${territoryId}`, 'GET')).data.can_edit).toBe(false)
    expect((await request(`/api/territories/${territoryId}`, 'GET', undefined, otherSession)).data.can_edit).toBe(true)
    expect((await request(`/api/territories/${territoryId}/edit`, 'POST', {
      operation_id: randomUUID(), name: '権限なし',
    })).status).toBe(403)
    const ownerRenameId = randomUUID()
    const ownerRename = await request(`/api/territories/${territoryId}/edit`, 'POST', {
      operation_id: ownerRenameId, name: '新所有者の改名',
    }, otherSession)
    expect(ownerRename.status).toBe(201)
    expect(ownerRename.data.status).toBe('approved')
    expect(events.filter(e => e.event_id === `${ownerRenameId}:renamed`)).toHaveLength(1)
    const pendingByNewOwner = await request(`/api/territories/${territoryId}/edit`, 'POST', {
      operation_id: randomUUID(), name: '新所有者の改名',
      replacement: { start: 0, end: 1, intermediate: [{ x: 1005, z: 995 }] },
    }, otherSession)
    expect(pendingByNewOwner.status).toBe(201)
    expect((await request(`/api/territories/${territoryId}`, 'GET', undefined, otherSession)).data.can_withdraw).toBe(true)
    expect((await request(`/api/territories/${territoryId}`, 'GET')).data.can_withdraw).toBe(false)
    expect((await request(`/api/territories/${territoryId}/withdraw`, 'POST', {
      operation_id: randomUUID(),
    })).status).toBe(403)
    const withdrawn = await request(`/api/territories/${territoryId}/withdraw`, 'POST', {
      operation_id: randomUUID(),
    }, otherSession)
    expect(withdrawn.status).toBe(201)
    expect(withdrawn.data.status).toBe('approved')
    expect(withdrawn.data.name).toBe('新所有者の改名')
    const deleteApplicant = await request(`/api/admin/accounts/${memberId}`, 'DELETE', undefined, adminSession)
    expect(deleteApplicant.status).toBe(409)
    expect(JSON.stringify(deleteApplicant.data)).toContain('申請者履歴')
    const special = await request(`/api/admin/territories/${territoryId}/owner`, 'POST', {
      operation_id: randomUUID(), owner_type: 'shared_area', owner_account_id: null,
    }, adminSession)
    expect(special.status).toBe(201)
    expect(special.data.owner).toMatchObject({ type: 'shared_area', account_id: null, name: '共同建築エリア' })
    expect((await request(`/api/territories/${territoryId}`, 'GET', undefined, otherSession)).data.can_edit).toBe(false)
    expect((await request(`/api/territories/${territoryId}`, 'GET', undefined, adminSession)).data.can_edit).toBe(true)
    const submittedHistory = await request(`/api/admin/accounts/${otherId}`, 'DELETE', undefined, adminSession)
    expect(submittedHistory.status).toBe(409)
    expect(JSON.stringify(submittedHistory.data)).toContain('提出者履歴')
    const beforeTransfer = await request(`/api/admin/accounts/${memberId}/retire`, 'POST', {}, adminSession)
    expect(beforeTransfer.status).toBe(409)
    // The preceding lifecycle test also created a territory owned by this member.
    const remainingOwned = await sql`SELECT id FROM territories WHERE owner_account_id=${memberId}`
    for (const owned of remainingOwned) {
      const moved = await request(`/api/admin/territories/${owned.id}/owner`, 'POST',
        { operation_id: randomUUID(), owner_type: 'shared_area' }, adminSession)
      expect(moved.status).toBe(201)
    }
    const retired = await request(`/api/admin/accounts/${memberId}/retire`, 'POST', {}, adminSession)
    expect(retired.status).toBe(201)
    expect(retired.data).toMatchObject({ id: memberId, retired: true })
    const accountRow = await sql`SELECT name,retired_at FROM accounts WHERE id=${memberId}`
    expect(accountRow[0].name).toBe('退会済みユーザー')
    expect(accountRow[0].retired_at).toBeTruthy()
    expect(await sql`SELECT discord_id FROM account_discord_identities WHERE account_id=${memberId}`).toHaveLength(0)
    expect(await sql`SELECT id FROM account_minecraft_identities WHERE account_id=${memberId}`).toHaveLength(0)
    expect((await request(`/api/territories/${territoryId}`, 'GET')).data.applicant).toEqual({
      id: memberId, name: '退会済みユーザー',
    })
    expect((await request('/api/accounts/me', 'GET')).status).toBe(401)
    expect((await request('/api/admin/territories/owners?name=退会済みユーザー', 'GET', undefined, adminSession)).data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: memberId })]),
    )
  })


  it('stores a public concept independently, keeps reviewer notes private and overwrites them on return', async () => {
    await sql`INSERT INTO account_minecraft_identities(account_id,edition,username)
      VALUES (${adminId},'je',${'territory_' + adminId.slice(0, 6)})`
    const id = randomUUID()
    const coordinates = [{ x: 3000, z: 3000 }, { x: 3200, z: 3000 }, { x: 3200, z: 3200 }]
    const created = await request('/api/territories', 'POST', {
      operation_id: id, name: '構想用領地', owner_type: 'account',
      coordinates, development_concept: '建築案\\n資料館', note: '承認者だけへの連絡',
    }, adminSession)
    expect(created.status).toBe(201)
    expect(created.data.development_concept).toBe('建築案\\n資料館')
    const adminDetail = await request(`/api/territories/${id}`, 'GET', undefined, adminSession)
    expect(adminDetail.data.note).toBe('承認者だけへの連絡')
    expect(adminDetail.data.can_edit_concept).toBe(true)
    const outsider = await request(`/api/territories/${id}`, 'GET', undefined, otherSession)
    expect(outsider.data).not.toHaveProperty('note')
    expect((await request('/api/territories', 'GET', undefined, otherSession)).data
      .find((value: any) => value.id === id)).not.toHaveProperty('note')
    const review = await request(`/api/admin/territories/${id}`, 'GET', undefined, adminSession)
    expect(review.data.note).toBe('承認者だけへの連絡')
    expect(review.data.development_concept).toBe('建築案\\n資料館')
    const notificationsBefore = events.length
    const changed = await request(`/api/territories/${id}/concept`, 'POST', {
      development_concept: '修正版\\n二行目',
    }, adminSession)
    expect(changed.status).toBe(201)
    expect(changed.data.development_concept).toBe('修正版\\n二行目')
    expect(events).toHaveLength(notificationsBefore)
    expect((await request(`/api/territories/${id}/concept`, 'POST', {
      development_concept: '権限外',
    }, otherSession)).status).toBe(403)
    const returned = await request(`/api/admin/territories/${id}/review`, 'POST', {
      operation_id: randomUUID(), action: 'return', reason: '境界を再確認してください',
    }, adminSession)
    expect(returned.status).toBe(201)
    const afterReturn = await request(`/api/territories/${id}`, 'GET', undefined, adminSession)
    expect(afterReturn.data.note).toBe('境界を再確認してください')
    const reapply = await request(`/api/territories/${id}/reapply`, 'POST', {
      operation_id: randomUUID(), name: '構想用領地 再提出',
      owner_type: 'account', coordinates, note: '追記',
    }, adminSession)
    expect(reapply.status).toBe(201)
    expect(reapply.data.development_concept).toBe('修正版\\n二行目')
    expect((await request(`/api/territories/${id}`, 'GET', undefined, adminSession)).data.note).toBe('追記')
    const approved = await request(`/api/admin/territories/${id}/review`, 'POST', {
      operation_id: randomUUID(), action: 'approve',
    }, adminSession)
    expect(approved.status).toBe(201)
    expect((await request(`/api/territories/${id}`, 'GET', undefined, adminSession)).data).not.toHaveProperty('note')
    expect((await sql`SELECT note FROM territory_applications WHERE territory_id=${id} AND status='approved' ORDER BY submitted_at DESC LIMIT 1`)[0].note).toBe('')
  })

  it('enforces the 100,000 pending-area budget, including only positive extension area', async () => {
    const rect = (x: number, z: number, w: number, h: number) => [
      { x, z }, { x: x + w, z }, { x: x + w, z: z + h }, { x, z: z + h },
    ]
    const submit = (id: string, name: string, coordinates: Array<{ x: number; z: number }>) =>
      request('/api/territories', 'POST', {
        operation_id: id, name, owner_type: 'account', coordinates,
      }, adminSession)
    const first = randomUUID(), second = randomUUID(), third = randomUUID()
    expect((await submit(first, '八万', rect(4000, 4000, 200, 400))).status).toBe(201)
    expect((await submit(second, '二万', rect(5000, 5000, 200, 100))).status).toBe(201)
    const exceeded = await submit(third, '上限超過', rect(6000, 6000, 1, 1))
    expect(exceeded.status).toBe(400)
    expect(JSON.stringify(exceeded.data)).toContain('100,000')
    expect((await sql`SELECT id FROM territories WHERE id=${third}`)).toHaveLength(0)
    const inclusive = await request('/api/territories?area_min=20000&area_max=80000', 'GET', undefined, adminSession)
    expect(inclusive.status).toBe(200)
    expect(inclusive.data.map((v: any) => v.id)).toEqual(expect.arrayContaining([first, second]))
    expect((await request('/api/territories?area_min=9&area_max=1', 'GET', undefined, adminSession)).status).toBe(400)
    expect((await request('/api/territories?area_min=oops', 'GET', undefined, adminSession)).status).toBe(400)
    expect((await request(`/api/admin/territories/${first}/review`, 'POST', {
      operation_id: randomUUID(), action: 'return', reason: '再提出',
    }, adminSession)).status).toBe(201)
    expect((await submit(third, '空き枠再利用', rect(6000, 6000, 1, 1))).status).toBe(201)
    expect((await request(`/api/admin/territories/${second}/review`, 'POST', {
      operation_id: randomUUID(), action: 'approve',
    }, adminSession)).status).toBe(201)
    expect((await request(`/api/territories/${third}/withdraw`, 'POST', {
      operation_id: randomUUID(),
    }, adminSession)).status).toBe(201)

    const large = randomUUID()
    expect((await submit(large, '九万の領地', rect(7000, 7000, 300, 300))).status).toBe(201)
    expect((await request(`/api/admin/territories/${large}/review`, 'POST', {
      operation_id: randomUUID(), action: 'approve',
    }, adminSession)).status).toBe(201)
    const extension = await request(`/api/territories/${large}/edit`, 'POST', {
      operation_id: randomUUID(), name: '九万の領地',
      replacement: { start: 0, end: 1, intermediate: [{ x: 7150, z: 6900 }] },
    }, adminSession)
    expect(extension.status).toBe(201)
    expect(extension.data.area).toBe(105000)
    expect(extension.data.status).toBe('pending')
    const tooLarge = await request(`/api/territories/${second}/edit`, 'POST', {
      operation_id: randomUUID(), name: '二万',
      replacement: { start: 0, end: 1, intermediate: [{ x: 5100, z: 4100 }] },
    }, adminSession)
    expect(tooLarge.status).toBe(400)
    expect(JSON.stringify(tooLarge.data)).toContain('100,000')
    expect((await request(`/api/territories/${second}`, 'GET', undefined, adminSession)).data.status).toBe('approved')
    expect((await request('/api/admin/territories?area_min=105000', 'GET', undefined, adminSession)).data
      .some((v: any) => v.id === large)).toBe(true)
  })

})
