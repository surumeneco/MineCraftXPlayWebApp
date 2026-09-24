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

type AccountRow = {
  id: string
  name: string
  created_at: Date
  is_admin: boolean
  discord_ids: string[]
  discord_profiles: { discord_id: string; username: string; display_name: string }[]
  minecraft_ids: { id: string; edition: 'je' | 'be'; username: string }[]
  merged_sources: { id: string; name: string; merged_at: Date }[]
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
          FROM account_minecraft_identities m WHERE m.account_id=a.id), '[]'::json) AS minecraft_ids,
        COALESCE((SELECT json_agg(json_build_object('id', s.id, 'name', s.name,
          'merged_at', merge.merged_at) ORDER BY merge.merged_at)
          FROM account_merges merge JOIN accounts s ON s.id=merge.source_account_id
          WHERE merge.target_account_id=a.id AND merge.restored_at IS NULL), '[]'::json) AS merged_sources
      FROM accounts a
      WHERE NOT EXISTS (SELECT 1 FROM account_merges merge WHERE merge.source_account_id=a.id AND merge.restored_at IS NULL)
      ORDER BY a.created_at, a.id`
    const protectedIds = initialDiscordIds()
    return (rows as unknown as AccountRow[]).map(row => ({ ...row, is_protected: Boolean(row.is_admin) &&
      row.discord_ids.some(id => protectedIds.has(id)) }))
  }

  async get(accountRaw: unknown) {
    const id = uuid(accountRaw)
    const account = (await this.list()).find(row => String(row.id) === id)
    if (!account) throw new NotFoundException('Account not found')
    return account
  }

  private async assertNoActiveMerge(id: string, message = 'Separate the account merge before changing this information') {
    const rows = await this.database.sql`SELECT id FROM account_merges
      WHERE restored_at IS NULL AND (source_account_id=${id} OR target_account_id=${id}) LIMIT 1`
    if (rows.length) throw new ConflictException(message)
  }

  // Internal-only operation. No arbitrary-name API is exposed to clients.
  private async rename(accountRaw: unknown, nameRaw: unknown) {
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
    try {
      await this.database.sql.begin(async tx => {
        await tx`SELECT pg_advisory_xact_lock(79412502)`
        const active = await tx`SELECT id FROM accounts WHERE id=${id} AND NOT EXISTS
          (SELECT 1 FROM account_merges WHERE source_account_id=${id} AND restored_at IS NULL)`
        if (!active.length) throw new NotFoundException('Account not found')
        await tx`INSERT INTO account_minecraft_identities(account_id, edition, username)
          VALUES (${id}, ${editionRaw}, ${username})`
      })
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('Minecraft name is already linked')
      throw error
    }
    return this.get(id)
  }

  async removeMinecraft(accountRaw: unknown, identityRaw: unknown) {
    const id = uuid(accountRaw), identity = uuid(identityRaw)
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const rows = await tx`SELECT merge_origin FROM account_minecraft_identities
        WHERE id=${identity} AND account_id=${id} FOR UPDATE`
      if (!rows.length) throw new NotFoundException('Minecraft identity not found')
      if (rows[0].merge_origin) throw new ConflictException('Separate the merge before removing transferred Minecraft identities')
      await tx`DELETE FROM account_minecraft_identities WHERE id=${identity} AND account_id=${id}`
    })
    return this.get(id)
  }

  async removeDiscord(accountRaw: unknown, discordRaw: unknown) {
    const id = uuid(accountRaw)
    if (typeof discordRaw !== 'string' || !/^\d{15,22}$/.test(discordRaw)) throw new BadRequestException('Invalid Discord ID')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const merged = await tx`SELECT 1 FROM account_merges WHERE restored_at IS NULL
        AND (source_account_id=${id} OR target_account_id=${id}) LIMIT 1`
      if (merged.length) throw new ConflictException('Separate the merge before unlinking Discord identities')
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
      const merged = await tx`SELECT 1 FROM account_merges WHERE restored_at IS NULL
        AND (source_account_id=${id} OR target_account_id=${id}) LIMIT 1`
      if (merged.length) throw new ConflictException('Separate the merge before changing administrator roles')
      if (enabled) {
        await tx`INSERT INTO account_roles(account_id, role) VALUES (${id}, 'admin') ON CONFLICT DO NOTHING`
      } else {
        const exists = await tx`SELECT 1 FROM account_roles WHERE account_id=${id} AND role='admin'`
        if (!exists.length) return
        const linked = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${id}`
        if (linked.some(row => initialDiscordIds().has(row.discord_id as string))) {
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
      // Preserve both account IDs and their audit trail even after separation.
      const history = await tx`SELECT 1 FROM account_merges WHERE source_account_id=${id} OR target_account_id=${id} LIMIT 1`
      if (history.length) throw new ConflictException('Account has merge history and cannot be physically deleted')
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
      const territories = await tx`SELECT 1 FROM territories
        WHERE applicant_account_id=${id} OR owner_account_id=${id} LIMIT 1`
      if (territories.length) throw new ConflictException('Account is referenced by territories; merge into another account before deletion')
      await tx`DELETE FROM accounts WHERE id=${id}`
    })
    return this.list()
  }
}
