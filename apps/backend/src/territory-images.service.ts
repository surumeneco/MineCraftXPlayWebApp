import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { uuid } from './notice-validation.js'
import { decodeSiteImage } from './site-image-validation.js'

/**
 * Territory illustrations use the immutable image blob store, not site-image
 * resources or presets.  Unattached uploads expire after 24 hours; attaching
 * an image removes its temporary upload state.
 */
@Injectable()
export class TerritoryImagesService {
  constructor(private readonly database: Database, private readonly auth: AuthService) {}

  async upload(bytes: Buffer, mime: string, accountId: string) {
    let validated: ReturnType<typeof decodeSiteImage>
    try { validated = decodeSiteImage({ file_bytes: bytes, mime_type: mime }) }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '画像データが不正です。')
    }
    const rows = await this.database.sql`
      INSERT INTO images(purpose,data,mime_type,size,uploaded_by,upload_session_id,upload_expires_at)
      VALUES ('territory',${validated.data},${validated.mime},${validated.data.length},
        ${accountId},${randomUUID()},now()+interval '24 hours') RETURNING id`
    return { image_id: String(rows[0].id) }
  }

  /**
   * Call only inside the territory write transaction after checking permission.
   * A retained image belonging to the same territory is legal after an owner
   * transfer; an unrelated user's upload is not.
   */
  async attach(tx: any, imageRaw: unknown, territoryId: string, actorId: string): Promise<string | null> {
    if (imageRaw === null) return null
    const imageId = uuid(imageRaw)
    const rows = await tx`SELECT id,uploaded_by,upload_session_id,purpose FROM images WHERE id=${imageId} FOR UPDATE`
    if (!rows.length || rows[0].purpose !== 'territory') throw new BadRequestException('領地画像が見つかりません。')
    const belongs = await tx`SELECT 1 FROM territories t
      WHERE t.id=${territoryId} AND (
        t.current_image_id=${imageId} OR EXISTS (
          SELECT 1 FROM territory_applications a WHERE a.territory_id=t.id AND a.image_id=${imageId}
        )
      ) LIMIT 1`
    if (String(rows[0].uploaded_by) !== actorId && !belongs.length) throw new ForbiddenException('他の利用者の画像は指定できません。')
    if (rows[0].upload_session_id) {
      if (String(rows[0].uploaded_by) !== actorId) throw new ForbiddenException('他の利用者の一時画像は指定できません。')
      await tx`UPDATE images SET upload_session_id=NULL,upload_expires_at=NULL WHERE id=${imageId}`
    }
    return imageId
  }

  async serve(idRaw: unknown, req: any, res: any) {
    const imageId = uuid(idRaw)
    const rows = await this.database.sql`SELECT i.data,i.mime_type,i.uploaded_by,i.upload_session_id,
      EXISTS(SELECT 1 FROM territories t WHERE t.current_image_id=i.id) AS is_current,
      EXISTS(SELECT 1 FROM territory_applications a
        JOIN territories t ON t.id=a.territory_id
        WHERE a.image_id=i.id AND a.status IN ('approved','pending')
          AND t.status IN ('approved','pending')) AS is_application
      FROM images i WHERE i.id=${imageId} AND i.purpose='territory'`
    if (!rows.length) throw new NotFoundException('領地画像が見つかりません。')
    const row = rows[0]
    const visible = row.is_current || row.is_application
    if (!visible) {
      const session = await this.auth.info(req)
      if (!session.is_admin && session.account_id !== String(row.uploaded_by)) throw new ForbiddenException('画像を閲覧できません。')
    }
    res.setHeader('Content-Type', row.mime_type)
    res.setHeader('Content-Length', row.data.length)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', visible ? 'public, max-age=0, must-revalidate' : 'private, no-store')
    if (row.mime_type === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'")
    }
    res.end(row.data)
  }
}
