import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import postgres from 'postgres'

const suite = process.env.DATABASE_URL ? describe : describe.skip

suite('operator photo cross-edition migration', () => {
  it('matches unique JE/BE accounts, skips ambiguous names, and preserves existing bindings', async () => {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
    const prefix = `operator-cross-edition-${randomUUID()}-`
    const [matched, ambiguousA, ambiguousB, alreadyBound, other] =
      Array.from({ length: 5 }, () => randomUUID())
    const script = await readFile(new URL('../../db/migrations/012_operator_member_cross_edition.sql', import.meta.url), 'utf8')
    try {
      // Always roll back fixture rows and any previously unbound real operator rows.
      await expect(sql.begin(async tx => {
        for (const id of [matched, ambiguousA, ambiguousB, alreadyBound, other]) {
          await tx`INSERT INTO accounts(id,name) VALUES (${id},'migration-test')`
        }
        for (const [accountId, edition, username] of [
          [matched, 'be', `BeOnly-${prefix}`],
          [matched, 'je', `Both-${prefix}`],
          [matched, 'be', `both-${prefix}`],
          [ambiguousA, 'je', `Ambiguous-${prefix}`],
          [ambiguousB, 'be', `ambiguous-${prefix}`],
          [other, 'be', `Already-${prefix}`],
        ]) {
          await tx`INSERT INTO account_minecraft_identities(account_id,edition,username)
            VALUES (${accountId},${edition},${username})`
        }
        for (const [suffix, name, owner] of [
          ['be', `beonly-${prefix}`, null],
          ['both', `Both-${prefix}`, null],
          ['ambiguous', `ambiguous-${prefix}`, null],
          ['bound', `already-${prefix}`, alreadyBound],
          ['missing', `missing-${prefix}`, null],
        ]) {
          await tx`INSERT INTO operator_members(member_key,minecraft_name,account_id)
            VALUES (${prefix + suffix},${name},${owner})`
        }
        async function run() {
          for (const part of script.split('-- statement').map(piece => piece.trim()).filter(Boolean)) {
            await tx.unsafe(part)
          }
        }
        await run()
        await run() // Repeatability must not change existing bindings.
        const rows = await tx`SELECT member_key,account_id FROM operator_members
          WHERE member_key LIKE ${prefix + '%'}`
        const bySuffix = new Map(rows.map(row => [String(row.member_key).slice(prefix.length), row.account_id]))
        expect(bySuffix.get('be')).toBe(matched)
        expect(bySuffix.get('both')).toBe(matched)
        expect(bySuffix.get('ambiguous')).toBeNull()
        expect(bySuffix.get('bound')).toBe(alreadyBound)
        expect(bySuffix.get('missing')).toBeNull()
        throw new Error('rollback migration fixture')
      })).rejects.toThrow('rollback migration fixture')
    } finally {
      await sql.end()
    }
  })
})
