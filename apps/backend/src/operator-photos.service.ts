import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { decodeSiteImage } from './site-image-validation.js'

@Injectable()
export class OperatorPhotosService {
  constructor(private readonly database: Database) {}

  async mine(accountId: string) {
    return this.database.sql`
      SELECT member_key, minecraft_name, image_id, static_path
      FROM operator_members WHERE account_id=${accountId} ORDER BY member_key`
  }

  async upload(memberKey: string, accountId: string, bytes: Buffer, mime: string) {
    let photo: ReturnType<typeof decodeSiteImage>
    try { photo = decodeSiteImage({ mime_type: mime, file_bytes: bytes }) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : '画像が不正です。') }
    return this.database.sql.begin(async tx => {
      const member = await tx`SELECT member_key FROM operator_members WHERE member_key=${memberKey} AND account_id=${accountId} FOR UPDATE`
      if (!member.length) throw new ForbiddenException('この紹介画像を編集する権限がありません。')
      const inserted = await tx`
        INSERT INTO images(purpose, data, mime_type, size, uploaded_by)
        VALUES ('operator_photo', ${photo.data}, ${photo.mime}, ${photo.data.length}, ${accountId})
        RETURNING id`
      await tx`UPDATE operator_members SET image_id=${inserted[0].id},static_path=NULL WHERE member_key=${memberKey}`
      return { member_key: memberKey, image_id: inserted[0].id, static_path: null }
    })
  }

  async clear(memberKey: string, accountId: string) {
    const updated = await this.database.sql`UPDATE operator_members SET image_id=NULL,static_path=NULL
      WHERE member_key=${memberKey} AND account_id=${accountId} RETURNING member_key,image_id,static_path`
    if (!updated.length) throw new ForbiddenException('この紹介画像を編集する権限がありません。')
    return updated[0]
  }

  async serve(memberKey: string, req: any, res: any) {
    if (!/^[a-z0-9_-]{1,80}$/.test(memberKey)) throw new NotFoundException('紹介画像が見つかりません。')
    const rows = await this.database.sql`
      SELECT o.image_id,o.static_path,i.mime_type,i.data
      FROM operator_members o LEFT JOIN images i ON i.id=o.image_id WHERE o.member_key=${memberKey}`
    if (!rows.length || (!rows[0].image_id && !rows[0].static_path)) throw new NotFoundException('紹介画像が設定されていません。')
    const row = rows[0]
    if (row.static_path) {
      const origin = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '')
      res.setHeader('Cache-Control','public,max-age=0,must-revalidate')
      res.redirect(302, `${origin}${row.static_path}`)
      return
    }
    if (!row.data || !row.mime_type) throw new NotFoundException('紹介画像が見つかりません。')
    res.setHeader('Content-Type',row.mime_type)
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('Content-Disposition','inline')
    res.setHeader('Cache-Control','public,max-age=300')
    if (row.mime_type === 'image/svg+xml') res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'; base-uri 'none'; form-action 'none'")
    res.status(200).end(row.data)
  }
}
