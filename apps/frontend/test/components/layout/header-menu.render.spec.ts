import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

describe('HeaderMenu', () => {
  it('renders Bootstrap navigation and opens/closes category links', async () => {
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
    expect(wrapper.get('header').classes()).toContain('sticky-top')
    expect(wrapper.get('header').classes()).toContain('bg-body')
    expect(wrapper.get('nav > ul > li > a').attributes('href')).toBe('/')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)

    const toggle = wrapper.get('button.dropdown-toggle')
    expect(toggle.text()).toBe('情報')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.dropdown-item').map(link => link.attributes('href'))).toEqual([
      '/news',
      '/server',
    ])

    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)

    await toggle.trigger('click')
    await wrapper.get('.dropdown-item').trigger('click')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
  })

  it('allows the logo to be replaced through its slot', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      slots: { logo: '<strong>カスタムロゴ</strong>' },
    })

    expect(wrapper.get('header').text()).toContain('カスタムロゴ')
    expect(wrapper.get('header').text()).not.toContain('ここにロゴ')
  })
})
