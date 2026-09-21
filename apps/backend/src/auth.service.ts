import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Database } from './database.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const names = { session: 'xplay_session', state: 'xplay_oauth_state', csrf: 'xplay_csrf' }
const origins = () => (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map(value => value.trim())
const secure = () => process.env.NODE_ENV === 'production' ? '; Secure' : ''
const cookie = (name: string, value: string, path: string, age: number) =>
  `${name}=${value}; Path=${path}; Max-Age=${age}; HttpOnly; SameSite=Lax${secure()}`
const readCookie = (req: any, name: string): string | undefined =>
  String(req.headers.cookie ?? '').split(';').map((piece) => piece.trim()).find((piece) => piece.startsWith(`${name}=`))?.slice(name.length + 1)
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export type AccountSession = { account_id: string; csrf_hash: string; token_hash: string; is_admin: boolean }

@Injectable()
export class AuthService {
  constructor(private readonly database: Database) {}

  begin(res: any): void {
    const client = process.env.DISCORD_CLIENT_ID
    const redirect = process.env.DISCORD_REDIRECT_URI
    if (!client || !redirect || !process.env.DISCORD_CLIENT_SECRET) {
      throw new ServiceUnavailableException('Discord login is not configured')
    }
    const state = token()
    res.setHeader('Set-Cookie', cookie(names.state, state, '/api/auth/discord/callback', 600))
    const url = new URL('https://discord.com/oauth2/authorize')
    url.search = new URLSearchParams({ response_type: 'code', client_id: client, redirect_uri: redirect, scope: 'identify', state }).toString()
    res.redirect(302, url.toString())
  }

  async callback(req: any, res: any, code: unknown, state: unknown): Promise<void> {
    const expected = readCookie(req, names.state)
    res.setHeader('Set-Cookie', cookie(names.state, '', '/api/auth/discord/callback', 0))
    if (!expected || typeof state !== 'string' || !safeEqual(expected, state) || typeof code !== 'string' || !code) {
      throw new UnauthorizedException('Invalid OAuth callback')
    }
    const client = process.env.DISCORD_CLIENT_ID
    const secret = process.env.DISCORD_CLIENT_SECRET
    const redirect = process.env.DISCORD_REDIRECT_URI
    if (!client || !secret || !redirect) throw new ServiceUnavailableException('OAuth is not configured')
    const exchanged = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: client, client_secret: secret, grant_type: 'authorization_code', code, redirect_uri: redirect }),
      signal: AbortSignal.timeout(10000),
    })
    if (!exchanged.ok) throw new UnauthorizedException('Discord token exchange failed')
    const credentials = await exchanged.json() as { access_token?: string }
    if (!credentials.access_token) throw new UnauthorizedException('Missing Discord access token')
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new UnauthorizedException('Discord identity lookup failed')
    const profile = await response.json() as { id?: string }
    if (!profile.id || !/^\d{15,22}$/.test(profile.id)) throw new UnauthorizedException('Missing Discord identity')

    const session = token(), csrf = token()
    const sql = this.database.sql
    const accountId = await sql.begin(async tx => {
      // Serialize first-login creation and bootstrap across all application workers.
      await tx`SELECT pg_advisory_xact_lock(79412502)`
      const linked = await tx`SELECT account_id FROM account_discord_identities WHERE discord_id=${profile.id!}`
      let id: string
      if (linked.length) id = String(linked[0].account_id)
      else {
        const created = await tx`INSERT INTO accounts DEFAULT VALUES RETURNING id`
        id = String(created[0].id)
        await tx`INSERT INTO account_discord_identities(discord_id, account_id) VALUES (${profile.id!}, ${id})`
      }
      const admins = await tx`SELECT account_id FROM account_roles WHERE role='admin' LIMIT 1`
      const bootstrapIds = (process.env.ADMIN_DISCORD_IDS ?? '').split(',').map(value => value.trim())
      if (!admins.length && bootstrapIds.includes(profile.id!)) {
        await tx`INSERT INTO account_roles(account_id, role) VALUES (${id}, 'admin') ON CONFLICT DO NOTHING`
      }
      await tx`DELETE FROM account_sessions WHERE expires_at <= now()`
      await tx`INSERT INTO account_sessions(token_hash, account_id, csrf_hash, expires_at)
        VALUES (${hash(session)}, ${id}, ${hash(csrf)}, now() + interval '7 days')`
      return id
    })
    res.setHeader('Set-Cookie', [
      cookie(names.session, session, '/api', 604800),
      cookie(names.csrf, csrf, '/api', 604800),
      cookie(names.state, '', '/api/auth/discord/callback', 0),
    ])
    // All authenticated users land on the same account page, even without administration rights.
    res.redirect(302, origins()[0] + '/account')
    void accountId
  }

  private async resolve(req: any): Promise<AccountSession | null> {
    const raw = readCookie(req, names.session)
    if (!raw) return null
    const rows = await this.database.sql`
      SELECT s.account_id, s.csrf_hash, s.token_hash,
        EXISTS(SELECT 1 FROM account_roles r WHERE r.account_id=s.account_id AND r.role='admin') AS is_admin
      FROM account_sessions s WHERE s.token_hash=${hash(raw)} AND s.expires_at>now() LIMIT 1`
    return rows[0] as AccountSession | undefined ?? null
  }

  async info(req: any): Promise<{ authenticated: boolean; account_id?: string; is_admin?: boolean; csrf_token?: string }> {
    const session = await this.resolve(req)
    if (!session) return { authenticated: false }
    const csrf = readCookie(req, names.csrf)
    return { authenticated: true, account_id: session.account_id, is_admin: session.is_admin,
      ...(csrf && safeEqual(hash(csrf), session.csrf_hash) ? { csrf_token: csrf } : {}) }
  }

  async requireUser(req: any, write = false): Promise<string> {
    const session = await this.resolve(req)
    if (!session) throw new UnauthorizedException('Login required')
    if (write) {
      const origin = req.headers.origin
      if (typeof origin !== 'string' || !origins().includes(origin)) throw new ForbiddenException('Invalid request origin')
      const csrf = req.headers['x-xplay-csrf']
      if (typeof csrf !== 'string' || !safeEqual(hash(csrf), session.csrf_hash)) throw new ForbiddenException('Invalid CSRF token')
    }
    return session.account_id
  }

  async requireAdmin(req: any, write = false): Promise<string> {
    const session = await this.resolve(req)
    if (!session) throw new UnauthorizedException('Login required')
    if (!session.is_admin) throw new ForbiddenException('Administrator role required')
    return this.requireUser(req, write)
  }

  async logout(req: any, res: any): Promise<void> {
    const raw = readCookie(req, names.session)
    await this.requireUser(req, true)
    await this.database.sql`DELETE FROM account_sessions WHERE token_hash=${hash(raw!)}`
    res.setHeader('Set-Cookie', [cookie(names.session, '', '/api', 0), cookie(names.csrf, '', '/api', 0)])
    res.status(204).end()
  }
}
