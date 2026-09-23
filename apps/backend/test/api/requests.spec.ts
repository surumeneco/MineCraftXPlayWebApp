import { afterEach, describe, expect, it, vi } from 'vitest'
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common'
import { RequestsController, validateRequest } from '../../src/request.controller.js'

const original = { ...process.env }
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...original }
})

describe('anonymous requests', () => {
  it('preserves content and checks required text and the 2000-character limit', () => {
    expect(validateRequest({ content: '  要望\n本文  ' })).toBe('  要望\n本文  ')
    expect(validateRequest({ content: 'x'.repeat(2000) })).toHaveLength(2000)
    for (const payload of [null, [], {}, { content: 42 }, { content: '  ' }, { content: 'x'.repeat(2001) }]) {
      expect(() => validateRequest(payload)).toThrow(BadRequestException)
    }
  })

  it('does not require login and forwards only the original content', async () => {
    process.env.FRONTEND_ORIGIN = 'https://example.com'
    process.env.REQUEST_BOT_URL = 'http://xplay-notice-bot:3102'
    process.env.REQUEST_NOTIFY_SECRET = 's'.repeat(48)
    const send = vi.fn().mockResolvedValue({ status: 204 })
    vi.stubGlobal('fetch', send)
    const content = ' @everyone\n要望 '
    await expect(new RequestsController().send({ headers: { origin: 'https://example.com' } }, { content })).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledOnce()
    const [url, options] = send.mock.calls[0]
    expect(String(url)).toBe('http://xplay-notice-bot:3102/internal/requests')
    expect(JSON.parse(options.body)).toEqual({ content })
    expect(options.headers.authorization).toBe(`Bearer ${process.env.REQUEST_NOTIFY_SECRET}`)
  })

  it('rejects foreign origins without contacting the bot', async () => {
    const send = vi.fn()
    vi.stubGlobal('fetch', send)
    await expect(new RequestsController().send({ headers: { origin: 'https://other.example' } }, { content: 'valid' }))
      .rejects.toThrow(ForbiddenException)
    expect(send).not.toHaveBeenCalled()
  })

  it('never claims delivery on Bot failure', async () => {
    process.env.FRONTEND_ORIGIN = 'https://example.com'
    process.env.REQUEST_BOT_URL = 'http://xplay-notice-bot:3102'
    process.env.REQUEST_NOTIFY_SECRET = 's'.repeat(48)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 502 }))
    await expect(new RequestsController().send({ headers: { origin: 'https://example.com' } }, { content: 'valid' }))
      .rejects.toThrow(ServiceUnavailableException)
  })
})
