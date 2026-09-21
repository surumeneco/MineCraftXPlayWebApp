import { readdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postgres from 'postgres'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')
try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  for (const name of (await readdir(folder)).filter((file) => /^\d+.*\.sql$/.test(file)).sort()) {
    const source = await readFile(join(folder, name), 'utf8')
    const checksum = createHash('sha256').update(source).digest('hex')
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(79412501)`
      const rows = await tx`SELECT checksum FROM schema_migrations WHERE name = ${name}`
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Migration changed after application: ${name}`)
        return
      }
      const statements = source.split(/^-- statement\s*$/gm)
        .map((part) => part.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)
      for (const statement of statements) await tx.unsafe(statement)
      await tx`INSERT INTO schema_migrations (name, checksum) VALUES (${name}, ${checksum})`
      console.log(`[migration] applied ${name}`)
    })
  }
} finally {
  await sql.end()
}
