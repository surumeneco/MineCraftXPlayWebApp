import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { delta, expectedVersion, hasContent, tags, uuid, type Delta } from './notice-validation.js'
import { SpotImagesService } from './spot-images.service.js'

type Kind = 'public' | 'tourist'
type Status = 'draft' | 'published' | 'unpublished'
const kindOf = (raw: unknown): Kind => {
  if (raw !== 'public' && raw !== 'tourist') throw new BadRequestException('スポットの種類が不正です。')
  return raw
}
const duplicate = (error: unknown): never => {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
    throw new ConflictException('タグが重複しています。')
  }
  throw error
}
const nameOf = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new BadRequestException('名前は1～100文字で入力してください。')
  }
  return raw.trim()
}
const dimensionOf = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new BadRequestException('ディメンションを入力してください。')
  }
  return raw.trim()
}
const positionOf = (raw: unknown, axis: string) => {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || !Number.isSafeInteger(raw) || raw < -2147483648 || raw > 2147483647) {
    throw new BadRequestException(axis + '座標は整数で入力してください。')
  }
  return raw
}
function bodyImages(body: Delta): Set<string> {
  const ids = new Set<string>()
  const base = new URL((process.env.PUBLIC_API_BASE ?? 'http://localhost:3001/api').replace(/\/$/, '') + '/')
  for (const op of body.ops) {
    if (typeof op.insert === 'string') continue
    if (Object.keys(op.insert).length !== 1 || typeof op.insert.image !== 'string') {
      throw new BadRequestException('本文の埋め込み画像が不正です。')
    }
    let url: URL
    try { url = new URL(op.insert.image, base) }
    catch { throw new BadRequestException('画像URLが不正です。') }
    const prefix = base.pathname + 'spot-images/'
    if (url.origin !== base.origin || !url.pathname.startsWith(prefix) || url.search || url.hash) {
      throw new BadRequestException('スポット専用のアップロード画像を使用してください。')
    }
    ids.add(uuid(url.pathname.slice(prefix.length)))
  }
  return ids
}

@Injectable()
export class SpotService {
  constructor(private readonly database: Database, private readonly images: SpotImagesService) {}

  private getRows(kind: Kind, published = false, id?: string) {
    return this.database.sql`SELECT s.*,
      (SELECT t.current_name FROM territories t WHERE t.id=s.territory_id) AS territory_name,
      COALESCE((SELECT json_agg(json_build_object('id',t.id,'name',t.name) ORDER BY t.name)
        FROM spot_tags st JOIN tags t ON t.id=st.tag_id WHERE st.spot_id=s.id),'[]'::json) AS tags
      FROM spots s WHERE s.kind=${kind}
        AND (${published}::boolean=false OR s.status='published')
        AND (${id ?? null}::uuid IS NULL OR s.id=${id ?? null}::uuid)
      ORDER BY CASE WHEN s.kind='public' THEN s.sort_order END ASC,
        CASE WHEN s.kind='tourist' THEN s.published_at END DESC NULLS LAST,
        s.id`
  }
  publicList(rawKind: string) { return this.getRows(kindOf(rawKind), true) }
  async publicDetail(rawKind: string, rawId: string) {
    const rows = await this.getRows(kindOf(rawKind), true, uuid(rawId))
    if (!rows.length) throw new NotFoundException('スポットが見つかりません。')
    return rows[0]
  }
  adminList(rawKind: string) { return this.getRows(kindOf(rawKind)) }
  async adminDetail(rawKind: string, rawId: string) {
    const rows = await this.getRows(kindOf(rawKind), false, uuid(rawId))
    if (!rows.length) throw new NotFoundException('スポットが見つかりません。')
    return rows[0]
  }
  async publicTags() {
    return this.database.sql`SELECT DISTINCT t.id,t.name FROM tags t
      JOIN spot_tags st ON st.tag_id=t.id JOIN spots s ON s.id=st.spot_id
      WHERE s.kind='tourist' AND s.status='published' ORDER BY t.name`
  }
  async adminTags() {
    return this.database.sql`SELECT DISTINCT t.id,t.name FROM tags t
      JOIN spot_tags st ON st.tag_id=t.id JOIN spots s ON s.id=st.spot_id
      WHERE s.kind='tourist' ORDER BY t.name`
  }

  private input(kind: Kind, raw: any, old?: any) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('投稿内容が不正です。')
    const name = nameOf(raw.name === undefined ? old?.name : raw.name)
    const body = delta(raw.body_delta === undefined ? (old?.body_delta ?? { ops: [] }) : raw.body_delta)
    const selectedTags = kind === 'tourist'
      ? tags(raw.tags === undefined ? (old?.tags?.map((tag: any) => tag.name) ?? []) : raw.tags)
      : []
    const mainImage = raw.main_image_id === undefined ? (old?.main_image_id ?? null)
      : raw.main_image_id == null ? null : uuid(raw.main_image_id)
    const dimension = kind === 'public' ? dimensionOf(raw.dimension === undefined ? old?.dimension : raw.dimension) : null
    const x = kind === 'public' ? positionOf(raw.x === undefined ? old?.pos_x : raw.x, 'X') : null
    const y = kind === 'public' ? positionOf(raw.y === undefined ? old?.pos_y : raw.y, 'Y') : null
    const z = kind === 'public' ? positionOf(raw.z === undefined ? old?.pos_z : raw.z, 'Z') : null
    const territory = kind === 'tourist'
      ? (raw.territory_id === undefined ? (old?.territory_id ?? null) : raw.territory_id == null ? null : uuid(raw.territory_id))
      : null
    return { name, body, selectedTags, mainImage, dimension, x, y, z, territory, ids: bodyImages(body) }
  }

  private async checkTerritory(tx: any, territory: string | null) {
    if (!territory) throw new BadRequestException('観光スポットの領地を選択してください。')
    const rows = await tx`SELECT 1 FROM territories WHERE id=${territory} AND status='approved'`
    if (!rows.length) throw new BadRequestException('承認済みの領地を選択してください。')
  }
  private async saveTags(tx: any, spotId: string, selected: Array<{ name: string; key: string }>) {
    await tx`DELETE FROM spot_tags WHERE spot_id=${spotId}`
    for (const tag of selected) {
      const rows = await tx`INSERT INTO tags(name,normalized_name) VALUES(${tag.name},${tag.key})
        ON CONFLICT(normalized_name) DO UPDATE SET normalized_name=EXCLUDED.normalized_name RETURNING id`
      await tx`INSERT INTO spot_tags(spot_id,tag_id) VALUES(${spotId},${rows[0].id})`
    }
  }
  private async attachImages(tx: any, spotId: string, next: ReturnType<SpotService['input']>, admin: string) {
    const all = new Set(next.ids)
    if (next.mainImage) all.add(next.mainImage)
    for (const id of all) await this.images.attach(tx, id, spotId, admin)
    await tx`DELETE FROM spot_images WHERE spot_id=${spotId}`
    for (const id of next.ids) {
      await tx`INSERT INTO spot_images(spot_id,image_id) VALUES(${spotId},${id})`
    }
  }
  private async cleanupDetached(tx: any, ids: string[]) {
    for (const id of ids) {
      await tx`DELETE FROM images i WHERE i.id=${id} AND i.purpose='spot'
        AND i.upload_session_id IS NULL AND NOT EXISTS(SELECT 1 FROM spots s WHERE s.main_image_id=i.id)
        AND NOT EXISTS(SELECT 1 FROM spot_images si WHERE si.image_id=i.id)`
    }
  }
  async create(rawKind: string, raw: unknown, admin: string) {
    const kind = kindOf(rawKind), next = this.input(kind, raw)
    let id: string
    try {
      id = await this.database.sql.begin(async tx => {
        await tx`SELECT pg_advisory_xact_lock(79412503)`
        if (kind === 'tourist') await this.checkTerritory(tx, next.territory)
        const position = await tx`SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM spots WHERE kind=${kind}`
        const rows = await tx`INSERT INTO spots(kind,name,body_delta,dimension,pos_x,pos_y,pos_z,territory_id,sort_order)
          VALUES(${kind},${next.name},${tx.json(next.body as any)},${next.dimension},${next.x},${next.y},${next.z},
            ${next.territory},${position[0].next}) RETURNING id`
        const spotId = String(rows[0].id)
        await this.attachImages(tx, spotId, next, admin)
        await tx`UPDATE spots SET main_image_id=${next.mainImage} WHERE id=${spotId}`
        await this.saveTags(tx, spotId, next.selectedTags)
        return spotId
      })
    } catch (error) { return duplicate(error) }
    return this.adminDetail(kind, id)
  }
  async update(rawKind: string, rawId: string, raw: any, admin: string) {
    const kind = kindOf(rawKind), id = uuid(rawId)
    try {
      await this.database.sql.begin(async tx => {
        const rows = await tx`SELECT * FROM spots WHERE id=${id} AND kind=${kind} FOR UPDATE`
        if (!rows.length) throw new NotFoundException('スポットが見つかりません。')
        const old = rows[0]
        if (expectedVersion(raw?.expected_version) !== old.version) throw new ConflictException('他の更新があります。再読み込みしてください。')
        const previousTags = await tx`SELECT t.name FROM spot_tags st JOIN tags t ON t.id=st.tag_id WHERE st.spot_id=${id}`
        const next = this.input(kind, raw, { ...old, tags: previousTags })
        if (kind === 'tourist') await this.checkTerritory(tx, next.territory)
        if (old.status !== 'draft' && !hasContent(next.body)) throw new BadRequestException('本文を入力してください。')
        if (old.status === 'published' && kind === 'tourist' && !next.selectedTags.length) {
          throw new BadRequestException('タグを1件以上指定してください。')
        }
        const oldImages = await tx`SELECT image_id FROM spot_images WHERE spot_id=${id}`
        await this.attachImages(tx, id, next, admin)
        await tx`UPDATE spots SET name=${next.name},body_delta=${tx.json(next.body as any)},
          main_image_id=${next.mainImage},dimension=${next.dimension},pos_x=${next.x},pos_y=${next.y},pos_z=${next.z},
          territory_id=${next.territory},updated_at=clock_timestamp(),version=version+1 WHERE id=${id}`
        await this.saveTags(tx, id, next.selectedTags)
        await this.cleanupDetached(tx, [...oldImages.map(row => String(row.image_id)), ...(old.main_image_id ? [String(old.main_image_id)] : [])])
      })
    } catch (error) { return duplicate(error) }
    return this.adminDetail(kind, id)
  }
  async publish(rawKind: string, rawId: string, raw: any) {
    const kind = kindOf(rawKind), id = uuid(rawId)
    await this.database.sql.begin(async tx => {
      const rows = await tx`SELECT * FROM spots WHERE id=${id} AND kind=${kind} FOR UPDATE`
      if (!rows.length) throw new NotFoundException('スポットが見つかりません。')
      const old = rows[0]
      if (expectedVersion(raw?.expected_version) !== old.version) throw new ConflictException('他の更新があります。再読み込みしてください。')
      if (old.status === 'published') throw new ConflictException('既に公開されています。')
      if (!hasContent(delta(old.body_delta))) throw new BadRequestException('本文を入力してください。')
      if (kind === 'tourist') {
        await this.checkTerritory(tx, old.territory_id)
        const selected = await tx`SELECT 1 FROM spot_tags WHERE spot_id=${id} LIMIT 1`
        if (!selected.length) throw new BadRequestException('タグを1件以上指定してください。')
      }
      await tx`WITH stamp AS MATERIALIZED (SELECT clock_timestamp() AS at)
        UPDATE spots SET status='published',published_at=stamp.at,updated_at=stamp.at,version=version+1
        FROM stamp WHERE id=${id}`
    })
    return this.adminDetail(kind, id)
  }
  async unpublish(rawKind: string, rawId: string, raw: any) {
    const kind = kindOf(rawKind), id = uuid(rawId)
    const rows = await this.database.sql`UPDATE spots SET status='unpublished',updated_at=clock_timestamp(),version=version+1
      WHERE id=${id} AND kind=${kind} AND status='published' AND version=${expectedVersion(raw?.expected_version)}
      RETURNING id`
    if (!rows.length) throw new ConflictException('公開状態または更新番号を確認してください。')
    return this.adminDetail(kind, id)
  }
  async remove(rawKind: string, rawId: string, raw: any) {
    const kind = kindOf(rawKind), id = uuid(rawId)
    await this.database.sql.begin(async tx => {
      const records = await tx`SELECT status,version,main_image_id FROM spots WHERE id=${id} AND kind=${kind} FOR UPDATE`
      if (!records.length) throw new NotFoundException('スポットが見つかりません。')
      if (records[0].status === 'published') throw new ConflictException('公開を取り消してから削除してください。')
      if (records[0].version !== expectedVersion(raw?.expected_version)) throw new ConflictException('他の更新があります。')
      const images = await tx`SELECT image_id FROM spot_images WHERE spot_id=${id}`
      await tx`DELETE FROM spots WHERE id=${id}`
      await this.cleanupDetached(tx, [...images.map(row => String(row.image_id)),
        ...(records[0].main_image_id ? [String(records[0].main_image_id)] : [])])
    })
  }
  async reorder(raw: any) {
    if (!raw || !Array.isArray(raw.ids)) throw new BadRequestException('表示順が不正です。')
    const ids = raw.ids.map(uuid)
    if (new Set(ids).size !== ids.length) throw new BadRequestException('スポットが重複しています。')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const rows = await tx`SELECT id FROM spots WHERE kind='public' FOR UPDATE`
      if (rows.length !== ids.length || rows.some(row => !ids.includes(String(row.id)))) {
        throw new ConflictException('スポット一覧が更新されています。再読み込みしてください。')
      }
      for (let i = 0; i < ids.length; i++) {
        await tx`UPDATE spots SET sort_order=${i},updated_at=clock_timestamp(),version=version+1 WHERE id=${ids[i]}`
      }
    })
    return this.adminList('public')
  }
}
