import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import postgres from 'postgres'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('populated legacy database account migration', () => {
  it('preserves legacy administrators, sessions, image ownership and notice references', async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
    const schema = `account_migration_${randomUUID().replaceAll('-', '')}`
    const discordId = '912345678901234567'
    try {
      await sql`CREATE SCHEMA ${sql(schema)}`
      await sql.begin(async tx => {
        await tx`SELECT set_config('search_path', ${schema + ',public'}, true)`
        for (const filename of ['001_notices.sql', '002_accounts.sql']) {
          const path = new URL(`../../db/migrations/${filename}`, import.meta.url)
          const script = await readFile(path, 'utf8')
          if (filename === '002_accounts.sql') {
            await tx`INSERT INTO admin_users(discord_id) VALUES (${discordId})`
            await tx`INSERT INTO admin_sessions(token_hash,discord_id,csrf_hash,expires_at)
              VALUES ('legacy-session',${discordId},'legacy-csrf',now() + interval '1 day')`
            const notice = await tx`INSERT INTO notices(title) VALUES ('legacy-notice') RETURNING id`
            const image = await tx`INSERT INTO images(purpose,data,mime_type,size,uploaded_by)
              VALUES ('notice',${Buffer.from([255, 216, 255])},'image/jpeg',3,${discordId}) RETURNING id`
            await tx`INSERT INTO notice_images(notice_id,image_id) VALUES (${notice[0].id},${image[0].id})`
          }
          for (const statement of script.split('-- statement').map(part => part.trim()).filter(Boolean)) {
            await tx.unsafe(statement)
          }
        }
        const identity = await tx`SELECT account_id FROM account_discord_identities WHERE discord_id=${discordId}`
        expect(identity).toHaveLength(1)
        const accountId = identity[0].account_id
        expect((await tx`SELECT id FROM accounts WHERE id=${accountId}`)).toHaveLength(1)
        expect((await tx`SELECT 1 FROM account_roles WHERE account_id=${accountId} AND role='admin'`)).toHaveLength(1)
        expect((await tx`SELECT 1 FROM account_sessions WHERE token_hash='legacy-session' AND account_id=${accountId}`)).toHaveLength(1)
        expect((await tx`SELECT 1 FROM images WHERE uploaded_by=${accountId}`)).toHaveLength(1)
        expect((await tx`SELECT 1 FROM notice_images ni JOIN notices n ON n.id=ni.notice_id WHERE n.title='legacy-notice'`)).toHaveLength(1)
        expect((await tx`SELECT to_regclass('admin_users') AS old`)[0].old).toBeNull()
        expect((await tx`SELECT to_regclass('admin_sessions') AS old`)[0].old).toBeNull()
      })
    } finally {
      await sql`DROP SCHEMA IF EXISTS ${sql(schema)} CASCADE`
      await sql.end()
    }
  })
})
