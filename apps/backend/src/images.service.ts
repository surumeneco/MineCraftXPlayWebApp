import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Database } from './database.js'
import { AuthService } from './auth.service.js'
import { uuid } from './notice-validation.js'

const maxImageBytes = 5 * 1024 * 1024
const expiryHours = 24

function actualMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

@Injectable()
export class ImagesService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout
  constructor(private readonly database: Database, private readonly auth: AuthService) {}

  async onModuleInit(): Promise<void> {
    await this.cleanup()
    this.timer = setInterval(() => void this.cleanup().catch(console.error), 60 * 60 * 1000)
    this.timer.unref()
  }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer) }

  async cleanup(): Promise<void> {
    await this.database.sql`DELETE FROM images WHERE upload_session_id IS NOT NULL
      AND upload_expires_at < now() AND NOT EXISTS (SELECT 1 FROM notice_images ni WHERE ni.image_id=images.id)`
  }

  async upload(payload: any, adminId: string) {
    if (!payload || typeof payload !== 'object') throw new BadRequestException('Invalid image payload')
    const session = uuid(payload.upload_session_id)
    if (payload.purpose !== undefined && payload.purpose !== 'notice') throw new BadRequestException('Only notice images can be uploaded')
    const encoded = payload.data_base64
    if (typeof encoded !== 'string' || encoded.length > Math.ceil(maxImageBytes / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new BadRequestException('Invalid image data or image is too large')
    }
    const data = Buffer.from(encoded, 'base64')
    if (data.length < 1 || data.length > maxImageBytes || data.toString('base64') !== encoded) throw new BadRequestException('Invalid image data')
    const mime = actualMime(data)
    if (!mime || mime !== payload.mime_type) throw new BadRequestException('Unsupported image format or MIME mismatch')
    const rows = await this.database.sql`
      INSERT INTO images (purpose, data, mime_type, size, uploaded_by, upload_session_id, upload_expires_at)
      VALUES ('notice', ${data}, ${mime}, ${data.length}, ${adminId}, ${session}, now() + interval '24 hours')
      RETURNING id`
    const id = String(rows[0].id)
    return { id, url: `${(process.env.PUBLIC_API_BASE ?? 'http://localhost:3001/api').replace(/\/$/, '')}/images/${id}`,
      upload_session_id: session, expires_in_hours: expiryHours }
  }

  async removeTemporary(id: string, admin: string): Promise<void> {
    const rows = await this.database.sql`DELETE FROM images
      WHERE id=${uuid(id)} AND uploaded_by=${admin} AND upload_session_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM notice_images WHERE image_id=images.id) RETURNING id`
    if (!rows.length) throw new ConflictException('Only owned temporary images can be deleted')
  }

  async discardSession(session: string, admin: string): Promise<void> {
    await this.database.sql`DELETE FROM images WHERE upload_session_id=${uuid(session)} AND uploaded_by=${admin}
      AND NOT EXISTS (SELECT 1 FROM notice_images WHERE image_id=images.id)`
  }

  async refreshSession(session: string, admin: string): Promise<void> {
    await this.database.sql`UPDATE images SET upload_expires_at=now() + interval '24 hours'
      WHERE upload_session_id=${uuid(session)} AND uploaded_by=${admin}
        AND NOT EXISTS (SELECT 1 FROM notice_images WHERE image_id=images.id)`
  }

  async sendImage(id: string, req: any, res: any): Promise<void> {
    const rows = await this.database.sql`
      SELECT i.data, i.mime_type, i.uploaded_by, i.upload_session_id, n.status
      FROM images i LEFT JOIN notice_images ni ON ni.image_id=i.id
      LEFT JOIN notices n ON n.id=ni.notice_id WHERE i.id=${uuid(id)} LIMIT 1`
    if (!rows.length) throw new NotFoundException('Image not found')
    const image = rows[0]
    if (image.status !== 'published') {
      const admin = await this.auth.requireAdmin(req)
      if (image.upload_session_id && admin !== image.uploaded_by) throw new ForbiddenException('Temporary image belongs to another user')
    }
    res.setHeader('Content-Type', image.mime_type)
    res.setHeader('Content-Length', Buffer.byteLength(image.data))
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Disposition', 'inline')
    res.status(200).end(image.data)
  }
}
