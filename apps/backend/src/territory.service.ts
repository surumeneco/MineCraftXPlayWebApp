import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'
import { area, centroid, pointInPolygon, polygonDistance, polygonsOverlapArea, replaceBoundarySegment, validateCoordinates, type Point } from './territory-geometry.js'
import { TerritoryNotificationService, type TerritoryNotificationEvent } from './territory-notification.service.js'

export type TerritoryStatus = 'pending' | 'approved' | 'returned' | 'withdrawn' | 'rejected'
export type OwnerType = 'account' | 'shared_area' | 'administration' | 'protected_area'
type ApplicationType = 'new' | 'edit'
type OperationKind = 'create' | 'reapply' | 'edit' | 'withdraw' | 'approve' | 'return' | 'reject'
type ApplicationData = {
  id: string
  application_type: ApplicationType
  name: string
  coordinates: Point[]
  status: TerritoryStatus
  submitted_at: string
  decided_at: string | null
  reason: string | null
}
type TerritoryRow = {
  id: string
  applicant_account_id: string
  applicant_name: string
  owner_type: OwnerType
  owner_account_id: string | null
  owner_account_name: string | null
  status: TerritoryStatus
  first_applied_at: string
  approved_at: string | null
  status_changed_at: string
  approved_application: ApplicationData | null
  pending_application: ApplicationData | null
  latest_application: ApplicationData | null
}

const specialOwnerNames: Record<Exclude<OwnerType, 'account'>, string> = {
  shared_area: '共同建築エリア',
  administration: '運営',
  protected_area: '保護区',
}
const statusRank: Record<TerritoryStatus, number> = { approved: 0, pending: 1, returned: 2, withdrawn: 3, rejected: 4 }

function territoryName(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('Territory name is required')
  const name = value.trim()
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) throw new BadRequestException('Territory name must contain 1 to 100 characters')
  return name
}
function ownerType(value: unknown): OwnerType {
  if (!['account','shared_area','administration','protected_area'].includes(String(value))) throw new BadRequestException('Invalid territory owner')
  return value as OwnerType
}
function reason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Review reason is required')
  return value.trim()
}
function samePoints(a: Point[], b: Point[]): boolean {
  return a.length === b.length && a.every((point, index) => point.x === b[index].x && point.z === b[index].z)
}

@Injectable()
export class TerritoryService {
  constructor(private readonly database: Database, private readonly notifications: TerritoryNotificationService) {}

  private async rows(sql: any = this.database.sql): Promise<TerritoryRow[]> {
    return await sql`
      SELECT t.id,t.applicant_account_id,applicant.name AS applicant_name,t.owner_type,t.owner_account_id,
        owner.name AS owner_account_name,t.status,t.first_applied_at,t.approved_at,t.status_changed_at,
        (SELECT json_build_object('id',a.id,'application_type',a.application_type,'name',a.name,
          'coordinates',a.coordinates,'status',a.status,'submitted_at',a.submitted_at,'decided_at',a.decided_at,'reason',a.reason)
          FROM territory_applications a WHERE a.territory_id=t.id AND a.status='approved'
          ORDER BY a.decided_at DESC NULLS LAST,a.submitted_at DESC,a.id DESC LIMIT 1) AS approved_application,
        (SELECT json_build_object('id',a.id,'application_type',a.application_type,'name',a.name,
          'coordinates',a.coordinates,'status',a.status,'submitted_at',a.submitted_at,'decided_at',a.decided_at,'reason',a.reason)
          FROM territory_applications a WHERE a.territory_id=t.id AND a.status='pending'
          ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1) AS pending_application,
        (SELECT json_build_object('id',a.id,'application_type',a.application_type,'name',a.name,
          'coordinates',a.coordinates,'status',a.status,'submitted_at',a.submitted_at,'decided_at',a.decided_at,'reason',a.reason)
          FROM territory_applications a WHERE a.territory_id=t.id
          ORDER BY a.submitted_at DESC,a.id DESC LIMIT 1) AS latest_application
      FROM territories t
      JOIN accounts applicant ON applicant.id=t.applicant_account_id
      LEFT JOIN accounts owner ON owner.id=t.owner_account_id
      ORDER BY t.first_applied_at,t.id` as unknown as TerritoryRow[]
  }

  private displayApp(row: TerritoryRow): ApplicationData {
    const app = row.pending_application ?? row.approved_application ?? row.latest_application
    if (!app) throw new NotFoundException('Territory application not found')
    return app
  }

  private ownerName(row: TerritoryRow): string {
    return row.owner_type === 'account' ? row.owner_account_name ?? '不明' : specialOwnerNames[row.owner_type]
  }

  private dto(row: TerritoryRow) {
    const app = this.displayApp(row), coordinates = app.coordinates
    return {
      id: row.id,
      name: app.name,
      applicant: { id: row.applicant_account_id, name: row.applicant_name },
      owner: { type: row.owner_type, account_id: row.owner_account_id, name: this.ownerName(row) },
      status: row.status,
      applied_at: row.first_applied_at,
      approved_at: row.approved_at,
      changed_at: row.status_changed_at,
      coordinates,
      area: area(coordinates),
      centroid: centroid(coordinates),
      application_type: app.application_type,
      reason: app.reason,
      approved_coordinates: row.approved_application?.coordinates ?? null,
      pending_coordinates: row.pending_application?.coordinates ?? null,
    }
  }

  async list(viewer: { account_id?: string; is_admin?: boolean }, query: Record<string, unknown> = {}) {
    let values = (await this.rows()).filter(row => viewer.is_admin || row.status !== 'rejected').map(row => this.dto(row))
    const name = typeof query.name === 'string' ? query.name.trim().toLocaleLowerCase('ja') : ''
    const owner = typeof query.owner === 'string' ? query.owner.trim().toLocaleLowerCase('ja') : ''
    if (name) values = values.filter(value => value.name.toLocaleLowerCase('ja').includes(name))
    if (owner) values = values.filter(value => value.owner.name.toLocaleLowerCase('ja').includes(owner))
    if (query.status) {
      if (!Object.hasOwn(statusRank, String(query.status))) throw new BadRequestException('Invalid territory status')
      values = values.filter(value => value.status === query.status)
    }
    if (query.x !== undefined || query.z !== undefined) {
      const x = Number(query.x), z = Number(query.z)
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) throw new BadRequestException('Coordinate search requires integer x and z')
      values = values.filter(value => pointInPolygon({ x, z }, value.coordinates, true))
    }
    const sort = ['applied_at','approved_at','changed_at','name','owner'].includes(String(query.sort)) ? String(query.sort) : 'approved_at'
    values.sort((a, b) => {
      const status = statusRank[a.status] - statusRank[b.status]
      if (status) return status
      const av = sort === 'owner' ? a.owner.name : (a as any)[sort]
      const bv = sort === 'owner' ? b.owner.name : (b as any)[sort]
      if (av == null && bv == null) return a.name.localeCompare(b.name, 'ja')
      if (av == null) return 1
      if (bv == null) return -1
      if (sort === 'name' || sort === 'owner') return String(av).localeCompare(String(bv), 'ja')
      return new Date(String(bv)).getTime() - new Date(String(av)).getTime()
    })
    return values
  }

  async get(idRaw: unknown, viewer: { account_id?: string; is_admin?: boolean }) {
    const id = uuid(idRaw), row = (await this.rows()).find(value => value.id === id)
    if (!row || (row.status === 'rejected' && !viewer.is_admin)) throw new NotFoundException('Territory not found')
    const value = this.dto(row)
    const canEdit = row.status === 'approved' && (viewer.is_admin === true
      || (viewer.account_id === row.applicant_account_id && row.owner_type === 'account' && row.owner_account_id === row.applicant_account_id))
    const canReapply = viewer.account_id === row.applicant_account_id && ['returned','withdrawn'].includes(row.status)
    const canWithdraw = viewer.account_id === row.applicant_account_id && row.status === 'pending'
    return { ...value, can_edit: canEdit, can_reapply: canReapply, can_withdraw: canWithdraw,
      nearby: await this.nearby(id, value.coordinates) }
  }

  private async assertMinecraft(accountId: string, sql: any = this.database.sql) {
    const rows = await sql`SELECT 1 FROM account_minecraft_identities WHERE account_id=${accountId} LIMIT 1`
    if (!rows.length) throw new ConflictException('Link a Minecraft ID before applying for territory')
  }

  private resolveOwner(typeRaw: unknown, applicant: string, isAdmin: boolean) {
    const type = ownerType(typeRaw ?? 'account')
    if (type !== 'account' && !isAdmin) throw new ForbiddenException('Only administrators can choose special territory owners')
    return { type, accountId: type === 'account' ? applicant : null }
  }

  private async completedOperation(tx: any, operationId: string, territoryId: string, kind: OperationKind, actorAccountId: string) {
    const rows = await tx`SELECT territory_id,actor_account_id,operation_kind FROM territory_operations WHERE operation_id=${operationId}`
    if (!rows.length) return null
    if (String(rows[0].territory_id) !== territoryId || String(rows[0].actor_account_id ?? '') !== actorAccountId
      || rows[0].operation_kind !== kind) {
      throw new ConflictException('Territory operation ID was already used')
    }
    return this.getFromRows(await this.rows(tx), territoryId)
  }

  private async completeOperation(tx: any, operationId: string, territoryId: string, kind: OperationKind, actorAccountId: string) {
    await tx`INSERT INTO territory_operations(operation_id,territory_id,actor_account_id,operation_kind)
      VALUES (${operationId},${territoryId},${actorAccountId},${kind})`
  }

  async create(accountId: string, isAdmin: boolean, body: any) {
    const operationId = uuid(body?.operation_id)
    const name = territoryName(body?.name), coordinates = validateCoordinates(body?.coordinates)
    const owner = this.resolveOwner(body?.owner_type, accountId, isAdmin)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const completed = await this.completedOperation(tx, operationId, operationId, 'create', accountId)
      if (completed) return completed
      await this.assertMinecraft(accountId, tx)
      const territories = await tx`INSERT INTO territories(id,applicant_account_id,owner_type,owner_account_id,status)
        VALUES (${operationId},${accountId},${owner.type},${owner.accountId},'pending') RETURNING id`
      const id = String(territories[0].id)
      await tx`INSERT INTO territory_applications(territory_id,application_type,submitted_by_account_id,name,coordinates,status)
        VALUES (${id},'new',${accountId},${name},${tx.json(coordinates)},'pending')`
      await this.notify(tx, operationId, id, 'application', 'new', coordinates, name)
      await this.completeOperation(tx, operationId, id, 'create', accountId)
      return this.getFromRows(await this.rows(tx), id)
    })
  }

  async reapply(accountId: string, isAdmin: boolean, idRaw: unknown, body: any) {
    const id = uuid(idRaw), operationId = uuid(body?.operation_id)
    const name = territoryName(body?.name), coordinates = validateCoordinates(body?.coordinates)
    const owner = this.resolveOwner(body?.owner_type, accountId, isAdmin)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const completed = await this.completedOperation(tx, operationId, id, 'reapply', accountId)
      if (completed) return completed
      const locked = await tx`SELECT applicant_account_id,status,owner_type,owner_account_id FROM territories WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('Territory not found')
      if (String(locked[0].applicant_account_id) !== accountId) throw new ForbiddenException('Only the applicant can reapply')
      if (!['returned','withdrawn'].includes(String(locked[0].status))) throw new ConflictException('Territory is not available for reapplication')
      await this.assertMinecraft(accountId, tx)
      const previous = await tx`SELECT name,coordinates FROM territory_applications WHERE territory_id=${id}
        ORDER BY submitted_at DESC,id DESC LIMIT 1`
      if (previous.length && previous[0].name === name && samePoints(previous[0].coordinates as Point[], coordinates)
        && String(locked[0].owner_type) === owner.type && String(locked[0].owner_account_id ?? '') === String(owner.accountId ?? '')) {
        throw new BadRequestException('Change at least one field before reapplying')
      }
      await tx`UPDATE territories SET owner_type=${owner.type},owner_account_id=${owner.accountId},
        status='pending',status_changed_at=clock_timestamp() WHERE id=${id}`
      await tx`INSERT INTO territory_applications(territory_id,application_type,submitted_by_account_id,name,coordinates,status)
        VALUES (${id},'new',${accountId},${name},${tx.json(coordinates)},'pending')`
      await this.notify(tx, operationId, id, 'application', 'new', coordinates, name)
      await this.completeOperation(tx, operationId, id, 'reapply', accountId)
      return this.getFromRows(await this.rows(tx), id)
    })
  }

  async edit(accountId: string, isAdmin: boolean, idRaw: unknown, body: any) {
    const id = uuid(idRaw), operationId = uuid(body?.operation_id), name = territoryName(body?.name)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const completed = await this.completedOperation(tx, operationId, id, 'edit', accountId)
      if (completed) return completed
      const locked = await tx`SELECT applicant_account_id,owner_type,owner_account_id,status FROM territories WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('Territory not found')
      const row = locked[0]
      const selfOwned = String(row.applicant_account_id) === accountId && row.owner_type === 'account'
        && String(row.owner_account_id) === accountId
      if (!isAdmin && !selfOwned) throw new ForbiddenException('Territory cannot be edited by this account')
      if (row.status !== 'approved') throw new ConflictException('Only approved territory can be edited')
      const approved = await tx`SELECT name,coordinates FROM territory_applications WHERE territory_id=${id} AND status='approved'
        ORDER BY decided_at DESC NULLS LAST,submitted_at DESC,id DESC LIMIT 1`
      if (!approved.length) throw new ConflictException('Approved territory data is missing')
      const approvedCoordinates = approved[0].coordinates as Point[]
      const coordinates = replaceBoundarySegment(approvedCoordinates, body?.replacement)
      if (approved[0].name === name && samePoints(approvedCoordinates, coordinates)) {
        throw new BadRequestException('Change the territory before submitting an edit')
      }
      await tx`INSERT INTO territory_applications(territory_id,application_type,submitted_by_account_id,name,coordinates,status)
        VALUES (${id},'edit',${accountId},${name},${tx.json(coordinates)},'pending')`
      await tx`UPDATE territories SET status='pending',status_changed_at=clock_timestamp() WHERE id=${id}`
      await this.notify(tx, operationId, id, 'application', 'edit', coordinates, name)
      await this.completeOperation(tx, operationId, id, 'edit', accountId)
      return this.getFromRows(await this.rows(tx), id)
    })
  }

  async withdraw(accountId: string, idRaw: unknown, operationRaw: unknown) {
    const id = uuid(idRaw), operationId = uuid(operationRaw)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const completed = await this.completedOperation(tx, operationId, id, 'withdraw', accountId)
      if (completed) return completed
      const locked = await tx`SELECT applicant_account_id,status FROM territories WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('Territory not found')
      if (String(locked[0].applicant_account_id) !== accountId) throw new ForbiddenException('Only the applicant can withdraw')
      if (locked[0].status !== 'pending') throw new ConflictException('Only pending territory can be withdrawn')
      const apps = await tx`SELECT id,application_type,name,coordinates FROM territory_applications
        WHERE territory_id=${id} AND status='pending' ORDER BY submitted_at DESC,id DESC LIMIT 1 FOR UPDATE`
      if (!apps.length) throw new ConflictException('Pending application not found')
      const app = apps[0]
      const previousApproved = await tx`SELECT 1 FROM territory_applications WHERE territory_id=${id} AND status='approved' LIMIT 1`
      await tx`UPDATE territory_applications SET status='withdrawn',decided_at=clock_timestamp() WHERE id=${app.id}`
      const nextStatus = previousApproved.length ? 'approved' : 'withdrawn'
      await tx`UPDATE territories SET status=${nextStatus},status_changed_at=clock_timestamp() WHERE id=${id}`
      await this.notify(tx, operationId, id, 'withdrawn', app.application_type as ApplicationType,
        app.coordinates as Point[], String(app.name))
      await this.completeOperation(tx, operationId, id, 'withdraw', accountId)
      return this.getFromRows(await this.rows(tx), id)
    })
  }

  async review(idRaw: unknown, actionRaw: unknown, reasonRaw: unknown, operationRaw: unknown, reviewerAccountId: string) {
    const id = uuid(idRaw), operationId = uuid(operationRaw)
    if (!['approve','return','reject'].includes(String(actionRaw))) throw new BadRequestException('Invalid review action')
    const action = String(actionRaw) as 'approve' | 'return' | 'reject'
    const reviewReason = action === 'approve' ? null : reason(reasonRaw)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const completed = await this.completedOperation(tx, operationId, id, action, reviewerAccountId)
      if (completed) return completed
      const locked = await tx`SELECT status FROM territories WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('Territory not found')
      if (locked[0].status !== 'pending') throw new ConflictException('Territory is not pending')
      const apps = await tx`SELECT id,application_type,name,coordinates FROM territory_applications
        WHERE territory_id=${id} AND status='pending' ORDER BY submitted_at DESC,id DESC LIMIT 1 FOR UPDATE`
      if (!apps.length) throw new ConflictException('Pending application not found')
      const app = apps[0], appId = String(app.id), applicationType = app.application_type as ApplicationType
      const overlapsAtReview = this.overlaps(await this.rows(tx), id, app.coordinates as Point[])
      if (action === 'approve') {
        await tx`UPDATE territory_applications SET status='approved',decided_at=clock_timestamp(),reason=NULL WHERE id=${appId}`
        await tx`UPDATE territories SET status='approved',approved_at=clock_timestamp(),status_changed_at=clock_timestamp() WHERE id=${id}`
        await this.notify(tx, operationId, id, 'approved', applicationType, app.coordinates as Point[], String(app.name))
      } else {
        const status = action === 'return' ? 'returned' : 'rejected'
        await tx`UPDATE territory_applications SET status=${status},decided_at=clock_timestamp(),reason=${reviewReason} WHERE id=${appId}`
        const previousApproved = await tx`SELECT 1 FROM territory_applications WHERE territory_id=${id} AND status='approved' LIMIT 1`
        const nextStatus = previousApproved.length ? 'approved' : status
        await tx`UPDATE territories SET status=${nextStatus},status_changed_at=clock_timestamp() WHERE id=${id}`
        await this.notify(tx, operationId, id, status, applicationType, app.coordinates as Point[], String(app.name), reviewReason ?? undefined)
      }
      await this.completeOperation(tx, operationId, id, action, reviewerAccountId)
      return { ...this.getFromRows(await this.rows(tx), id), overlaps_at_review: overlapsAtReview }
    })
  }

  async pendingForAdmin(query: Record<string, unknown> = {}) {
    return (await this.list({ is_admin: true }, { ...query, status: 'pending' })).filter(value => value.status === 'pending')
  }

  async reviewDetail(idRaw: unknown) {
    const id = uuid(idRaw), rows = await this.rows(), row = rows.find(value => value.id === id)
    if (!row || row.status !== 'pending' || !row.pending_application) throw new NotFoundException('Pending territory not found')
    const current = this.dto(row), overlaps = this.overlaps(rows, id, current.coordinates)
    const others = rows.filter(value => value.id !== id && value.applicant_account_id === row.applicant_account_id).map(value => this.dto(value))
    return { ...current, overlaps, applicant_other_territories: others }
  }

  private overlaps(rows: TerritoryRow[], id: string, candidate: Point[]) {
    const approved: any[] = [], pending: any[] = []
    for (const row of rows) {
      if (row.id === id) continue
      if (row.approved_application && polygonsOverlapArea(candidate, row.approved_application.coordinates)) {
        approved.push({ id: row.id, name: row.approved_application.name })
      }
      if (row.pending_application && polygonsOverlapArea(candidate, row.pending_application.coordinates)) {
        pending.push({ id: row.id, name: row.pending_application.name })
      }
    }
    return { approved, pending }
  }

  async nearby(id: string, candidate: Point[], sql: any = this.database.sql) {
    const rows = await this.rows(sql), values: Array<{ id: string; name: string }> = []
    for (const row of rows) {
      if (row.id === id || !['pending','approved'].includes(row.status)) continue
      const shapes = [row.approved_application?.coordinates, row.pending_application?.coordinates].filter(Boolean) as Point[][]
      if (shapes.some(shape => polygonDistance(candidate, shape) <= 32)) {
        values.push({ id: row.id, name: this.displayApp(row).name })
      }
    }
    return values
  }

  private getFromRows(rows: TerritoryRow[], id: string) {
    const row = rows.find(value => value.id === id)
    if (!row) throw new NotFoundException('Territory not found')
    return this.dto(row)
  }

  private async notify(sql: any, operationId: string, territoryId: string,
    kind: TerritoryNotificationEvent['kind'], applicationType: ApplicationType,
    coordinates: Point[], name: string, reviewReason?: string) {
    const territory = (await this.rows(sql)).find(row => row.id === territoryId)
    if (!territory) throw new NotFoundException('Territory not found')
    const discord = await sql`SELECT discord_id FROM account_discord_identities WHERE account_id=${territory.applicant_account_id} ORDER BY discord_id`
    const event: TerritoryNotificationEvent = {
      event_id: `${operationId}:${kind}`,
      kind, application_type: applicationType, territory_name: name,
      account_name: territory.applicant_name,
      discord_ids: discord.map((entry: any) => String(entry.discord_id)),
      territory_id: territoryId,
      ...(kind === 'application' || kind === 'approved'
        ? { centroid: centroid(coordinates), nearby_names: (await this.nearby(territoryId, coordinates, sql)).map(value => value.name) }
        : {}),
      ...(reviewReason ? { reason: reviewReason } : {}),
    }
    await this.notifications.send(event)
  }
}
