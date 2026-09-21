import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'

@Injectable()
export class AccountsService {
  constructor(private readonly database: Database) {}

  async list() {
    return this.database.sql`
      SELECT a.id, a.created_at,
        EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='admin') AS is_admin,
        COALESCE((SELECT json_agg(i.discord_id ORDER BY i.discord_id)
          FROM account_discord_identities i WHERE i.account_id=a.id), '[]'::json) AS discord_ids
      FROM accounts a ORDER BY a.created_at, a.id`
  }

  async setAdmin(accountRaw: string, enabled: unknown) {
    const id = uuid(accountRaw)
    if (typeof enabled !== 'boolean') throw new BadRequestException('is_admin must be boolean')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const accounts = await tx`SELECT id FROM accounts WHERE id=${id} FOR UPDATE`
      if (!accounts.length) throw new NotFoundException('Account not found')
      if (enabled) {
        await tx`INSERT INTO account_roles(account_id, role) VALUES (${id}, 'admin') ON CONFLICT DO NOTHING`
      } else {
        const exists = await tx`SELECT 1 FROM account_roles WHERE account_id=${id} AND role='admin'`
        if (!exists.length) return
        const admins = await tx`SELECT COUNT(*)::INTEGER AS count FROM account_roles WHERE role='admin'`
        if (Number(admins[0].count) <= 1) throw new ConflictException('Cannot remove the final administrator')
        await tx`DELETE FROM account_roles WHERE account_id=${id} AND role='admin'`
      }
    })
    return this.list()
  }

  async merge(targetRaw: unknown, sourceRaw: unknown) {
    const target = uuid(targetRaw), source = uuid(sourceRaw)
    if (target === source) throw new BadRequestException('Choose two different accounts')
    await this.database.sql.begin(async tx => {
      // Align lock ordering with OAuth bootstrap and role mutation.
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const records = await tx`SELECT id FROM accounts WHERE id IN (${target}, ${source}) FOR UPDATE`
      if (records.length !== 2) throw new NotFoundException('Both accounts must exist')
      // Merge roles before source deletion. The destination inherits administrator rights.
      await tx`INSERT INTO account_roles(account_id, role)
        SELECT ${target}, role FROM account_roles WHERE account_id=${source}
        ON CONFLICT DO NOTHING`
      await tx`UPDATE account_discord_identities SET account_id=${target} WHERE account_id=${source}`
      await tx`UPDATE images SET uploaded_by=${target} WHERE uploaded_by=${source}`
      // No session may continue with a deleted account. Destination sessions remain usable.
      await tx`DELETE FROM account_sessions WHERE account_id=${source}`
      await tx`DELETE FROM accounts WHERE id=${source}`
    })
    return this.list()
  }
}
