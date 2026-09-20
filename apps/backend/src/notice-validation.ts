import { BadRequestException } from '@nestjs/common'

export type Delta = { ops: Array<{ insert: string | Record<string, unknown>; attributes?: Record<string, unknown> }> }
export const EMPTY_DELTA: Delta = { ops: [] }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const forbiddenTitle = /[\p{White_Space}\p{Cc}:/?#\[\]@!$&'()*+,;=%\\]/u
const tagWhitespace = /[\p{White_Space}\p{Cc}]/u

export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new BadRequestException('Invalid UUID')
  return value.toLowerCase()
}

export function title(value: unknown): string {
  if (typeof value !== 'string' || !value || value === '.' || value === '..' || forbiddenTitle.test(value)) {
    throw new BadRequestException('Title is required; whitespace and URL-reserved characters are prohibited')
  }
  return value
}

export function delta(value: unknown): Delta {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid Delta')
  const ops = (value as { ops?: unknown }).ops
  if (!Array.isArray(ops) || !ops.every((op) => op && typeof op === 'object' && !Array.isArray(op) &&
    (typeof op.insert === 'string' || (op.insert && typeof op.insert === 'object' && !Array.isArray(op.insert))) &&
    (op.attributes === undefined || (op.attributes && typeof op.attributes === 'object' && !Array.isArray(op.attributes))))) {
    throw new BadRequestException('Invalid Delta operations')
  }
  return value as Delta
}

export function hasContent(body: Delta): boolean {
  return body.ops.some((op) => typeof op.insert === 'string'
    ? op.insert.trim().length > 0
    : Object.keys(op.insert).length > 0)
}

export function tags(value: unknown): Array<{ name: string; key: string }> {
  if (!Array.isArray(value)) throw new BadRequestException('Tags must be an array')
  const unique = new Map<string, string>()
  for (const raw of value) {
    if (typeof raw !== 'string' || !raw || Array.from(raw).length > 20 || tagWhitespace.test(raw)) {
      throw new BadRequestException('Tag must contain 1-20 characters and no whitespace')
    }
    const key = raw.normalize('NFKC').toLowerCase()
    if (!unique.has(key)) unique.set(key, raw)
  }
  return Array.from(unique, ([key, name]) => ({ key, name }))
}

export function expectedVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException('expected_version must be a positive integer')
  }
  return value
}

export function imageIds(body: Delta): Set<string> {
  const ids = new Set<string>()
  const base = (process.env.PUBLIC_API_BASE ?? 'http://localhost:3001/api').replace(/\/$/, '')
  const baseUrl = new URL(`${base}/`)
  const expectedPrefix = `${baseUrl.pathname}images/`
  for (const op of body.ops) {
    if (typeof op.insert === 'string' || !Object.hasOwn(op.insert, 'image')) continue
    const src = op.insert.image
    if (typeof src !== 'string') throw new BadRequestException('Invalid image embed')
    let parsed: URL
    try { parsed = new URL(src, baseUrl) } catch { throw new BadRequestException('Invalid image URL') }
    if (parsed.origin !== baseUrl.origin || !parsed.pathname.startsWith(expectedPrefix) || parsed.search || parsed.hash) {
      throw new BadRequestException('Image must be uploaded to this server')
    }
    ids.add(uuid(parsed.pathname.slice(expectedPrefix.length)))
  }
  return ids
}
