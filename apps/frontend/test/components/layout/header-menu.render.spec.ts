import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

describe('HeaderMenu', () => {
  it('links the branded logo to home and centers desktop navigation', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }],
      },
    })
    expect(wrapper.get('header').classes()).toContain('sticky-top')
    expect(wrapper.get('header').classes()).toContain('bg-body')
    expect(wrapper.get('a.xplay-site-logo').attributes('href')).toBe('/')
    expect(wrapper.get('a.xplay-site-logo').text()).toBe('もふもふ広場')
    const navigation = wrapper.get('nav[aria-label="メインナビゲーション"]')
    expect(navigation.classes()).toContain('justify-content-lg-center')
    expect(navigation.classes()).toContain('xplay-desktop-navigation')
    expect(navigation.get('ul').classes()).toContain('justify-content-lg-center')
    expect(navigation.find('a[href="/"]').exists()).toBe(false)
    const dropdown = navigation.get('.dropdown')
    await dropdown.trigger('mouseenter')
    expect(dropdown.get('button').attributes('aria-expanded')).toBe('true')
    expect(dropdown.get('a[href="/news"]').text()).toBe('お知らせ')
    await dropdown.trigger('mouseleave')
    expect(dropdown.get('button').attributes('aria-expanded')).toBe('false')
  })

  it('keeps a custom logo slot inside the home link', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      slots: { logo: '<strong>カスタムロゴ</strong>' },
    })
    expect(wrapper.get('a.xplay-site-logo').attributes('href')).toBe('/')
    expect(wrapper.get('a.xplay-site-logo').text()).toBe('カスタムロゴ')
    expect(wrapper.get('header').text()).not.toContain('ここにロゴ')
  })
})
