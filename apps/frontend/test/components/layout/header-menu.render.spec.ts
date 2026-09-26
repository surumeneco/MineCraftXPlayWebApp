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
    // The menu must be anchored to the header, not placed within the logo/account grid.
    expect(navigation.element.parentElement).toBe(wrapper.get('header > .container-fluid').element)
    expect(wrapper.get('.xplay-header-row').element.contains(navigation.element)).toBe(false)
    expect(navigation.classes()).toContain('xplay-desktop-navigation')
    expect(navigation.classes()).toContain('xplay-desktop-navigation')
    expect(navigation.get('ul').classes()).toContain('justify-content-center')
    expect(navigation.get('ul').classes()).toContain('flex-nowrap')
    expect(navigation.find('a[href="/"]').exists()).toBe(false)
    const dropdown = navigation.get('.dropdown')
    await dropdown.trigger('mouseenter')
    expect(dropdown.get('button').attributes('aria-expanded')).toBe('true')
    expect(dropdown.get('a[href="/news"]').text()).toBe('お知らせ')
    await dropdown.trigger('mouseleave')
    expect(dropdown.get('button').attributes('aria-expanded')).toBe('false')
  })


  it('renders the administrator application group with both real routes in desktop and mobile navigation', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [{
          label: '申請管理',
          children: [
            { label: '申請管理トップ', to: '/admin/applications' },
            { label: '領地承認', to: '/admin/territories' },
          ],
        }],
      },
    })
    const desktopGroup = wrapper.get('#header-navigation .dropdown')
    await desktopGroup.trigger('mouseenter')
    expect(desktopGroup.findAll('.dropdown-item').map(item => item.attributes('href'))).toEqual([
      '/admin/applications', '/admin/territories',
    ])
    await wrapper.get('button[aria-label="ナビゲーションメニュー"]').trigger('click')
    const mobile = wrapper.get('#mobile-navigation')
    expect(mobile.get('button.accordion-button').text()).toContain('申請管理')
    expect(mobile.get('a[href="/admin/applications"]').text()).toBe('申請管理トップ')
    expect(mobile.get('a[href="/admin/territories"]').text()).toBe('領地承認')
    wrapper.unmount()
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
