import { describe, expect, it } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { delta, expectedVersion, hasContent, imageIds, tags, title } from '../../src/notice-validation.js'

describe('notice validation', () => {
  it('preserves exact titles and rejects URL-sensitive, whitespace, and blank titles', () => {
    expect(title('お知らせ')).toBe('お知らせ')
    expect(title('News')).toBe('News')
    for (const input of ['', 'a b', 'a\nb', 'a/b', 'a?b', 'a%b', 'a#b', '..', 'a\\b']) {
      expect(() => title(input)).toThrow(BadRequestException)
    }
  })

  it('deduplicates tags using NFKC/lowercase and enforces length', () => {
    expect(tags(['ＡＢＣ', 'abc', 'お知らせ'])).toEqual([
      { name: 'ＡＢＣ', key: 'abc' }, { name: 'お知らせ', key: 'お知らせ' },
    ])
    expect(() => tags(['a b'])).toThrow(BadRequestException)
    expect(() => tags(['a'.repeat(21)])).toThrow(BadRequestException)
    expect(tags([])).toEqual([])
  })

  it('recognizes Quill empty, whitespace-only, image-only and text bodies', () => {
    expect(hasContent(delta({ ops: [] }))).toBe(false)
    expect(hasContent(delta({ ops: [{ insert: '\n' }] }))).toBe(false)
    expect(hasContent(delta({ ops: [{ insert: ' \n ' }] }))).toBe(false)
    expect(hasContent(delta({ ops: [{ insert: { image: '/api/images/123' } }] }))).toBe(true)
    expect(hasContent(delta({ ops: [{ insert: 'text\n' }] }))).toBe(true)
    expect(() => delta({ ops: [{ delete: 1 }] })).toThrow(BadRequestException)
  })

  it('validates positive versions', () => {
    expect(expectedVersion(1)).toBe(1)
    for (const invalid of [null, 0, -1, 1.5, '1']) expect(() => expectedVersion(invalid)).toThrow(BadRequestException)
  })

  it('extracts referenced local image IDs and rejects external image sources', () => {
    const id = 'af49e26d-5d99-4d69-88af-4075e0e217a0'
    expect(Array.from(imageIds(delta({ ops: [{ insert: { image: `/api/images/${id}` } }] })))).toEqual([id])
    expect(() => imageIds(delta({ ops: [{ insert: { image: 'https://example.org/image.png' } }] }))).toThrow(BadRequestException)
  })
})
