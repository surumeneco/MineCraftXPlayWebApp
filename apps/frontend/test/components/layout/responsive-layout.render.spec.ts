import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Responsive header menus', () => {
  it('centers the mobile logo and shows separate left/right hamburger buttons', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: 'ホーム', to: '/' }] },
      slots: { 'side-menu': '<p>サイドメニューの内容</p>' },
    })

    expect(wrapper.get('header').classes()).toEqual(expect.arrayContaining([
      'navbar', 'navbar-expand-lg', 'sticky-top',
    ]))
    expect(wrapper.get('.col-auto').text()).toBe('ここにロゴ')

    const sideToggle = wrapper.get('button[aria-controls="mobile-side-menu"]')
    const navToggle = wrapper.get('button[aria-controls="header-navigation"]')
    expect(sideToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(navToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-none')
    expect(wrapper.get('#mobile-side-menu').classes()).toContain('d-lg-none')

    await sideToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('false')
    expect(wrapper.get('#mobile-side-menu').text()).toContain('サイドメニューの内容')

    await navToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-flex')

    await wrapper.get('nav > ul > li > a').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-none')
  })

  it('closes the mobile navigation and its submenu after selecting a child link', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }],
      },
    })

    const navToggle = wrapper.get('button[aria-controls="header-navigation"]')
    await navToggle.trigger('click')
    await wrapper.get('button.dropdown-toggle').trigger('click')
    expect(wrapper.get('.dropdown-menu').classes()).toContain('show')

    await wrapper.get('.dropdown-item').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.dropdown-menu').exists()).toBe(false)
  })
})

describe('Responsive sidebar placement', () => {
  it('moves the same side menu into the mobile header and hides the body column on small screens', async () => {
    const wrapper = await mountSuspended(Layout, {
      slots: { default: '<p>本文</p>' },
    })

    expect(wrapper.get('.col-lg-3').classes()).toEqual(expect.arrayContaining([
      'd-none', 'd-lg-block',
    ]))
    expect(wrapper.get('main').classes()).toEqual(expect.arrayContaining([
      'col-12', 'col-lg-9',
    ]))
    expect(wrapper.get('.col-lg-3 aside').attributes('aria-label')).toBe('サイドメニュー')

    await wrapper.get('button[aria-controls="mobile-side-menu"]').trigger('click')
    expect(wrapper.get('#mobile-side-menu aside').attributes('aria-label')).toBe('サイドメニュー')
    expect(wrapper.get('#mobile-side-menu').attributes('aria-hidden')).toBe('false')
    expect(wrapper.get('main').text()).toContain('本文')
  })
})
