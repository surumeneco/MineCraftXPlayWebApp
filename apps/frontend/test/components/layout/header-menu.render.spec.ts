import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

describe('HeaderMenu', () => {
  it('renders links and a category dropdown from navigation items', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [
          { label: 'ホーム', to: '/' },
          {
            label: '情報',
            children: [
              { label: 'お知らせ', to: '/news' },
              { label: 'サーバー情報', to: '/server' },
            ],
          },
        ],
      },
    })

    expect(wrapper.get('header').text()).toContain('ここにロゴ')
    expect(wrapper.get('nav > ul > li > a').attributes('href')).toBe('/')
    expect(wrapper.get('details > summary').text()).toBe('情報')
    expect(wrapper.findAll('details a').map(link => link.attributes('href'))).toEqual([
      '/news',
      '/server',
    ])
  })

  it('allows the logo to be replaced through its slot', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      slots: { logo: '<strong>カスタムロゴ</strong>' },
    })

    expect(wrapper.get('header').text()).toContain('カスタムロゴ')
    expect(wrapper.get('header').text()).not.toContain('ここにロゴ')
  })
})
