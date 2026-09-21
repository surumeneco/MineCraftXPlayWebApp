import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'
import { decodeSiteImage, RESOURCE_KEY } from './site-image-validation.js'

function payload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('入力内容が不正です。')
  return raw as Record<string, unknown>
}
function text(value: unknown, field: string, max: number, optional = false): string {
  if (typeof value !== 'string') throw new BadRequestException(`${field}を入力してください。`)
  const trimmed = value.trim()
  if ((!optional && !trimmed) || trimmed.length > max) throw new BadRequestException(`${field}は1～${max}文字以内で入力してください。`)
  return trimmed
}
function duplicate(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    throw new ConflictException('同じ管理キーまたはバージョン番号が既に存在します。')
  }
  throw error
}
function absoluteStaticUrl(path: string): string {
  const origin = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '')
  return `${origin}${path}`
}
function imageHeaders(res: any, mime: string, version: string, isPublic: boolean): void {
  res.setHeader('Content-Type', mime)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', 'inline')
  res.setHeader('Cache-Control', isPublic ? 'public, max-age=0, must-revalidate' : 'private, no-store')
  res.setHeader('ETag', `"${version}"`)
  if (mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'")
}

@Injectable()
export class SiteImagesService {
  constructor(private readonly database: Database) {}

  async listResources() {
    return this.database.sql`
      SELECT r.id, r.key, r.name, r.description, r.created_at,
        COALESCE(json_agg(json_build_object(
          'id', v.id, 'resource_id', v.resource_id, 'version_number', v.version_number,
          'name', v.name, 'note', v.note, 'static_path', v.static_path,
          'uploaded_by', v.uploaded_by, 'created_at', v.created_at,
          'mime_type', i.mime_type
        ) ORDER BY v.version_number DESC) FILTER (WHERE v.id IS NOT NULL), '[]'::json) AS versions
      FROM site_image_resources r
      LEFT JOIN site_image_versions v ON v.resource_id=r.id
      LEFT JOIN images i ON i.id=v.image_id
      GROUP BY r.id ORDER BY r.key`
  }

  async createResource(raw: unknown, admin: string) {
    const data = payload(raw)
    const key = text(data.key, '管理キー', 80)
    if (!RESOURCE_KEY.test(key)) throw new BadRequestException('管理キーは英小文字で始まるドット区切りの識別子にしてください。')
    const name = text(data.name, '画像リソース名', 100)
    const description = text(data.description ?? '', '説明', 500, true)
    try {
      const rows = await this.database.sql`
        INSERT INTO site_image_resources(key, name, description, created_by)
        VALUES (${key}, ${name}, ${description}, ${admin}) RETURNING id, key, name, description`
      await this.database.sql`UPDATE site_image_settings SET revision=revision+1, updated_at=clock_timestamp() WHERE singleton=true`
      return rows[0]
    } catch (error) { return duplicate(error) }
  }

  async updateResource(id: string, raw: unknown) {
    const data = payload(raw)
    const name = text(data.name, '画像リソース名', 100)
    const description = text(data.description ?? '', '説明', 500, true)
    const rows = await this.database.sql`
      UPDATE site_image_resources SET name=${name}, description=${description}
      WHERE id=${uuid(id)} RETURNING id, key, name, description`
    if (!rows.length) throw new NotFoundException('画像リソースが見つかりません。')
    return rows[0]
  }

  async createVersion(resourceId: string, raw: unknown, admin: string) {
    const data = payload(raw)
    const name = text(data.name, '画像名', 100)
    const note = text(data.note ?? '', 'メモ', 500, true)
    let image: ReturnType<typeof decodeSiteImage>
    try { image = decodeSiteImage(data) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '画像が不正です。') }
    try {
      return await this.database.sql.begin(async tx => {
        const resources = await tx`SELECT id FROM site_image_resources WHERE id=${uuid(resourceId)} FOR UPDATE`
        if (!resources.length) throw new NotFoundException('画像リソースが見つかりません。')
        const count = await tx`SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM site_image_versions WHERE resource_id=${resourceId}`
        const blobs = await tx`INSERT INTO images(purpose, data, mime_type, size, uploaded_by)
          VALUES ('site', ${image.data}, ${image.mime}, ${image.data.length}, ${admin}) RETURNING id`
        const versions = await tx`
          INSERT INTO site_image_versions(resource_id, version_number, name, note, image_id, uploaded_by)
          VALUES (${resourceId}, ${count[0].next}, ${name}, ${note}, ${blobs[0].id}, ${admin})
          RETURNING id, resource_id, version_number, name, note, created_at`
        return versions[0]
      })
    } catch (error) { return duplicate(error) }
  }

  async updateVersion(id: string, raw: unknown) {
    const data = payload(raw)
    const name = text(data.name, '画像名', 100)
    const note = text(data.note ?? '', 'メモ', 500, true)
    const rows = await this.database.sql`
      UPDATE site_image_versions SET name=${name}, note=${note} WHERE id=${uuid(id)}
      RETURNING id, resource_id, version_number, name, note, created_at`
    if (!rows.length) throw new NotFoundException('画像バージョンが見つかりません。')
    return rows[0]
  }

  async listPresets() {
    const settings = await this.database.sql`SELECT active_preset_id, revision FROM site_image_settings WHERE singleton=true`
    const presets = await this.database.sql`
      SELECT p.id, p.name, p.description, p.is_default, p.created_at,
        COALESCE(json_agg(json_build_object('resource_id', pi.resource_id, 'version_id', pi.version_id))
          FILTER (WHERE pi.resource_id IS NOT NULL), '[]'::json) AS items
      FROM site_image_presets p LEFT JOIN site_image_preset_items pi ON pi.preset_id=p.id
      GROUP BY p.id ORDER BY p.is_default DESC, p.created_at, p.id`
    return { active_preset_id: settings[0].active_preset_id, revision: settings[0].revision, presets }
  }

  async createPreset(raw: unknown, admin: string) {
    const data = payload(raw)
    const name = text(data.name, 'プリセット名', 100)
    const description = text(data.description ?? '', '説明', 500, true)
    const rows = await this.database.sql`
      INSERT INTO site_image_presets(name, description, created_by)
      VALUES (${name}, ${description}, ${admin}) RETURNING id, name, description, is_default, created_at`
    return rows[0]
  }

  async updatePreset(id: string, raw: unknown) {
    const data = payload(raw)
    const name = text(data.name, 'プリセット名', 100)
    const description = text(data.description ?? '', '説明', 500, true)
    const rows = await this.database.sql`
      UPDATE site_image_presets SET name=${name}, description=${description}
      WHERE id=${uuid(id)} AND NOT is_default
      RETURNING id, name, description, is_default, created_at`
    if (!rows.length) throw new NotFoundException('編集可能なプリセットが見つかりません。')
    return rows[0]
  }

  /** An absent row means inherit, while a row with NULL version means explicitly no image. */
  async setPresetItem(presetId: string, resourceId: string, raw: unknown) {
    const data = payload(raw)
    const mode = data.mode
    if (mode !== 'inherit' && mode !== 'none' && mode !== 'image') throw new BadRequestException('設定方法が不正です。')
    const versionId = mode === 'image' ? uuid(data.version_id) : null
    return this.database.sql.begin(async tx => {
      const settings = await tx`SELECT active_preset_id FROM site_image_settings WHERE singleton=true FOR UPDATE`
      const presets = await tx`SELECT id, is_default FROM site_image_presets WHERE id=${uuid(presetId)}`
      if (!presets.length) throw new NotFoundException('プリセットが見つかりません。')
      const resources = await tx`SELECT id FROM site_image_resources WHERE id=${uuid(resourceId)}`
      if (!resources.length) throw new NotFoundException('画像リソースが見つかりません。')
      if (versionId) {
        const versions = await tx`SELECT id FROM site_image_versions WHERE id=${versionId} AND resource_id=${resourceId}`
        if (!versions.length) throw new BadRequestException('このリソースに属さない画像です。')
      }
      if (mode === 'inherit' || (mode === 'none' && presets[0].is_default)) {
        await tx`DELETE FROM site_image_preset_items WHERE preset_id=${presetId} AND resource_id=${resourceId}`
      } else {
        await tx`INSERT INTO site_image_preset_items(preset_id, resource_id, version_id)
          VALUES (${presetId}, ${resourceId}, ${versionId})
          ON CONFLICT (preset_id, resource_id) DO UPDATE SET version_id=EXCLUDED.version_id`
      }
      if (settings[0].active_preset_id === presetId || presets[0].is_default) {
        await tx`UPDATE site_image_settings SET revision=revision+1, updated_at=clock_timestamp() WHERE singleton=true`
      }
      return { mode, version_id: versionId }
    })
  }

  async applyPreset(id: string, admin: string) {
    return this.database.sql.begin(async tx => {
      const settings = await tx`SELECT active_preset_id, revision FROM site_image_settings WHERE singleton=true FOR UPDATE`
      const presets = await tx`SELECT id FROM site_image_presets WHERE id=${uuid(id)}`
      if (!presets.length) throw new NotFoundException('プリセットが見つかりません。')
      const previous = String(settings[0].active_preset_id)
      if (previous === id) return { active_preset_id: id, revision: settings[0].revision }
      const changed = await tx`UPDATE site_image_settings SET active_preset_id=${id}, revision=revision+1,
        updated_at=clock_timestamp() WHERE singleton=true RETURNING revision`
      await tx`INSERT INTO site_image_preset_events(previous_preset_id, next_preset_id, applied_by)
        VALUES (${previous}, ${id}, ${admin})`
      return { active_preset_id: id, revision: changed[0].revision }
    })
  }

  async history() {
    return this.database.sql`
      SELECT e.id, e.previous_preset_id, old.name AS previous_name,
        e.next_preset_id, next.name AS next_name, e.applied_by, e.applied_at
      FROM site_image_preset_events e
      JOIN site_image_presets old ON old.id=e.previous_preset_id
      JOIN site_image_presets next ON next.id=e.next_preset_id
      ORDER BY e.applied_at DESC, e.id DESC LIMIT 100`
  }

  private async resolved(key?: string, bytes = false) {
    // Prefer an explicit event override (even NULL), otherwise inherit the default row.
    if (bytes) {
      if (key === undefined) throw new BadRequestException('画像キーが指定されていません。')
      return this.database.sql`
        SELECT r.key, v.id AS version_id, v.static_path, i.mime_type, i.data
        FROM site_image_resources r CROSS JOIN site_image_settings s
        CROSS JOIN site_image_presets p
        LEFT JOIN site_image_preset_items base ON base.preset_id=p.id AND base.resource_id=r.id
        LEFT JOIN site_image_preset_items active ON active.preset_id=s.active_preset_id AND active.resource_id=r.id
        LEFT JOIN site_image_versions v ON v.id=CASE WHEN active.preset_id IS NOT NULL THEN active.version_id ELSE base.version_id END
        LEFT JOIN images i ON i.id=v.image_id
        WHERE s.singleton AND p.is_default AND r.key=${key}`
    }
    return this.database.sql`
      SELECT r.key, v.id AS version_id, v.static_path, i.mime_type
      FROM site_image_resources r CROSS JOIN site_image_settings s
      CROSS JOIN site_image_presets p
      LEFT JOIN site_image_preset_items base ON base.preset_id=p.id AND base.resource_id=r.id
      LEFT JOIN site_image_preset_items active ON active.preset_id=s.active_preset_id AND active.resource_id=r.id
      LEFT JOIN site_image_versions v ON v.id=CASE WHEN active.preset_id IS NOT NULL THEN active.version_id ELSE base.version_id END
      LEFT JOIN images i ON i.id=v.image_id
      WHERE s.singleton AND p.is_default ${key === undefined ? this.database.sql`` : this.database.sql`AND r.key=${key}`}
      ORDER BY r.key`
  }

  async manifest() {
    const settings = await this.database.sql`SELECT revision, active_preset_id FROM site_image_settings WHERE singleton=true`
    const rows = await this.resolved()
    const images: Record<string, { version_id: string; static_path: string | null } | null> = {}
    for (const row of rows) {
      images[String(row.key)] = row.version_id ? { version_id: String(row.version_id), static_path: row.static_path ?? null } : null
    }
    return { revision: settings[0].revision, active_preset_id: settings[0].active_preset_id, images }
  }

  async serve(key: string, req: any, res: any): Promise<void> {
    if (!RESOURCE_KEY.test(key) || key.length > 80) throw new NotFoundException('画像が見つかりません。')
    const rows = await this.resolved(key, true)
    if (!rows.length || !rows[0].version_id) throw new NotFoundException('画像が設定されていません。')
    return this.respond(rows[0], req, res, true)
  }

  async preview(id: string, req: any, res: any): Promise<void> {
    const rows = await this.database.sql`
      SELECT v.id AS version_id, v.static_path, i.mime_type, i.data
      FROM site_image_versions v LEFT JOIN images i ON i.id=v.image_id WHERE v.id=${uuid(id)}`
    if (!rows.length) throw new NotFoundException('画像が見つかりません。')
    return this.respond(rows[0], req, res, false)
  }

  private respond(row: any, req: any, res: any, publicImage: boolean): void {
    if (row.static_path) {
      res.setHeader('Cache-Control', publicImage ? 'public, max-age=0, must-revalidate' : 'private, no-store')
      res.redirect(302, absoluteStaticUrl(String(row.static_path)))
      return
    }
    if (!row.data || !row.mime_type) throw new NotFoundException('画像が見つかりません。')
    const id = String(row.version_id)
    imageHeaders(res, String(row.mime_type), id, publicImage)
    if (publicImage && req.headers['if-none-match'] === `"${id}"`) { res.status(304).end(); return }
    res.setHeader('Content-Length', Buffer.byteLength(row.data))
    res.status(200).end(row.data)
  }
}
