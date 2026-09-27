import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NestFactory } from '@nestjs/core'
import type { INestApplication } from '@nestjs/common'
import postgres from 'postgres'
import { AppModule } from '../../src/app.module.js'
import { TerritoryService } from '../../src/territory.service.js'
import { TerritoryBlueMapService } from '../../src/territory-bluemap.service.js'
import { area, validateCoordinates } from '../../src/territory-geometry.js'

const SHARED_ID = '6d91fdae-8331-4b4d-858e-000000000001'
const PROTECTED_ID = '6d91fdae-8331-4b4d-858e-000000000002'
const SHARED_APPLICATION = '6d91fdae-8331-4b4d-858e-000000000101'
const PROTECTED_APPLICATION = '6d91fdae-8331-4b4d-858e-000000000102'

const suite = process.env.DATABASE_URL ? describe : describe.skip
suite('fixed BlueMap territory import (PostgreSQL)', () => {
  let app: INestApplication
  let sql: ReturnType<typeof postgres>

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL!, { max: 1 })
    app = await NestFactory.create(AppModule, { logger: false })
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
    await sql?.end()
  })

  it('seeds the two polygons as approved territories without inventing a submitter or approval date', async () => {
    const rows = await sql`
      SELECT t.id,t.owner_type,t.owner_account_id,t.applicant_account_id,t.status,
        t.current_name,t.approved_at,t.first_applied_at,
        a.id AS application_id,a.submitted_by_account_id,a.name,
        a.coordinates,a.status AS application_status,a.decided_at
      FROM territories t JOIN territory_applications a ON a.territory_id=t.id
      WHERE t.id IN (${SHARED_ID},${PROTECTED_ID}) ORDER BY t.id`
    expect(rows).toHaveLength(2)
    const expected = [
      { id: SHARED_ID, application: SHARED_APPLICATION, owner: 'shared_area', name: '第一共同建築エリア', vertices: 76, area: 511649.5 },
      { id: PROTECTED_ID, application: PROTECTED_APPLICATION, owner: 'protected_area', name: 'おおぐま山', vertices: 161, area: 1036533 },
    ]
    for (let i = 0; i < expected.length; i++) {
      const row = rows[i], item = expected[i]
      expect(row).toMatchObject({
        id: item.id, application_id: item.application, owner_type: item.owner,
        owner_account_id: null, applicant_account_id: null, submitted_by_account_id: null,
        status: 'approved', application_status: 'approved',
        current_name: item.name, name: item.name, approved_at: null, decided_at: null,
      })
      expect(row.first_applied_at).toBeTruthy()
      const polygon = validateCoordinates(row.coordinates)
      expect(polygon).toHaveLength(item.vertices)
      expect(area(polygon)).toBe(item.area)
    }
    expect(await sql`SELECT id FROM territory_operations WHERE territory_id IN (${SHARED_ID},${PROTECTED_ID})`).toHaveLength(0)
  })

  it('exposes imported records through the ordinary listing, detail and BlueMap paths', async () => {
    const service = app.get(TerritoryService)
    const list = await service.list({})
    for (const [id, name, owner] of [
      [SHARED_ID, '第一共同建築エリア', '共同建築エリア'],
      [PROTECTED_ID, 'おおぐま山', '保護区'],
    ]) {
      const item = list.find(record => record.id === id)
      expect(item).toMatchObject({ name, owner: { name }, status: 'approved', applicant: { id: null, name: '運営' } })
      // The two seed records remain editable by an administrator, not by an unrelated member.
      expect(await service.get(id, { is_admin: true })).toMatchObject({ can_edit: true })
      expect(await service.get(id, {})).toMatchObject({ can_edit: false, can_reapply: false })
    }
    const generated = await app.get(TerritoryBlueMapService).render()
    expect(generated).toContain(`"${SHARED_ID}-approved"`)
    expect(generated).toContain(`"${PROTECTED_ID}-approved"`)
    expect(generated).toContain('"public-area"')
    expect(generated).toContain('"Reserve"')
  })

  it('keeps null applicants and null submitters unavailable for new records', async () => {
    await expect(sql`INSERT INTO territories(id,applicant_account_id,owner_type,status)
      VALUES (${randomUUID()},NULL,'shared_area','approved')`).rejects.toMatchObject({ code: '23514' })
    await expect(sql`INSERT INTO territory_applications(id,territory_id,application_type,
      submitted_by_account_id,name,coordinates,status)
      VALUES (${randomUUID()},${SHARED_ID},'new',NULL,'not imported','[]'::jsonb,'approved')`)
      .rejects.toMatchObject({ code: '23514' })
  })
})
