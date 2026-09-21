import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'

const initialDiscordIds = () => new Set((process.env.ADMIN_DISCORD_IDS ?? '').split(',').map(value => value.trim()).filter(Boolean))
const validName = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new BadRequestException('Account name must contain 1 to 100 characters')
  }
  return value.trim()
}

@Injectable()
export class AccountsService {
  constructor(private readonly database: Database) {}

  async list() {
    const rows = await this.database.sql`
      SELECT a.id, a.name, a.created_at,
        EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=a.id AND r.role='admin') AS is_admin,
        COALESCE((SELECT json_agg(i.discord_id ORDER BY i.discord_id)
          FROM account_discord_identities i WHERE i.account_id=a.id), '[]'::json) AS discord_ids,
        COALESCE((SELECT json_agg(json_build_object('discord_id', i.discord_id, 'username', i.username,
          'display_name', i.display_name) ORDER BY i.discord_id)
          FROM account_discord_identities i WHERE i.account_id=a.id), '[]'::json) AS discord_profiles,
        COALESCE((SELECT json_agg(json_build_object('id', m.id, 'edition', m.edition,
          'username', m.username) ORDER BY m.edition, m.username)
          FROM account_minecraft_identities m WHERE m.account_id=a.id), '[]'::json) AS minecraft_ids
      FROM accounts a ORDER BY a.created_at, a.id`
    const protectedIds = initialDiscordIds()
    return rows.map(row => ({ ...row, is_protected: Boolean(row.is_admin) &&
      (row.discord_ids as string[]).some(id => protectedIds.has(id)) }))
  }

  async get(accountRaw: unknown) {
    const id = uuid(accountRaw)
    const account = (await this.list()).find(row => String(row.id) === id)
    if (!account) throw new NotFoundException('Account not found')
    return account
  }

  async rename(accountRaw: unknown, nameRaw: unknown) {
    const id = uuid(accountRaw), name = validName(nameRaw)
    const updated = await this.database.sql`UPDATE accounts SET name=${name} WHERE id=${id} RETURNING id`
    if (!updated.length) throw new NotFoundException('Account not found')
    return this.get(id)
  }

  async adoptDiscordName(accountRaw: unknown, discordRaw: unknown) {
    const id = uuid(accountRaw)
    if (typeof discordRaw !== 'string' || !/^\d{15,22}$/.test(discordRaw)) throw new BadRequestException('Invalid Discord ID')
    const rows = await this.database.sql`SELECT display_name, username FROM account_discord_identities WHERE account_id=${id} AND discord_id=${discordRaw}`
    if (!rows.length) throw new NotFoundException('Discord identity not linked')
    return this.rename(id, rows[0].display_name || rows[0].username || discordRaw)
  }

  async addMinecraft(accountRaw: unknown, editionRaw: unknown, usernameRaw: unknown) {
    const id = uuid(accountRaw)
    if (editionRaw !== 'je' && editionRaw !== 'be') throw new BadRequestException('Edition must be je or be')
    if (typeof usernameRaw !== 'string') throw new BadRequestException('Invalid Minecraft name')
    const username = usernameRaw.trim()
    if (!username || username.length > 32 || /[\u0000-\u001f\u007f]/.test(username) ||
        (editionRaw === 'je' && !/^[A-Za-z0-9_]{3,16}$/.test(username))) {
      throw new BadRequestException('Invalid Minecraft name')
    }
    const exists = await this.database.sql`SELECT id FROM accounts WHERE id=${id}`
    if (!exists.length) throw new NotFoundException('Account not found')
    try {
      await this.database.sql`INSERT INTO account_minecraft_identities(account_id, edition, username)
        VALUES (${id}, ${editionRaw}, ${username})`
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Minecraft name is already linked')
      throw error
    }
    return this.get(id)
  }

  async removeMinecraft(accountRaw: unknown, identityRaw: unknown) {
    const id = uuid(accountRaw), identity = uuid(identityRaw)
    const removed = await this.database.sql`DELETE FROM account_minecraft_identities WHERE id=${identity} AND account_id=${id} RETURNING id`
    if (!removed.length) throw new NotFoundException('Minecraft identity not found')
    return this.get(id)
  }

  async addDiscord(accountRaw: unknown, discordRaw: unknown) {
    const id = uuid(accountRaw)
    if (typeof discordRaw !== 'string' || !/^\d{15,22}$/.test(discordRaw)) throw new BadRequestException('Invalid Discord ID')
    try {
      await this.database.sql`INSERT INTO account_discord_identities(discord_id, account_id, username, display_name)
        VALUES (${discordRaw}, ${id}, ${discordRaw}, ${discordRaw})`
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Discord identity is already linked')
      if ((error as { code?: string }).code === '23503') throw new NotFoundException('Account not found')
      throw error
    }
    return this.get(id)
  }

  async removeDiscord(accountRaw: unknown, discordRaw: unknown) {
    const id = uuid(accountRaw)
    if (typeof discordRaw !== 'string' || !/^\d{15,22}$/.test(discordRaw)) throw new BadRequestException('Invalid Discord ID')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const identities = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${id} FOR UPDATE`
      if (!identities.some(row => row.discord_id === discordRaw)) throw new NotFoundException('Discord identity not found')
      if (initialDiscordIds().has(discordRaw)) throw new ConflictException('Cannot detach a protected initial administrator identity')
      if (identities.length <= 1) throw new ConflictException('Cannot remove the last Discord identity')
      await tx`DELETE FROM account_discord_identities WHERE account_id=${id} AND discord_id=${discordRaw}`
      await tx`DELETE FROM account_sessions WHERE account_id=${id}`
    })
    return this.get(id)
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
        const protectedIds = [...initialDiscordIds()]
        const linked = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${id}`
        if (linked.some(row => protectedIds.includes(row.discord_id as string))) {
          throw new ConflictException('Cannot revoke a protected initial administrator')
        }
        const admins = await tx`SELECT COUNT(*)::INTEGER AS count FROM account_roles WHERE role='admin'`
        if (Number(admins[0].count) <= 1) throw new ConflictException('Cannot remove the final administrator')
        await tx`DELETE FROM account_roles WHERE account_id=${id} AND role='admin'`
      }
    })
    return this.list()
  }

  async remove(accountRaw: unknown) {
    const id = uuid(accountRaw)
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const existing = await tx`SELECT id FROM accounts WHERE id=${id} FOR UPDATE`
      if (!existing.length) throw new NotFoundException('Account not found')
      const identities = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${id}`
      if (identities.some(row => initialDiscordIds().has(row.discord_id as string))) {
        throw new ConflictException('Cannot delete a protected initial administrator')
      }
      const role = await tx`SELECT 1 FROM account_roles WHERE account_id=${id} AND role='admin'`
      if (role.length) {
        const admins = await tx`SELECT COUNT(*)::INTEGER AS count FROM account_roles WHERE role='admin'`
        if (Number(admins[0].count) <= 1) throw new ConflictException('Cannot delete the final administrator')
      }
      const images = await tx`SELECT 1 FROM images WHERE uploaded_by=${id} LIMIT 1`
      if (images.length) throw new ConflictException('Account owns images; merge into another account before deletion')
      await tx`DELETE FROM accounts WHERE id=${id}`
    })
    return this.list()
  }

  async merge(targetRaw: unknown, sourceRaw: unknown) {
    const target = uuid(targetRaw), source = uuid(sourceRaw)
    if (target === source) throw new BadRequestException('Choose two different accounts')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const records = await tx`SELECT id FROM accounts WHERE id IN (${target}, ${source}) FOR UPDATE`
      if (records.length !== 2) throw new NotFoundException('Both accounts must exist')
      const identities = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${source}`
      if (identities.some(row => initialDiscordIds().has(row.discord_id as string))) {
        throw new ConflictException('Protected initial administrator must remain as the merge destination')
      }
      await tx`INSERT INTO account_roles(account_id, role)
        SELECT ${target}, role FROM account_roles WHERE account_id=${source}
        ON CONFLICT DO NOTHING`
      await tx`UPDATE account_discord_identities SET account_id=${target} WHERE account_id=${source}`
      await tx`UPDATE account_minecraft_identities SET account_id=${target} WHERE account_id=${source}`
      await tx`UPDATE images SET uploaded_by=${target} WHERE uploaded_by=${source}`
      await tx`DELETE FROM account_sessions WHERE account_id=${source}`
      await tx`DELETE FROM accounts WHERE id=${source}`
    })
    return this.list()
  }
}
