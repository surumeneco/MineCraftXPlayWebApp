import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { Database } from './database.js'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const token = () => randomBytes(32).toString('base64url')
const names = { session: 'xplay_session', state: 'xplay_oauth_state', csrf: 'xplay_csrf' }
const origins = () => (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim())
const secure = () => process.env.NODE_ENV === 'production' ? '; Secure' : ''
const cookie = (name: string, value: string, path: string, age: number) =>
  `${name}=${value}; Path=${path}; Max-Age=${age}; HttpOnly; SameSite=Lax${secure()}`
const readCookie = (req: any, name: string): string | undefined =>
  String(req.headers.cookie ?? '').split(';').map((piece) => piece.trim()).find((piece) => piece.startsWith(`${name}=`))?.slice(name.length + 1)
const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

@Injectable()
export class AuthService {
  constructor(private readonly database: Database) {}

  private allowed(discordId: string): boolean {
    return (process.env.ADMIN_DISCORD_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean).includes(discordId)
  }

  begin(res: any): void {
    const client = process.env.DISCORD_CLIENT_ID
    const redirect = process.env.DISCORD_REDIRECT_URI
    if (!client || !redirect || !process.env.DISCORD_CLIENT_SECRET || !(process.env.ADMIN_DISCORD_IDS ?? '').trim()) {
      throw new ServiceUnavailableException('Discord admin login is not configured')
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
    if (!profile.id || !this.allowed(profile.id)) throw new ForbiddenException('Not an administrator')
    const session = token(), csrf = token()
    const sql = this.database.sql
    await sql.begin(async (tx) => {
      await tx`INSERT INTO admin_users (discord_id) VALUES (${profile.id!}) ON CONFLICT DO NOTHING`
      await tx`DELETE FROM admin_sessions WHERE expires_at <= now()`
      await tx`INSERT INTO admin_sessions (token_hash, discord_id, csrf_hash, expires_at)
        VALUES (${hash(session)}, ${profile.id!}, ${hash(csrf)}, now() + interval '7 days')`
    })
    res.setHeader('Set-Cookie', [
      cookie(names.session, session, '/api', 604800),
      cookie(names.csrf, csrf, '/api', 604800),
      cookie(names.state, '', '/api/auth/discord/callback', 0),
    ])
    res.redirect(302, origins()[0] + '/admin/notices')
  }

  private async resolve(req: any): Promise<{ discord_id: string; csrf_hash: string; token_hash: string } | null> {
    const raw = readCookie(req, names.session)
    if (!raw) return null
    const rows = await this.database.sql`
      SELECT discord_id, csrf_hash, token_hash FROM admin_sessions
      WHERE token_hash = ${hash(raw)} AND expires_at > now() LIMIT 1`
    const session = rows[0] as { discord_id: string; csrf_hash: string; token_hash: string } | undefined
    return session && this.allowed(session.discord_id) ? session : null
  }

  async info(req: any): Promise<{ authenticated: boolean; discord_id?: string; csrf_token?: string }> {
    const session = await this.resolve(req)
    if (!session) return { authenticated: false }
    const csrf = readCookie(req, names.csrf)
    return { authenticated: true, discord_id: session.discord_id, ...(csrf && safeEqual(hash(csrf), session.csrf_hash) ? { csrf_token: csrf } : {}) }
  }

  async requireAdmin(req: any, write = false): Promise<string> {
    const session = await this.resolve(req)
    if (!session) throw new UnauthorizedException('Administrator login required')
    if (write) {
      const origin = req.headers.origin
      if (typeof origin !== 'string' || !origins().includes(origin)) throw new ForbiddenException('Invalid request origin')
      const csrf = req.headers['x-xplay-csrf']
      if (typeof csrf !== 'string' || !safeEqual(hash(csrf), session.csrf_hash)) throw new ForbiddenException('Invalid CSRF token')
    }
    return session.discord_id
  }

  async logout(req: any, res: any): Promise<void> {
    const raw = readCookie(req, names.session)
    await this.requireAdmin(req, true)
    await this.database.sql`DELETE FROM admin_sessions WHERE token_hash = ${hash(raw!)}`
    res.setHeader('Set-Cookie', [cookie(names.session, '', '/api', 0), cookie(names.csrf, '', '/api', 0)])
    res.status(204).end()
  }
}
