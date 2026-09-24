import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'

const initialDiscordIds = () => new Set((process.env.ADMIN_DISCORD_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean))

/** Only one active merge per account; prohibit chains to keep provenance unambiguous. */
@Injectable()
export class AccountMergeService {
  constructor(private readonly database: Database) {}

  async merge(targetRaw: unknown, sourceRaw: unknown) {
    const target = uuid(targetRaw), source = uuid(sourceRaw)
    if (target === source) throw new BadRequestException('Choose two different accounts')
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const records = await tx`SELECT id FROM accounts WHERE id IN (${target}, ${source}) FOR UPDATE`
      if (records.length !== 2) throw new NotFoundException('Both accounts must exist')
      const linked = await tx`SELECT id FROM account_merges WHERE restored_at IS NULL
        AND (source_account_id IN (${target},${source}) OR target_account_id IN (${target},${source}))`
      if (linked.length) throw new ConflictException('Separate an existing merge before merging either account again')
      const identities = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${source} FOR UPDATE`
      if (!identities.length) throw new ConflictException('Merge source must have a Discord identity')
      if (identities.some(identity => initialDiscordIds().has(String(identity.discord_id)))) {
        throw new ConflictException('Protected initial administrator must remain as the merge destination')
      }
      const roles = await tx`SELECT account_id FROM account_roles WHERE account_id IN (${target},${source}) AND role='admin'`
      const sourceAdmin = roles.some(role => String(role.account_id) === source)
      const targetAdmin = roles.some(role => String(role.account_id) === target)
      await tx`INSERT INTO account_merges(source_account_id,target_account_id,source_was_admin,target_was_admin)
        VALUES (${source},${target},${sourceAdmin},${targetAdmin})`
      if (sourceAdmin) {
        await tx`INSERT INTO account_roles(account_id,role) VALUES (${target},'admin') ON CONFLICT DO NOTHING`
        await tx`DELETE FROM account_roles WHERE account_id=${source} AND role='admin'`
      }
      await tx`UPDATE account_discord_identities SET account_id=${target}, merge_origin=${source} WHERE account_id=${source}`
      await tx`UPDATE account_minecraft_identities SET account_id=${target}, merge_origin=${source} WHERE account_id=${source}`
      await tx`UPDATE images SET uploaded_by=${target}, merge_origin=${source} WHERE uploaded_by=${source}`
      await tx`UPDATE territories SET applicant_account_id=${target}, applicant_merge_origin=${source} WHERE applicant_account_id=${source}`
      await tx`UPDATE territories SET owner_account_id=${target}, owner_merge_origin=${source} WHERE owner_type='account' AND owner_account_id=${source}`
      await tx`DELETE FROM account_sessions WHERE account_id=${source}`
    })
  }

  async restore(sourceRaw: unknown) {
    const source = uuid(sourceRaw)
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const matches = await tx`SELECT id, target_account_id, source_was_admin, target_was_admin
        FROM account_merges WHERE source_account_id=${source} AND restored_at IS NULL FOR UPDATE`
      if (matches.length !== 1) throw new NotFoundException('No active merge for the source account')
      const record = matches[0]
      const target = String(record.target_account_id)
      await tx`SELECT id FROM accounts WHERE id IN (${source},${target}) FOR UPDATE`
      const displaced = await tx`SELECT discord_id FROM account_discord_identities
        WHERE merge_origin=${source} AND account_id<>${target}`
      const minecraftDisplaced = await tx`SELECT id FROM account_minecraft_identities
        WHERE merge_origin=${source} AND account_id<>${target}`
      const imagesDisplaced = await tx`SELECT id FROM images WHERE merge_origin=${source} AND uploaded_by<>${target}`
      const territoryDisplaced = await tx`SELECT id FROM territories WHERE
        (applicant_merge_origin=${source} AND applicant_account_id<>${target}) OR
        (owner_merge_origin=${source} AND owner_account_id<>${target})`
      if (displaced.length || minecraftDisplaced.length || imagesDisplaced.length || territoryDisplaced.length) {
        throw new ConflictException('Merged ownership changed; manual reconciliation is required')
      }
      const identities = await tx`SELECT discord_id FROM account_discord_identities WHERE merge_origin=${source} AND account_id=${target}`
      if (!identities.length) throw new ConflictException('Cannot separate without a remaining Discord identity')
      await tx`UPDATE account_discord_identities SET account_id=${source}, merge_origin=NULL
        WHERE account_id=${target} AND merge_origin=${source}`
      await tx`UPDATE account_minecraft_identities SET account_id=${source}, merge_origin=NULL
        WHERE account_id=${target} AND merge_origin=${source}`
      await tx`UPDATE images SET uploaded_by=${source}, merge_origin=NULL
        WHERE uploaded_by=${target} AND merge_origin=${source}`
      await tx`UPDATE territories SET applicant_account_id=${source}, applicant_merge_origin=NULL
        WHERE applicant_account_id=${target} AND applicant_merge_origin=${source}`
      await tx`UPDATE territories SET owner_account_id=${source}, owner_merge_origin=NULL
        WHERE owner_type='account' AND owner_account_id=${target} AND owner_merge_origin=${source}`
      if (record.source_was_admin) {
        await tx`INSERT INTO account_roles(account_id,role) VALUES (${source},'admin') ON CONFLICT DO NOTHING`
        if (!record.target_was_admin) await tx`DELETE FROM account_roles WHERE account_id=${target} AND role='admin'`
      }
      // Sessions authenticated via a transferred Discord ID must not retain target privileges.
      await tx`DELETE FROM account_sessions WHERE account_id IN (${source},${target})`
      await tx`UPDATE account_merges SET restored_at=clock_timestamp() WHERE id=${record.id}`
    })
  }
}
