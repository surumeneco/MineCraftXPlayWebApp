import { describe, expect, it } from 'vitest'
import type { Notice } from '../../app/types/notice'
import { deltaToPlainText, noticeDate, noticePreview, noticeUrl, sortNotices } from '../../app/utils/notice'

const base: Notice = {
  id: 1, title: '検証 / お知らせ', tags: [],
  published_at: '2026-09-18T12:00:00+09:00', updated_at: '2026-09-18T12:00:00+09:00',
  is_draft: false, body_delta: { ops: [{ insert: '本文\n' }] },
}

describe('notice utility', () => {
  it('extracts text and omits formatting, embeds, and the terminal newline', () => {
    const delta = { ops: [
      { insert: '太字', attributes: { bold: true } },
      { insert: { image: 'https://example.com/image.png' } },
      { insert: '\n次の行\n' },
    ] }
    expect(deltaToPlainText(delta)).toBe('太字\n次の行')
    expect(noticePreview(delta, 4)).toBe('太字 次…')
  })

  it('adds an ellipsis only when the text exceeds the character limit', () => {
    const delta = { ops: [{ insert: 'お知らせ\n' }] }
    expect(noticePreview(delta, 4)).toBe('お知らせ')
    expect(noticePreview(delta, 3)).toBe('お知ら…')
    expect(noticePreview(delta, 0)).toBe('')
  })

  it('does not split surrogate pairs at the preview boundary', () => {
    expect(noticePreview({ ops: [{ insert: '😀テスト\n' }] }, 1)).toBe('😀…')
  })

  it('encodes the title into a single route segment', () => {
    expect(noticeUrl('検証 / お知らせ')).toBe('/info/notice/%E6%A4%9C%E8%A8%BC%20%2F%20%E3%81%8A%E7%9F%A5%E3%82%89%E3%81%9B')
  })

  it('formats timestamps in JST and handles absent timestamps', () => {
    expect(noticeDate(null)).toBe('未設定')
    expect(noticeDate('invalid')).toBe('未設定')
    expect(noticeDate('2026-09-18T03:00:00Z')).toContain('12:00')
  })

  it('sorts by selected date descending, breaking ties by ID', () => {
    const next = { ...base, id: 2, updated_at: '2026-09-18T13:00:00+09:00' }
    expect(sortNotices([base, next], 'published_at').map(notice => notice.id)).toEqual([2, 1])
    expect(sortNotices([base, next], 'updated_at').map(notice => notice.id)).toEqual([2, 1])
    expect(base.id).toBe(1)
  })
})
