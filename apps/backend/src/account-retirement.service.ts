import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Database } from './database.js'
import { uuid } from './notice-validation.js'

const initialDiscordIds = () => new Set((process.env.ADMIN_DISCORD_IDS ?? '').split(',')
  .map(id => id.trim()).filter(Boolean))

/**
 * A historical applicant cannot be physically deleted without destroying
 * provenance. Retirement keeps only the stable FK target and a fixed
 * anonymous display name, while revoking identities, roles and sessions.
 */
@Injectable()
export class AccountRetirementService {
  constructor(private readonly database: Database) {}

  async retire(accountRaw: unknown): Promise<{ id: string; retired: true }> {
    const id = uuid(accountRaw)
    await this.database.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      await tx`SELECT pg_advisory_xact_lock(79412503)`
      const accounts = await tx`SELECT id,retired_at FROM accounts WHERE id=${id} FOR UPDATE`
      if (!accounts.length) throw new NotFoundException('アカウントが見つかりません。')
      if (accounts[0].retired_at) return

      const activeMerge = await tx`SELECT 1 FROM account_merges
        WHERE restored_at IS NULL AND (source_account_id=${id} OR target_account_id=${id}) LIMIT 1`
      if (activeMerge.length) throw new ConflictException('アカウント統合を分離してから退会処理してください。')
      const discord = await tx`SELECT discord_id FROM account_discord_identities WHERE account_id=${id}`
      if (discord.some((row: any) => initialDiscordIds().has(String(row.discord_id)))) {
        throw new ConflictException('初期管理者は退会処理できません。')
      }
      const admin = await tx`SELECT 1 FROM account_roles WHERE account_id=${id} AND role='admin'`
      if (admin.length) {
        const count = await tx`SELECT COUNT(*)::integer AS count FROM account_roles WHERE role='admin'`
        if (Number(count[0].count) <= 1) throw new ConflictException('最後の管理者は退会処理できません。')
      }
      const owned = await tx`SELECT 1 FROM territories WHERE owner_account_id=${id} LIMIT 1`
      if (owned.length) throw new ConflictException('所有する領地を先に別の所有者へ移してください。')
      const pending = await tx`SELECT 1 FROM territory_applications
        WHERE submitted_by_account_id=${id} AND status='pending' LIMIT 1`
      if (pending.length) throw new ConflictException('未承認の領地申請を先に取り下げてください。')

      await tx`DELETE FROM account_sessions WHERE account_id=${id}`
      await tx`DELETE FROM account_roles WHERE account_id=${id}`
      await tx`DELETE FROM account_discord_identities WHERE account_id=${id}`
      await tx`DELETE FROM account_minecraft_identities WHERE account_id=${id}`
      await tx`DELETE FROM account_bluemap_colors WHERE account_id=${id}`
      await tx`UPDATE operator_members SET account_id=NULL,merge_origin=NULL WHERE account_id=${id}`
      await tx`UPDATE accounts SET name='退会済みユーザー',retired_at=clock_timestamp() WHERE id=${id}`
    })
    return { id, retired: true }
  }
}
