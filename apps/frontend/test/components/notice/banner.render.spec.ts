import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import Banner from '../../../app/components/notice/Banner.vue'
import type { Notice } from '../../../app/types/notice'

const notice: Notice = {
  id: 10,
  title: 'メンテナンスのお知らせ',
  published_at: '2026-09-18T12:00:00+09:00',
  updated_at: '2026-09-18T13:00:00+09:00',
  is_draft: false,
  tags: [{ id: 1, name: '運営' }],
  body_delta: { ops: [{ insert: '長い本文です。改行します。\n次の行です。\n' }] },
}

describe('NoticeBanner', () => {
  it('fills the parent and sets an exact preview height based on the lines prop', async () => {
    const wrapper = await mountSuspended(Banner, { props: { notice, lines: 2, previewLength: 4 } })
    const article = wrapper.get('article')
    expect(article.classes()).toContain('w-100')
    expect(article.attributes('style')).toContain('--notice-lines: 2')
    expect(article.attributes('style')).toContain('--notice-preview-height: 3em')
    expect(wrapper.get('.notice-preview').text()).toBe('長い本文')
  })

  it('shows both times in a wrapping row and links to the title route', async () => {
    const wrapper = await mountSuspended(Banner, { props: { notice } })
    expect(wrapper.findAll('time')).toHaveLength(2)
    expect(wrapper.get('time').element.parentElement?.classList.contains('flex-wrap')).toBe(true)
    expect(wrapper.get('[aria-label="タグ"]').text()).toContain('運営')
    expect(wrapper.get('a').attributes('href')).toContain('/info/notice/')
    expect(wrapper.get('a').text()).toBe('詳細を見る')
  })
})
