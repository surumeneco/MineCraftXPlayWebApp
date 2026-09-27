import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { uuid } from './notice-validation.js'
import { decodeSiteImage } from './site-image-validation.js'

@Injectable()
export class CompanyImagesService {
  constructor(private readonly database: Database, private readonly auth: AuthService) {}

  async upload(bytes: Buffer, mime: string, accountId: string) {
    let validated: ReturnType<typeof decodeSiteImage>
    try { validated = decodeSiteImage({ file_bytes: bytes, mime_type: mime }) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '画像データが不正です。') }
    const rows = await this.database.sql`INSERT INTO images(purpose,data,mime_type,size,uploaded_by,upload_session_id,upload_expires_at)
      VALUES ('company',${validated.data},${validated.mime},${validated.data.length},
        ${accountId},${randomUUID()},now()+interval '24 hours') RETURNING id`
    return { image_id: String(rows[0].id) }
  }

  async attach(tx: any, imageRaw: unknown, companyId: string, actorId: string): Promise<string | null> {
    if (imageRaw === null) return null
    const imageId = uuid(imageRaw)
    const rows = await tx`SELECT id,uploaded_by,upload_session_id,upload_expires_at,purpose
      FROM images WHERE id=${imageId} FOR UPDATE`
    if (!rows.length || rows[0].purpose !== 'company') throw new BadRequestException('企業画像が見つかりません。')
    const belongs = await tx`SELECT 1 FROM companies WHERE id=${companyId} AND current_image_id=${imageId}`
    if (String(rows[0].uploaded_by) !== actorId && !belongs.length) {
      throw new ForbiddenException('他の利用者の画像は指定できません。')
    }
    if (rows[0].upload_session_id) {
      if (String(rows[0].uploaded_by) !== actorId || new Date(rows[0].upload_expires_at).getTime() <= Date.now()) {
        throw new ForbiddenException('期限切れまたは他の利用者の画像です。')
      }
      await tx`UPDATE images SET upload_session_id=NULL,upload_expires_at=NULL WHERE id=${imageId}`
    }
    return imageId
  }

  async serve(idRaw: unknown, req: any, res: any) {
    const imageId = uuid(idRaw)
    const rows = await this.database.sql`SELECT i.data,i.mime_type,i.uploaded_by,
      EXISTS(SELECT 1 FROM companies c WHERE c.current_image_id=i.id AND c.approved_at IS NOT NULL) AS visible
      FROM images i WHERE i.id=${imageId} AND i.purpose='company'`
    if (!rows.length) throw new NotFoundException('企業画像が見つかりません。')
    const row = rows[0]
    if (!row.visible) {
      const session = await this.auth.info(req)
      const owns = await this.database.sql`SELECT 1 FROM companies c
        WHERE c.current_image_id=${imageId} AND
          (c.applicant_account_id=${session.account_id ?? null} OR c.representative_account_id=${session.account_id ?? null})`
      if (!session.is_admin && session.account_id !== String(row.uploaded_by) && !owns.length) {
        throw new ForbiddenException('画像を閲覧できません。')
      }
    }
    res.setHeader('Content-Type',row.mime_type)
    res.setHeader('Content-Length',row.data.length)
    res.setHeader('Content-Disposition','inline')
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Cache-Control',row.visible?'public, max-age=0, must-revalidate':'private, no-store')
    if (row.mime_type === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; base-uri 'none'; form-action 'none'")
    }
    res.end(row.data)
  }
}
