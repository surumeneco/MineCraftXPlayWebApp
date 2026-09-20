import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { delta, EMPTY_DELTA, expectedVersion, hasContent, imageIds, tags, title, uuid, type Delta } from './notice-validation.js'

const isDuplicate = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
const duplicate = (error: unknown): never => {
  if (isDuplicate(error)) throw new ConflictException('Title or tag already exists')
  throw error
}

@Injectable()
export class NoticeService {
  constructor(private readonly database: Database) {}

  async publicList() {
    return this.database.sql`
      SELECT n.id, n.title, n.body_delta, n.published_at, n.updated_at, false AS is_draft,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
          FROM notice_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.notice_id = n.id), '[]'::json) AS tags
      FROM notices n WHERE n.status = 'published' ORDER BY n.published_at DESC, n.id`
  }

  async publicDetail(rawTitle: string) {
    const records = await this.database.sql`
      SELECT n.id, n.title, n.body_delta, n.published_at, n.updated_at, false AS is_draft,
        COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
          FROM notice_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.notice_id = n.id), '[]'::json) AS tags
      FROM notices n WHERE n.title = ${rawTitle} AND n.status = 'published' LIMIT 1`
    if (!records.length) throw new NotFoundException('Notice not found')
    return records[0]
  }

  async publicTags() {
    return this.database.sql`
      SELECT DISTINCT t.id, t.name FROM tags t JOIN notice_tags nt ON nt.tag_id = t.id
      JOIN notices n ON n.id = nt.notice_id WHERE n.status = 'published' ORDER BY t.name`
  }

  async adminTags() { return this.database.sql`SELECT id, name FROM tags ORDER BY name` }

  async adminList() {
    return this.database.sql`
      SELECT n.*, COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
        FROM notice_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.notice_id = n.id), '[]'::json) AS tags
      FROM notices n ORDER BY n.created_at DESC, n.id`
  }

  async adminDetail(id: string) {
    const records = await this.database.sql`
      SELECT n.*, COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name)
        FROM notice_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.notice_id = n.id), '[]'::json) AS tags
      FROM notices n WHERE n.id = ${uuid(id)} LIMIT 1`
    if (!records.length) throw new NotFoundException('Notice not found')
    return records[0]
  }

  private input(raw: any, old?: any) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Invalid notice payload')
    const heading = title(raw.title === undefined && old ? old.title : raw.title)
    const body = delta(raw.body_delta === undefined ? (old?.body_delta ?? EMPTY_DELTA) : raw.body_delta)
    const selectedTags = tags(raw.tags === undefined ? (old?.tags?.map((tag: any) => tag.name) ?? []) : raw.tags)
    const session = raw.upload_session_id === undefined ? undefined : uuid(raw.upload_session_id)
    return { heading, body, selectedTags, session, ids: imageIds(body) }
  }

  private async saveTags(tx: any, id: string, selected: Array<{ name: string; key: string }>) {
    await tx`DELETE FROM notice_tags WHERE notice_id = ${id}`
    for (const tag of selected) {
      const rows = await tx`
        INSERT INTO tags (name, normalized_name) VALUES (${tag.name}, ${tag.key})
        ON CONFLICT (normalized_name) DO UPDATE SET normalized_name = EXCLUDED.normalized_name RETURNING id`
      await tx`INSERT INTO notice_tags (notice_id, tag_id) VALUES (${id}, ${rows[0].id})`
    }
  }

  private async saveImages(tx: any, id: string, imageIdsInBody: Set<string>, admin: string, session?: string) {
    const previous = await tx`
      SELECT i.id FROM images i JOIN notice_images ni ON ni.image_id = i.id
      WHERE ni.notice_id = ${id} FOR UPDATE OF i`
    const existing = new Set<string>(previous.map((row: any) => String(row.id)))
    for (const imageId of imageIdsInBody) {
      if (existing.has(imageId)) continue
      if (!session) throw new BadRequestException('upload_session_id is required for new images')
      const rows = await tx`
        SELECT id FROM images i WHERE i.id = ${imageId} AND i.purpose = 'notice'
          AND i.uploaded_by = ${admin} AND i.upload_session_id = ${session}
          AND i.upload_expires_at > now()
          AND NOT EXISTS (SELECT 1 FROM notice_images ni WHERE ni.image_id = i.id)
        FOR UPDATE OF i`
      if (!rows.length) throw new BadRequestException('Image not owned by this editing session')
      await tx`INSERT INTO notice_images (notice_id, image_id) VALUES (${id}, ${imageId})`
      await tx`UPDATE images SET upload_session_id = NULL, upload_expires_at = NULL WHERE id = ${imageId}`
    }
    for (const oldId of existing) {
      if (!imageIdsInBody.has(oldId)) await tx`DELETE FROM images WHERE id = ${oldId}`
    }
    if (session) {
      await tx`DELETE FROM images WHERE uploaded_by = ${admin} AND upload_session_id = ${session}
        AND NOT EXISTS (SELECT 1 FROM notice_images ni WHERE ni.image_id = images.id)`
    }
  }

  async create(raw: any, admin: string) {
    const next = this.input(raw)
    let id: string
    try {
      id = await this.database.sql.begin(async (tx) => {
        const rows = await tx`
          INSERT INTO notices (title, body_delta, status) VALUES (${next.heading}, ${tx.json(next.body as any)}, 'draft')
          RETURNING id`
        const newId = String(rows[0].id)
        await this.saveTags(tx, newId, next.selectedTags)
        await this.saveImages(tx, newId, next.ids, admin, next.session)
        return newId
      })
    } catch (error) { return duplicate(error) }
    return this.adminDetail(id)
  }

  async update(idRaw: string, raw: any, admin: string) {
    const id = uuid(idRaw)
    let updated: string
    try {
      updated = await this.database.sql.begin(async (tx) => {
        const rows = await tx`SELECT * FROM notices WHERE id = ${id} FOR UPDATE`
        if (!rows.length) throw new NotFoundException('Notice not found')
        const old = rows[0]
        if (expectedVersion(raw?.expected_version) !== old.version) throw new ConflictException('Notice was modified; reload it')
        const tagRows = await tx`SELECT t.name FROM notice_tags nt JOIN tags t ON t.id=nt.tag_id WHERE nt.notice_id=${id}`
        const next = this.input(raw, { ...old, tags: tagRows })
        if (old.status === 'published' && next.heading !== old.title) throw new ConflictException('Published title cannot change')
        if (old.status !== 'draft' && !hasContent(next.body)) throw new BadRequestException('Body cannot be empty')
        await tx`UPDATE notices SET title=${next.heading}, body_delta=${tx.json(next.body as any)},
          updated_at=clock_timestamp(), version=version+1 WHERE id=${id}`
        await this.saveTags(tx, id, next.selectedTags)
        await this.saveImages(tx, id, next.ids, admin, next.session)
        return id
      })
    } catch (error) { return duplicate(error) }
    return this.adminDetail(updated)
  }

  async publish(idRaw: string, raw: any) {
    const id = uuid(idRaw), expected = expectedVersion(raw?.expected_version)
    await this.database.sql.begin(async (tx) => {
      const rows = await tx`SELECT status, version, body_delta FROM notices WHERE id=${id} FOR UPDATE`
      if (!rows.length) throw new NotFoundException('Notice not found')
      const old = rows[0]
      if (old.version !== expected) throw new ConflictException('Notice was modified; reload it')
      if (old.status === 'published') throw new ConflictException('Already published')
      if (!hasContent(delta(old.body_delta))) throw new BadRequestException('Body cannot be empty')
      await tx`WITH stamp AS MATERIALIZED (SELECT clock_timestamp() AS at)
        UPDATE notices SET status='published', published_at=stamp.at, updated_at=stamp.at,
          version=version+1 FROM stamp WHERE id=${id}`
    })
    return this.adminDetail(id)
  }

  async unpublish(idRaw: string, raw: any) {
    const id = uuid(idRaw), expected = expectedVersion(raw?.expected_version)
    await this.database.sql.begin(async (tx) => {
      const rows = await tx`SELECT status, version FROM notices WHERE id=${id} FOR UPDATE`
      if (!rows.length) throw new NotFoundException('Notice not found')
      if (rows[0].version !== expected) throw new ConflictException('Notice was modified; reload it')
      if (rows[0].status !== 'published') throw new ConflictException('Only published notices can be unpublished')
      await tx`UPDATE notices SET status='unpublished', updated_at=clock_timestamp(), version=version+1 WHERE id=${id}`
    })
    return this.adminDetail(id)
  }

  async remove(idRaw: string, raw: any): Promise<void> {
    const id = uuid(idRaw), expected = expectedVersion(raw?.expected_version)
    await this.database.sql.begin(async (tx) => {
      const rows = await tx`SELECT status, version FROM notices WHERE id=${id} FOR UPDATE`
      if (!rows.length) throw new NotFoundException('Notice not found')
      if (rows[0].version !== expected) throw new ConflictException('Notice was modified; reload it')
      if (rows[0].status === 'published') throw new ConflictException('Unpublish before physical deletion')
      await tx`DELETE FROM images WHERE id IN (SELECT image_id FROM notice_images WHERE notice_id=${id})`
      await tx`DELETE FROM notices WHERE id=${id}`
    })
  }
}
