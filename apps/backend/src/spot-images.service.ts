import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { decodeSiteImage } from './site-image-validation.js'
import { uuid } from './notice-validation.js'

@Injectable()
export class SpotImagesService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout
  constructor(private readonly database: Database, private readonly auth: AuthService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.cleanup().catch(console.error), 60 * 60 * 1000)
    this.timer.unref()
    return this.cleanup()
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer) }

  async cleanup() {
    await this.database.sql`DELETE FROM images i WHERE i.purpose='spot' AND i.upload_session_id IS NOT NULL
      AND i.upload_expires_at < now() AND NOT EXISTS (SELECT 1 FROM spot_images si WHERE si.image_id=i.id)
      AND NOT EXISTS (SELECT 1 FROM spots s WHERE s.main_image_id=i.id)`
  }

  async upload(data: Buffer, mime: string, admin: string) {
    if (data.length > 5 * 1024 * 1024) throw new BadRequestException('画像は5MB以内にしてください。')
    let image: ReturnType<typeof decodeSiteImage>
    try { image = decodeSiteImage({ file_bytes: data, mime_type: mime }) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '画像が不正です。') }
    if (image.mime === 'image/svg+xml') throw new BadRequestException('JPEG、PNG、WebPを使用してください。')
    const rows = await this.database.sql`INSERT INTO images(purpose,data,mime_type,size,uploaded_by,upload_session_id,upload_expires_at)
      VALUES('spot',${image.data},${image.mime},${image.data.length},${admin},gen_random_uuid(),now()+interval '24 hours') RETURNING id`
    const id = String(rows[0].id)
    return { id, url: (process.env.PUBLIC_API_BASE ?? 'http://localhost:3001/api').replace(/\/$/, '') + '/spot-images/' + id }
  }

  /** Called from an authorized spot transaction, after the spot row is locked. */
  async attach(tx: any, id: string, spotId: string, admin: string) {
    const rows = await tx`SELECT id,uploaded_by,upload_session_id,purpose,upload_expires_at
      FROM images WHERE id=${uuid(id)} FOR UPDATE`
    if (!rows.length || rows[0].purpose !== 'spot') throw new BadRequestException('スポット画像が見つかりません。')
    const owned = await tx`SELECT 1 FROM spots s WHERE s.id=${spotId} AND
      (s.main_image_id=${id} OR EXISTS(SELECT 1 FROM spot_images si WHERE si.spot_id=s.id AND si.image_id=${id}))`
    if (!owned.length && (String(rows[0].uploaded_by) !== admin ||
      !rows[0].upload_session_id || new Date(rows[0].upload_expires_at).getTime() <= Date.now())) {
      throw new ForbiddenException('他の記事の画像、または有効期限切れの画像は使用できません。')
    }
    if (rows[0].upload_session_id) {
      await tx`UPDATE images SET upload_session_id=NULL,upload_expires_at=NULL WHERE id=${id}`
    }
  }

  async serve(id: string, req: any, res: any) {
    const records = await this.database.sql`SELECT i.data,i.mime_type,i.uploaded_by,i.upload_session_id,
      EXISTS(SELECT 1 FROM spots s WHERE s.main_image_id=i.id AND s.status='published') OR
      EXISTS(SELECT 1 FROM spot_images si JOIN spots s ON s.id=si.spot_id
        WHERE si.image_id=i.id AND s.status='published') AS visible
      FROM images i WHERE i.id=${uuid(id)} AND i.purpose='spot'`
    if (!records.length) throw new NotFoundException('画像が見つかりません。')
    const image = records[0]
    if (!image.visible) {
      const admin = await this.auth.requireAdmin(req)
      if (image.upload_session_id && String(image.uploaded_by) !== admin) throw new ForbiddenException('他の管理者の一時画像です。')
    }
    res.setHeader('Content-Type', image.mime_type)
    res.setHeader('Content-Length', image.data.length)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', image.visible ? 'public, max-age=0, must-revalidate' : 'private, no-store')
    res.end(image.data)
  }
}
