import { describe, expect, it } from 'vitest'
import { decodeSiteImage, RESOURCE_KEY, validateStaticSvg } from '../../src/site-image-validation.js'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#00bfff"/></svg>'
const upload = (content: string, mime_type = 'image/svg+xml') => ({
  data_base64: Buffer.from(content).toString('base64'), mime_type,
})

describe('site image upload validation', () => {
  it('accepts an inert SVG as a real version', () => {
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
  ])('rejects active SVG content: %s', source => {
    expect(() => validateStaticSvg(source)).toThrow()
  })
  it('accepts a high-resolution viewBox without an application-imposed cap', () => {
    expect(() => validateStaticSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8192 8192"><rect width="8192" height="8192"/></svg>')).not.toThrow()
  })
  it('accepts file data over 5 MiB via binary upload decoding', () => {
    const large = Buffer.from(svg.replace('</svg>', `${' '.repeat(5 * 1024 * 1024 + 1)}</svg>`))
    const result = decodeSiteImage({ file_bytes: large, mime_type: 'image/svg+xml' })
    expect(result.data.length).toBe(large.length)
    expect(result.data.length).toBeGreaterThan(5 * 1024 * 1024)
  })
  it('rejects mismatched MIME, broken base64 and empty data', () => {
    expect(() => decodeSiteImage(upload(svg, 'image/png'))).toThrow()
    expect(() => decodeSiteImage({ data_base64: '@@@', mime_type: 'image/svg+xml' })).toThrow()
    expect(() => decodeSiteImage({ data_base64: '', mime_type: 'image/svg+xml' })).toThrow()
  })
  it('constrains user-generated immutable resource keys', () => {
    expect(RESOURCE_KEY.test('site.header.background')).toBe(true)
    expect(RESOURCE_KEY.test('operator.surumeneco')).toBe(true)
    expect(RESOURCE_KEY.test('../secret')).toBe(false)
    expect(RESOURCE_KEY.test('Site.Logo')).toBe(false)
  })
})
