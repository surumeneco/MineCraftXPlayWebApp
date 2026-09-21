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
  it('fills parent and clamps compact preview to configured lines without a fixed bottom gap', async () => {
    const wrapper = await mountSuspended(Banner, { props: { notice, lines: 2, previewLength: 4 } })
    const banner = wrapper.get('a.notice-banner')
    expect(banner.classes()).toContain('w-100')
    expect(banner.attributes('style')).toContain('--notice-lines: 2')
    expect(banner.attributes('style')).toContain('--notice-preview-max-height: 2.8em')
    expect(banner.attributes('style')).not.toContain('--notice-preview-height:')
    expect(wrapper.get('.notice-preview').text()).toBe('長い本文…')
    expect(wrapper.get('span.notice-banner__title').text()).toBe(notice.title)
    expect(wrapper.get('span.notice-banner__title').classes()).toContain('fs-5')
    expect(banner.find('h2,h3').exists()).toBe(false)
  })

  it('links whole banner, renders accessible times and tags without badge backgrounds', async () => {
    const wrapper = await mountSuspended(Banner, { props: { notice } })
    expect(wrapper.get('span.notice-banner__title').text()).toBe(notice.title)
    expect(wrapper.findAll('time')).toHaveLength(2)
    expect(wrapper.get('time').element.parentElement?.classList.contains('flex-wrap')).toBe(true)
    const tags = wrapper.get('[aria-label="タグ"]')
    expect(tags.text()).toContain('運営')
    expect(tags.find('.badge').exists()).toBe(false)
    expect(wrapper.get('a.notice-banner').attributes('href')).toContain('/info/notice/')
    expect(wrapper.get('a.notice-banner').text()).toContain('メンテナンスのお知らせ')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.findAll('svg.bi')).toHaveLength(3)
    expect(wrapper.findAll('.notice-meta__short')).toHaveLength(2)
    expect(wrapper.get('.notice-meta__short').text()).toBe('2026/09/18')
  })
})
