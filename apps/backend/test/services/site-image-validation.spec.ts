import { describe, expect, it } from 'vitest'
import { decodeSiteImage, RESOURCE_KEY, validateStaticSvg } from '../../src/site-image-validation.js'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00bfff"/></svg>'
const upload = (content: string, mime_type = 'image/svg+xml') => ({
  data_base64: Buffer.from(content).toString('base64'), mime_type,
})

describe('site image upload validation', () => {
  it('accepts a bounded inert SVG as a real version', () => {
    const result = decodeSiteImage(upload(svg))
    expect(result.mime).toBe('image/svg+xml')
    expect(result.data.toString()).toBe(svg)
  })
  it.each([
    '<svg viewBox="0 0 2 2" onload="alert(1)"></svg>',
    '<svg viewBox="0 0 2 2"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 2 2"><foreignObject/></svg>',
    '<svg viewBox="0 0 2 2"><image href="https://example.com/a.png"/></svg>',
    '<svg viewBox="0 0 2 2"><rect style="fill:url(https://example.com/a)"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 2 2">&x;</svg>',
    '<svg viewBox="0 0 5000 10"><rect width="1" height="1"/></svg>',
  ])('rejects active or unbounded SVG content: %s', source => {
    expect(() => validateStaticSvg(source)).toThrow()
  })
  it('rejects mismatched MIME, broken base64 and empty data', () => {
    expect(() => decodeSiteImage(upload(svg, 'image/png'))).toThrow()
    expect(() => decodeSiteImage({ data_base64: '@@@', mime_type: 'image/svg+xml' })).toThrow()
    expect(() => decodeSiteImage({ data_base64: '', mime_type: 'image/svg+xml' })).toThrow()
  })
  it('constrains user-generated immutable resource keys', () => {
    expect(RESOURCE_KEY.test('site.header.background')).toBe(true)
    expect(RESOURCE_KEY.test('card.event_2026')).toBe(true)
    expect(RESOURCE_KEY.test('../secret')).toBe(false)
    expect(RESOURCE_KEY.test('Site.Logo')).toBe(false)
  })
})
