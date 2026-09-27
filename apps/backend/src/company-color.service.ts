import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'
import { channel, randomVividColor, type MapColor } from './account-color.service.js'

@Injectable()
export class CompanyColorService {
  constructor(private readonly database: Database) {}

  async ensure(companyRaw: unknown, sql: any = this.database.sql): Promise<MapColor> {
    const companyId = uuid(companyRaw)
    let rows = await sql`SELECT red,green,blue FROM company_bluemap_colors WHERE company_id=${companyId}`
    if (!rows.length) {
      const companies = await sql`SELECT id FROM companies WHERE id=${companyId}`
      if (!companies.length) throw new NotFoundException('企業が見つかりません。')
      const generated = randomVividColor()
      await sql`INSERT INTO company_bluemap_colors(company_id,red,green,blue)
        VALUES (${companyId},${generated.r},${generated.g},${generated.b})
        ON CONFLICT (company_id) DO NOTHING`
      rows = await sql`SELECT red,green,blue FROM company_bluemap_colors WHERE company_id=${companyId}`
    }
    return { r: Number(rows[0].red), g: Number(rows[0].green), b: Number(rows[0].blue) }
  }

  async set(companyRaw: unknown, value: unknown, sql: any = this.database.sql): Promise<MapColor> {
    const companyId = uuid(companyRaw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid map color')
    }
    const raw = value as Record<string, unknown>
    const next = { r: channel(raw.r,'red'), g: channel(raw.g,'green'), b: channel(raw.b,'blue') }
    await sql`INSERT INTO company_bluemap_colors(company_id,red,green,blue,updated_at)
      VALUES (${companyId},${next.r},${next.g},${next.b},clock_timestamp())
      ON CONFLICT (company_id) DO UPDATE
      SET red=EXCLUDED.red,green=EXCLUDED.green,blue=EXCLUDED.blue,updated_at=clock_timestamp()`
    return next
  }
}
