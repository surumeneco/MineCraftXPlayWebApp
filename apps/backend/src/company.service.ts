import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid, delta, type Delta } from './notice-validation.js'
import { CompanyImagesService } from './company-images.service.js'
import { CompanyNotificationService, type CompanyNotificationEvent } from './company-notification.service.js'

export const COMPANY_TAGS = ['建築','資材','回路','冒険','インフラ'] as const
export type CompanyStatus = 'pending' | 'approved' | 'returned' | 'withdrawn' | 'rejected'
type ApplicationType = 'new' | 'edit'
type Operation = 'create' | 'reapply' | 'edit' | 'withdraw' | 'approve' | 'return' | 'reject'
type Viewer = { account_id?: string; is_admin?: boolean }
type CompanyRow = {
  id: string
  applicant_account_id: string
  applicant_name: string
  representative_account_id: string
  representative_name: string
  representative_minecraft_ids: Array<{ edition: string; username: string }>
  members: Array<{ id: string; name: string }>
  headquarters_name: string | null
  headquarters_territory_id: string | null
  is_public: boolean
  status: CompanyStatus
  current_name: string | null
  current_tags: string[]
  current_activities: string
  current_image_id: string | null
  introduction_delta: Delta
  first_applied_at: string
  approved_at: string | null
  status_changed_at: string
  pending_application: any | null
  latest_application: any | null
}

function nameOf(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new BadRequestException('企業名は1～100文字で入力してください。')
  }
  return raw.trim()
}
function activityOf(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 20000 || raw.includes('\u0000')) {
    throw new BadRequestException('活動内容は1～20,000文字で入力してください。')
  }
  return raw.trim()
}
function tagsOf(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.some(tag => typeof tag !== 'string' || !COMPANY_TAGS.includes(tag as any))) {
    throw new BadRequestException('企業タグは指定された選択肢から選んでください。')
  }
  if (new Set(raw).size !== raw.length) throw new BadRequestException('タグが重複しています。')
  return COMPANY_TAGS.filter(tag => raw.includes(tag))
}
function membersOf(raw: unknown, representative?: string): string[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100) {
    throw new BadRequestException('所属者は1～100アカウント指定してください。')
  }
  const result = raw.map(uuid)
  if (new Set(result).size !== result.length) throw new BadRequestException('所属者が重複しています。')
  if (representative && result.includes(representative)) throw new BadRequestException('代表者は所属者に含めず、別のアカウントを1人以上指定してください。')
  return result
}
function introductionOf(raw: unknown): Delta {
  const value = delta(raw ?? { ops: [] })
  // Company introductions use text/formatting Quill operations. Never persist data URLs or arbitrary embeds.
  if (value.ops.some(op => typeof op.insert !== 'string') || JSON.stringify(value).length > 100000) {
    throw new BadRequestException('紹介文の形式または文字数が不正です。')
  }
  return value
}
function reasonOf(raw: unknown) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 20000) throw new BadRequestException('審査理由を入力してください。')
  return raw.trim()
}
const compare = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

@Injectable()
export class CompanyService {
  constructor(private readonly database: Database, private readonly images: CompanyImagesService,
    private readonly notifications: CompanyNotificationService) {}

  private async rows(sql: any = this.database.sql, id: string | null = null): Promise<CompanyRow[]> {
    return await sql`SELECT c.*, applicant.name AS applicant_name, representative.name AS representative_name,
      headquarters.current_name AS headquarters_name,
      COALESCE((SELECT json_agg(json_build_object('id',m.account_id,'name',a.name) ORDER BY a.name,a.id)
        FROM company_members m JOIN accounts a ON a.id=m.account_id
        WHERE m.company_id=c.id AND m.account_id<>c.representative_account_id),'[]'::json) AS members,
      COALESCE((SELECT json_agg(json_build_object('edition',mi.edition,'username',mi.username)
        ORDER BY mi.edition,mi.username)
        FROM account_minecraft_identities mi WHERE mi.account_id=c.representative_account_id),'[]'::json) AS representative_minecraft_ids,
      (SELECT json_build_object('id',app.id,'application_type',app.application_type,
        'submitted_by_account_id',app.submitted_by_account_id,'name',app.name,'tags',app.tags,
        'representative_account_id',app.representative_account_id,'activities',app.activities,
        'status',app.status,'submitted_at',app.submitted_at,'decided_at',app.decided_at,'reason',app.reason)
        FROM company_applications app WHERE app.company_id=c.id AND app.status='pending'
        ORDER BY app.submitted_at DESC,app.id DESC LIMIT 1) AS pending_application,
      (SELECT json_build_object('id',app.id,'application_type',app.application_type,
        'submitted_by_account_id',app.submitted_by_account_id,'name',app.name,'tags',app.tags,
        'representative_account_id',app.representative_account_id,'activities',app.activities,
        'status',app.status,'submitted_at',app.submitted_at,'decided_at',app.decided_at,'reason',app.reason)
        FROM company_applications app WHERE app.company_id=c.id
        ORDER BY app.submitted_at DESC,app.id DESC LIMIT 1) AS latest_application
      FROM companies c
      JOIN accounts applicant ON applicant.id=c.applicant_account_id
      JOIN accounts representative ON representative.id=c.representative_account_id
      LEFT JOIN territories headquarters ON headquarters.id=c.headquarters_territory_id
      WHERE (${id}::uuid IS NULL OR c.id=${id}::uuid)
      ORDER BY c.first_applied_at,c.id` as unknown as CompanyRow[]
  }

  private dto(row: CompanyRow, viewer: Viewer, proposed = false) {
    const showPending = proposed && row.pending_application
    const app = showPending ? row.pending_application : (!row.approved_at ? (row.pending_application ?? row.latest_application) : null)
    const name = app?.name ?? row.current_name ?? row.latest_application?.name
    const tags: string[] = app?.tags ?? row.current_tags
    const representativeId = app?.representative_account_id ?? row.representative_account_id
    const representative = representativeId === row.representative_account_id
      ? { id: row.representative_account_id, name: row.representative_name, minecraft_ids: row.representative_minecraft_ids }
      : { id: String(representativeId), name: '', minecraft_ids: [] }
    const canManage = viewer.is_admin === true || viewer.account_id === row.representative_account_id
    const canSeePending = viewer.is_admin === true || viewer.account_id === row.applicant_account_id
      || viewer.account_id === row.pending_application?.submitted_by_account_id || canManage
    const latest = row.latest_application
    const canReapplyEdit = !!row.approved_at && row.status === 'approved'
      && latest?.application_type === 'edit' && ['returned','withdrawn'].includes(String(latest.status))
      && viewer.account_id === latest.submitted_by_account_id && canManage
    return {
      id: row.id, name, is_public: row.is_public,
      status: row.approved_at && row.status === 'pending' && !canSeePending ? 'approved' : row.status,
      tags, representative, members: row.members,
      headquarters: { id: row.headquarters_territory_id, name: row.headquarters_name },
      activities: app?.activities ?? row.current_activities,
      image_id: row.current_image_id, introduction_delta: row.introduction_delta,
      applicant: { id: row.applicant_account_id, name: row.applicant_name },
      applied_at: row.first_applied_at, approved_at: row.approved_at, changed_at: row.status_changed_at,
      application_type: app?.application_type ?? row.pending_application?.application_type ?? 'new',
      pending_changes: canSeePending && !!row.pending_application && !!row.approved_at,
      can_edit: canManage && row.status === 'approved',
      can_reapply: (viewer.account_id === row.applicant_account_id && !row.approved_at && ['returned','withdrawn'].includes(row.status)) || canReapplyEdit,
      last_application_status: viewer.is_admin === true || viewer.account_id === latest?.submitted_by_account_id
        ? latest?.status ?? null : null,
      reapply_draft: canReapplyEdit ? {name:latest.name,tags:latest.tags,activities:latest.activities,
        representative:{id:String(latest.representative_account_id),name:''}} : null,
      can_withdraw: viewer.account_id === row.pending_application?.submitted_by_account_id && row.status === 'pending',
      ...(canSeePending && row.latest_application?.reason ? { reason: row.latest_application.reason } : {}),
    }
  }

  async list(viewer: Viewer, query: Record<string, unknown> = {}) {
    let values = (await this.rows()).filter(row => !!row.approved_at ||
      (['pending','returned','withdrawn'].includes(row.status) && row.applicant_account_id === viewer.account_id && !row.approved_at))
      .map(row => this.dto(row,viewer))
    const match = (candidate: string | null | undefined, raw: unknown) => {
      if (typeof raw !== 'string' || !raw.trim()) return true
      return (candidate ?? '').normalize('NFKC').toLocaleLowerCase('ja')
        .includes(raw.trim().normalize('NFKC').toLocaleLowerCase('ja'))
    }
    values = values.filter(value => match(value.name,query.name)
      && (typeof query.tag !== 'string' || !query.tag || value.tags.includes(query.tag))
      && (typeof query.account !== 'string' || !query.account ||
        match(value.representative.name,query.account) || value.members.some(member => match(member.name,query.account)))
      && match(value.headquarters.name,query.headquarters))
    const sort = ['name','applied_at','approved_at','changed_at'].includes(String(query.sort)) ? String(query.sort) : 'approved_at'
    const desc = query.direction !== 'asc' && sort !== 'name'
    values.sort((a,b) => {
      const x = String((a as any)[sort] ?? ''), y = String((b as any)[sort] ?? '')
      return (desc ? y.localeCompare(x,'ja') : x.localeCompare(y,'ja')) || a.id.localeCompare(b.id)
    })
    return values
  }

  async get(idRaw: unknown, viewer: Viewer) {
    const id = uuid(idRaw), row = (await this.rows(this.database.sql,id))[0]
    if (!row || (!row.approved_at && !viewer.is_admin && viewer.account_id !== row.applicant_account_id)) {
      throw new NotFoundException('企業が見つかりません。')
    }
    const detail = this.dto(row,viewer)
    if (detail.reapply_draft) {
      const rep = detail.reapply_draft.representative
      if (rep.id === row.representative_account_id) rep.name = row.representative_name
      else {
        const matches = await this.database.sql`SELECT name FROM accounts WHERE id=${rep.id}`
        rep.name = String(matches[0]?.name ?? '')
      }
    }
    return detail
  }

  private async activeAccount(tx: any, raw: unknown) {
    const id = uuid(raw)
    const rows = await tx`SELECT a.id,a.name FROM accounts a WHERE a.id=${id} AND a.retired_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM account_merges m WHERE m.source_account_id=a.id AND m.restored_at IS NULL)`
    if (!rows.length) throw new BadRequestException('有効なアカウントを選択してください。')
    return id
  }

  private async checkHeadquarters(tx: any, raw: unknown, actor: string, representative: string,
    companyId: string | null, admin: boolean, mode: 'apply'|'edit') {
    const id = uuid(raw)
    const rows = await tx`SELECT id,owner_type,owner_account_id,owner_company_id FROM territories
      WHERE id=${id} AND status='approved'`
    const territory = rows[0]
    const own = territory?.owner_type === 'account' && String(territory.owner_account_id) === (mode === 'apply' ? actor : representative)
    const shared = territory?.owner_type === 'shared_area'
    const companyOwn = mode === 'edit' && territory?.owner_type === 'company' &&
      String(territory.owner_company_id) === companyId
    const adminSpecial = mode === 'apply' && admin && ['administration','protected_area'].includes(String(territory?.owner_type))
    if (!territory || !(own || shared || companyOwn || adminSpecial)) {
      throw new BadRequestException('選択できない主要活動拠点です。')
    }
    return id
  }

  async searchAccounts(raw: unknown) {
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (value.length > 100) throw new BadRequestException('検索文字列が長すぎます。')
    return this.database.sql`SELECT a.id,a.name FROM accounts a
      WHERE a.retired_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM account_merges m WHERE m.source_account_id=a.id AND m.restored_at IS NULL)
        AND strpos(lower(a.name),lower(${value}))>0
      ORDER BY a.name,a.id LIMIT 30`
  }

  async headquarters(actor: string, admin: boolean, mode: 'apply'|'edit', companyRaw: unknown = null,
    proposedRepresentativeRaw: unknown = undefined) {
    let representative = actor, companyId: string | null = null
    if (mode === 'edit') {
      companyId = uuid(companyRaw)
      const row = (await this.rows(this.database.sql,companyId))[0]
      if (!row || (!admin && row.representative_account_id !== actor)) throw new ForbiddenException('拠点候補を閲覧できません。')
      representative = proposedRepresentativeRaw === undefined ? row.representative_account_id : uuid(proposedRepresentativeRaw)
      if (proposedRepresentativeRaw !== undefined) await this.activeAccount(this.database.sql,representative)
    }
    const rows = await this.database.sql`SELECT t.id,t.current_name AS name,t.owner_type,t.owner_company_id
      FROM territories t WHERE t.status='approved' AND (
        (t.owner_type='account' AND t.owner_account_id=${representative})
        OR t.owner_type='shared_area'
        OR (${admin && mode === 'apply'} AND t.owner_type IN ('administration','protected_area'))
        OR (${mode === 'edit'} AND t.owner_type='company' AND t.owner_company_id=${companyId}::uuid)
      ) ORDER BY t.current_name,t.id`
    return rows
  }

  async territoryOwners(accountId: string, admin: boolean) {
    return this.database.sql`SELECT id,current_name AS name,is_public FROM companies
      WHERE approved_at IS NOT NULL AND ((representative_account_id=${accountId} AND (NOT is_public OR ${admin}))
        OR (${admin} AND is_public)) ORDER BY current_name,id`
  }

  private async complete(tx: any, operationId: string, companyId: string, kind: Operation, actor: string) {
    await tx`INSERT INTO company_operations(operation_id,company_id,actor_account_id,operation_kind)
      VALUES (${operationId},${companyId},${actor},${kind})`
  }
  private async completed(tx: any, operationId: string, companyId: string, kind: Operation, actor: string, admin = false) {
    const records = await tx`SELECT company_id,actor_account_id,operation_kind FROM company_operations WHERE operation_id=${operationId}`
    if (!records.length) return null
    if (String(records[0].company_id) !== companyId || String(records[0].actor_account_id) !== actor || records[0].operation_kind !== kind) {
      throw new ConflictException('この操作IDは別の操作に使用されています。')
    }
    return this.dto((await this.rows(tx,companyId))[0],{account_id:actor,is_admin:admin})
  }
  private async notify(tx: any, operationId: string, rowId: string,
    kind: CompanyNotificationEvent['kind'], applicationType: ApplicationType, name: string, actor: string, reason?: string) {
    const account = await tx`SELECT a.name FROM accounts a WHERE a.id=${actor}`
    const discord = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${actor} ORDER BY discord_id`
    const event: CompanyNotificationEvent = {
      event_id: `company:${operationId}:${kind}`,kind,application_type:applicationType,
      company_name:name,account_name:String(account[0]?.name ?? ''),discord_ids:discord.map((item:any)=>String(item.discord_id)),
      company_id:rowId,...(reason ? {reason} : {}),
    }
    await this.notifications.send(event)
  }

  async create(actor: string, admin: boolean, body: any) {
    const id = uuid(body?.operation_id)
    const name = nameOf(body?.name), tags = tagsOf(body?.tags ?? []), activities = activityOf(body?.activities)
    const rep = admin && body?.representative_account_id ? uuid(body.representative_account_id) : actor
    if (!admin && body?.representative_account_id !== undefined && body.representative_account_id !== actor) {
      throw new ForbiddenException('代表者は自分のみ指定できます。')
    }
    if (!admin && body?.is_public !== undefined) throw new ForbiddenException('公営区分は管理者のみ設定できます。')
    const members = membersOf(body?.member_account_ids,rep)
    const intro = introductionOf(body?.introduction_delta)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const previous = await this.completed(tx,id,id,'create',actor,admin)
      if (previous) return previous
      await this.activeAccount(tx,rep)
      for (const member of members) await this.activeAccount(tx,member)
      const headquarters = await this.checkHeadquarters(tx,body?.headquarters_territory_id,actor,rep,null,admin,'apply')
      await tx`INSERT INTO companies(id,applicant_account_id,representative_account_id,is_public,status,
        headquarters_territory_id,introduction_delta)
        VALUES (${id},${actor},${rep},${admin && body?.is_public === true},'pending',${headquarters},${tx.json(intro as any)})`
      const image = body?.image_id === undefined ? null : await this.images.attach(tx,body.image_id,id,actor)
      if (image) await tx`UPDATE companies SET current_image_id=${image} WHERE id=${id}`
      for (const member of members) await tx`INSERT INTO company_members(company_id,account_id) VALUES (${id},${member})`
      await tx`INSERT INTO company_applications(company_id,application_type,submitted_by_account_id,
        name,tags,representative_account_id,activities,status)
        VALUES (${id},'new',${actor},${name},${tx.array(tags)},${rep},${activities},'pending')`
      await this.notify(tx,id,id,'application','new',name,actor)
      await this.complete(tx,id,id,'create',actor)
      return this.dto((await this.rows(tx,id))[0],{account_id:actor,is_admin:admin})
    })
  }

  async reapply(actor: string, admin: boolean, rawId: unknown, body: any) {
    const id = uuid(rawId), operationId = uuid(body?.operation_id)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const previous = await this.completed(tx,operationId,id,'reapply',actor,admin)
      if (previous) return previous
      const locked = await tx`SELECT * FROM companies WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('企業が見つかりません。')
      const company = locked[0]
      if (!company.approved_at && String(company.applicant_account_id) !== actor) throw new ForbiddenException('申請者本人のみ再申請できます。')
      const last = await tx`SELECT * FROM company_applications WHERE company_id=${id} ORDER BY submitted_at DESC,id DESC LIMIT 1`
      if (company.approved_at) {
        const previousApp = last[0]
        if (company.status !== 'approved' || previousApp?.application_type !== 'edit'
          || !['returned','withdrawn'].includes(String(previousApp?.status))
          || String(previousApp.submitted_by_account_id) !== actor
          || (!admin && String(company.representative_account_id) !== actor)) {
          throw new ConflictException('再申請できない状態です。')
        }
        const name = nameOf(body?.name ?? previousApp.name)
        const tags = tagsOf(body?.tags ?? previousApp.tags)
        const activities = activityOf(body?.activities ?? previousApp.activities)
        const rep = body?.representative_account_id === undefined
          ? String(previousApp.representative_account_id) : await this.activeAccount(tx,body.representative_account_id)
        await this.activeAccount(tx,rep)
        if (company.representative_merge_origin && rep !== String(company.representative_account_id)) {
          throw new ConflictException('アカウント統合を分離してから代表者を変更してください。')
        }
        const head = await this.checkHeadquarters(tx,body?.headquarters_territory_id ?? company.headquarters_territory_id,
          actor,rep,id,admin,'edit')
        if (!admin && body?.is_public !== undefined) throw new ForbiddenException('公営区分は管理者のみ設定できます。')
        const publicFlag = admin && body?.is_public !== undefined ? body.is_public === true : company.is_public
        const intro = introductionOf(body?.introduction_delta ?? company.introduction_delta)
        const image = body?.image_id === undefined ? company.current_image_id : await this.images.attach(tx,body.image_id,id,actor)
        await this.syncMembers(tx,id,rep,body?.member_account_ids)
        await tx`UPDATE companies SET headquarters_territory_id=${head},current_image_id=${image},
          introduction_delta=${tx.json(intro as any)},is_public=${publicFlag},
          status='pending',status_changed_at=clock_timestamp() WHERE id=${id}`
        await tx`INSERT INTO company_applications(company_id,application_type,submitted_by_account_id,
          name,tags,representative_account_id,activities,status)
          VALUES (${id},'edit',${actor},${name},${tx.array(tags)},${rep},${activities},'pending')`
        await this.notify(tx,operationId,id,'application','edit',name,actor)
        await this.complete(tx,operationId,id,'reapply',actor)
        return this.dto((await this.rows(tx,id))[0],{account_id:actor,is_admin:admin},true)
      }
      if (!['returned','withdrawn'].includes(String(company.status))) throw new ConflictException('再申請できない状態です。')
      const name = nameOf(body?.name ?? last[0]?.name)
      const tags = tagsOf(body?.tags ?? last[0]?.tags ?? [])
      const activities = activityOf(body?.activities ?? last[0]?.activities)
      const rep = admin && body?.representative_account_id ? uuid(body.representative_account_id) : actor
      if (!admin && body?.representative_account_id && body.representative_account_id !== actor) throw new ForbiddenException('代表者を変更できません。')
      await this.activeAccount(tx,rep)
      const head = await this.checkHeadquarters(tx,body?.headquarters_territory_id ?? company.headquarters_territory_id,
        actor,rep,null,admin,'apply')
      const intro = introductionOf(body?.introduction_delta ?? company.introduction_delta)
      if (!admin && body?.is_public !== undefined) throw new ForbiddenException('公営区分は管理者のみ設定できます。')
      const publicFlag = admin && body?.is_public !== undefined ? body.is_public === true : company.is_public
      const image = body?.image_id === undefined ? company.current_image_id : await this.images.attach(tx,body.image_id,id,actor)
      const savedMembers = await tx`SELECT account_id FROM company_members WHERE company_id=${id}`
      const previousMembers = savedMembers.map((row: any) => String(row.account_id)).sort()
      const nextMembers = membersOf(body?.member_account_ids === undefined ? previousMembers : body.member_account_ids,rep)
      if (body?.member_account_ids !== undefined) {
        const mergedMember = await tx`SELECT 1 FROM company_members WHERE company_id=${id} AND merge_origin IS NOT NULL LIMIT 1`
        if (mergedMember.length) throw new ConflictException('アカウント統合中の所属者がいるため、分離後に所属者を変更してください。')
        for (const member of nextMembers) await this.activeAccount(tx,member)
      }
      if (body?.member_account_ids !== undefined) {
        await tx`DELETE FROM company_members WHERE company_id=${id}`
        for (const member of nextMembers) await tx`INSERT INTO company_members(company_id,account_id) VALUES (${id},${member})`
      }
      await tx`UPDATE companies SET representative_account_id=${rep},is_public=${publicFlag},
        headquarters_territory_id=${head},introduction_delta=${tx.json(intro as any)},current_image_id=${image},
        status='pending',status_changed_at=clock_timestamp() WHERE id=${id}`
      await tx`INSERT INTO company_applications(company_id,application_type,submitted_by_account_id,
        name,tags,representative_account_id,activities,status)
        VALUES (${id},'new',${actor},${name},${tx.array(tags)},${rep},${activities},'pending')`
      await this.notify(tx,operationId,id,'application','new',name,actor)
      await this.complete(tx,operationId,id,'reapply',actor)
      return this.dto((await this.rows(tx,id))[0],{account_id:actor,is_admin:admin})
    })
  }

  private async syncMembers(tx: any, companyId: string, representative: string, raw: unknown) {
    const saved = await tx`SELECT account_id FROM company_members WHERE company_id=${companyId} ORDER BY account_id`
    const previous = saved.map((row: any) => String(row.account_id))
    const next = membersOf(raw === undefined ? previous : raw,representative)
    if (compare([...next].sort(),[...previous].sort())) return false
    const merging = await tx`SELECT 1 FROM company_members WHERE company_id=${companyId} AND merge_origin IS NOT NULL LIMIT 1`
    if (merging.length) throw new ConflictException('アカウント統合中の所属者がいるため、分離後に所属者を変更してください。')
    for (const member of next) await this.activeAccount(tx,member)
    await tx`DELETE FROM company_members WHERE company_id=${companyId}`
    for (const member of next) await tx`INSERT INTO company_members(company_id,account_id) VALUES (${companyId},${member})`
    return true
  }

  async edit(actor: string, admin: boolean, rawId: unknown, body: any) {
    const id = uuid(rawId), operationId = uuid(body?.operation_id)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const previous = await this.completed(tx,operationId,id,'edit',actor,admin)
      if (previous) return previous
      const locked = await tx`SELECT * FROM companies WHERE id=${id} FOR UPDATE`
      if (!locked.length) throw new NotFoundException('企業が見つかりません。')
      const c = locked[0]
      if (!admin && String(c.representative_account_id) !== actor) throw new ForbiddenException('代表者または管理者のみ編集できます。')
      if (c.status !== 'approved') throw new ConflictException('承認済みの企業のみ編集できます。')
      const name = nameOf(body?.name ?? c.current_name), tags = tagsOf(body?.tags ?? c.current_tags)
      const activities = activityOf(body?.activities ?? c.current_activities)
      const rep = body?.representative_account_id === undefined ? String(c.representative_account_id) :
        await this.activeAccount(tx,body.representative_account_id)
      if (c.representative_merge_origin && rep !== String(c.representative_account_id)) {
        throw new ConflictException('アカウント統合を分離してから代表者を変更してください。')
      }
      const head = await this.checkHeadquarters(tx,body?.headquarters_territory_id ?? c.headquarters_territory_id,
        actor,rep,id,admin,'edit')
      if (!admin && body?.is_public !== undefined) throw new ForbiddenException('公営区分は管理者のみ設定できます。')
      const publicFlag = admin && body?.is_public !== undefined ? body.is_public === true : c.is_public
      const intro = introductionOf(body?.introduction_delta ?? c.introduction_delta)
      const image = body?.image_id === undefined ? c.current_image_id : await this.images.attach(tx,body.image_id,id,actor)
      const membershipChanged = await this.syncMembers(tx,id,rep,body?.member_account_ids)
      const review = name !== c.current_name || !compare(tags,c.current_tags) || rep !== String(c.representative_account_id)
        || activities !== c.current_activities
      const immediate = head !== String(c.headquarters_territory_id) || publicFlag !== c.is_public
        || !compare(intro,c.introduction_delta) || String(image ?? '') !== String(c.current_image_id ?? '')
        || membershipChanged
      if (!review && !immediate) throw new BadRequestException('変更内容がありません。')
      await tx`UPDATE companies SET headquarters_territory_id=${head},current_image_id=${image},
        introduction_delta=${tx.json(intro as any)},is_public=${publicFlag},
        status=${review?'pending':'approved'},status_changed_at=clock_timestamp() WHERE id=${id}`
      if (review) {
        await tx`INSERT INTO company_applications(company_id,application_type,submitted_by_account_id,
          name,tags,representative_account_id,activities,status)
          VALUES (${id},'edit',${actor},${name},${tx.array(tags)},${rep},${activities},'pending')`
        await this.notify(tx,operationId,id,'application','edit',name,actor)
      }
      await this.complete(tx,operationId,id,'edit',actor)
      return this.dto((await this.rows(tx,id))[0],{account_id:actor,is_admin:admin},review)
    })
  }

  async withdraw(actor: string, rawId: unknown, rawOperation: unknown) {
    const id = uuid(rawId), operationId = uuid(rawOperation)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const previous = await this.completed(tx,operationId,id,'withdraw',actor)
      if (previous) return previous
      const rows = await tx`SELECT * FROM companies WHERE id=${id} FOR UPDATE`
      if (!rows.length || rows[0].status !== 'pending') throw new ConflictException('申請中の企業が見つかりません。')
      const apps = await tx`SELECT * FROM company_applications WHERE company_id=${id} AND status='pending' FOR UPDATE`
      if (!apps.length) throw new ConflictException('取下対象の申請が見つかりません。')
      const app = apps[0]
      if (String(app.submitted_by_account_id) !== actor) throw new ForbiddenException('申請者本人のみ取り下げできます。')
      await tx`UPDATE company_applications SET status='withdrawn',decided_at=clock_timestamp() WHERE id=${app.id}`
      await tx`UPDATE companies SET status=${rows[0].approved_at?'approved':'withdrawn'},
        status_changed_at=clock_timestamp() WHERE id=${id}`
      await this.notify(tx,operationId,id,'withdrawn',app.application_type,String(app.name),actor)
      await this.complete(tx,operationId,id,'withdraw',actor)
      return this.dto((await this.rows(tx,id))[0],{account_id:actor})
    })
  }

  async pendingForAdmin() {
    return (await this.rows()).filter(row => row.status === 'pending' && row.pending_application)
      .map(row => this.dto(row,{is_admin:true},true))
  }
  async reviewDetail(rawId: unknown) {
    const row = (await this.rows(this.database.sql,uuid(rawId)))[0]
    if (!row || row.status !== 'pending' || !row.pending_application) throw new NotFoundException('審査対象が見つかりません。')
    const current = row.approved_at ? this.dto(row,{is_admin:true}) : null
    const proposal = this.dto(row,{is_admin:true},true)
    if (proposal.representative.name === '') {
      const ids = await this.database.sql`SELECT a.name FROM accounts a WHERE a.id=${proposal.representative.id}`
      proposal.representative.name = String(ids[0]?.name ?? '')
    }
    return { ...proposal,current, submitted_at:row.pending_application.submitted_at }
  }

  async review(rawId: unknown, actionRaw: unknown, reasonRaw: unknown, rawOperation: unknown, admin: string) {
    const id = uuid(rawId), operationId = uuid(rawOperation)
    if (!['approve','return','reject'].includes(String(actionRaw))) throw new BadRequestException('不正な審査操作です。')
    const action = actionRaw as 'approve'|'return'|'reject'
    const reason = action === 'approve' ? undefined : reasonOf(reasonRaw)
    return this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const previous = await this.completed(tx,operationId,id,action,admin,true)
      if (previous) return previous
      const company = await tx`SELECT * FROM companies WHERE id=${id} FOR UPDATE`
      if (!company.length || company[0].status !== 'pending') throw new ConflictException('審査対象が見つかりません。')
      const apps = await tx`SELECT * FROM company_applications WHERE company_id=${id} AND status='pending' FOR UPDATE`
      if (!apps.length) throw new ConflictException('審査対象の申請が見つかりません。')
      const app = apps[0]
      if (action === 'approve') {
        if (company[0].representative_merge_origin
          && String(app.representative_account_id) !== String(company[0].representative_account_id)) {
          throw new ConflictException('代表者のアカウント統合を分離してから承認してください。')
        }
        await this.activeAccount(tx,app.representative_account_id)
        const otherMembers = await tx`SELECT count(*)::int AS count FROM company_members
          WHERE company_id=${id} AND account_id<>${app.representative_account_id}`
        if (Number(otherMembers[0]?.count) < 1) throw new ConflictException('代表者以外の所属者を1人以上登録してください。')
        if (String(app.representative_account_id) !== String(company[0].representative_account_id)) {
          const merging = await tx`SELECT 1 FROM company_members WHERE company_id=${id}
            AND account_id=${app.representative_account_id} AND merge_origin IS NOT NULL`
          if (merging.length) throw new ConflictException('所属者のアカウント統合を分離してから代表者を変更してください。')
          await tx`DELETE FROM company_members WHERE company_id=${id} AND account_id=${app.representative_account_id}`
        }
        await this.checkHeadquarters(tx,company[0].headquarters_territory_id,String(company[0].applicant_account_id),
          String(app.representative_account_id),id,true,app.application_type === 'new'?'apply':'edit')
        await tx`UPDATE company_applications SET status='approved',decided_at=clock_timestamp(),reason=NULL WHERE id=${app.id}`
        await tx`UPDATE companies SET current_name=${app.name},current_tags=${tx.array(app.tags)},
          current_activities=${app.activities},representative_account_id=${app.representative_account_id},
          status='approved',approved_at=clock_timestamp(),
          status_changed_at=clock_timestamp() WHERE id=${id}`
      } else {
        await tx`UPDATE company_applications SET status=${action==='return'?'returned':'rejected'},
          reason=${reason ?? ''},decided_at=clock_timestamp() WHERE id=${app.id}`
        await tx`UPDATE companies SET status=${company[0].approved_at?'approved':action==='return'?'returned':'rejected'},
          status_changed_at=clock_timestamp() WHERE id=${id}`
      }
      await this.notify(tx,operationId,id,action==='approve'?'approved':action==='return'?'returned':'rejected',
        app.application_type,String(app.name),String(app.submitted_by_account_id),reason)
      await this.complete(tx,operationId,id,action,admin)
      return this.dto((await this.rows(tx,id))[0],{is_admin:true})
    })
  }
}
