import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'

export type MapColor = { r: number; g: number; b: number }

function channel(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255) {
    throw new BadRequestException(`${name} must be an integer from 0 to 255`)
  }
  return value
}

function randomVividColor(): MapColor {
  const hue = randomInt(360)
  const c = 1
  const x = 1 - Math.abs((hue / 60) % 2 - 1)
  let [r, g, b] = [0, 0, 0]
  if (hue < 60) [r, g] = [c, x]
  else if (hue < 120) [r, g] = [x, c]
  else if (hue < 180) [g, b] = [c, x]
  else if (hue < 240) [g, b] = [x, c]
  else if (hue < 300) [r, b] = [x, c]
  else [r, b] = [c, x]
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

@Injectable()
export class AccountColorService {
  constructor(private readonly database: Database) {}

  async ensure(accountRaw: unknown): Promise<MapColor> {
    const accountId = uuid(accountRaw)
    const exists = await this.database.sql`SELECT id FROM accounts WHERE id=${accountId}
      AND NOT EXISTS (SELECT 1 FROM account_merges m WHERE m.source_account_id=${accountId} AND m.restored_at IS NULL)`
    if (!exists.length) throw new NotFoundException('Account not found')
    let rows = await this.database.sql`SELECT red, green, blue FROM account_bluemap_colors WHERE account_id=${accountId}`
    if (!rows.length) {
      const color = randomVividColor()
      await this.database.sql`INSERT INTO account_bluemap_colors(account_id,red,green,blue)
        VALUES (${accountId},${color.r},${color.g},${color.b}) ON CONFLICT (account_id) DO NOTHING`
      rows = await this.database.sql`SELECT red, green, blue FROM account_bluemap_colors WHERE account_id=${accountId}`
    }
    return { r: Number(rows[0].red), g: Number(rows[0].green), b: Number(rows[0].blue) }
  }

  async set(accountRaw: unknown, value: unknown): Promise<MapColor> {
    const accountId = uuid(accountRaw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid map color')
    const raw = value as Record<string, unknown>
    const color = { r: channel(raw.r, 'red'), g: channel(raw.g, 'green'), b: channel(raw.b, 'blue') }
    const exists = await this.database.sql`SELECT id FROM accounts WHERE id=${accountId}
      AND NOT EXISTS (SELECT 1 FROM account_merges m WHERE m.source_account_id=${accountId} AND m.restored_at IS NULL)`
    if (!exists.length) throw new NotFoundException('Account not found')
    await this.database.sql`INSERT INTO account_bluemap_colors(account_id,red,green,blue,updated_at)
      VALUES (${accountId},${color.r},${color.g},${color.b},clock_timestamp())
      ON CONFLICT (account_id) DO UPDATE SET red=EXCLUDED.red,green=EXCLUDED.green,blue=EXCLUDED.blue,updated_at=clock_timestamp()`
    return color
  }
}
