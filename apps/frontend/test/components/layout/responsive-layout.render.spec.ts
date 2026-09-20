import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Responsive header menus', () => {
  it('keeps the desktop navigation separate and opens left/right modal overlays', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
      slots: { 'side-menu': '<p>サイドメニューの内容</p>' },
    })

    expect(wrapper.get('header').classes()).toEqual(expect.arrayContaining([
      'navbar', 'navbar-expand-lg', 'sticky-top',
    ]))
    expect(wrapper.get('a.xplay-site-logo').text()).toBe('もふもふ広場')
    expect(wrapper.get('a.xplay-site-logo').attributes('href')).toBe('/')
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    expect(sideToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(navToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(sideToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(navToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
    expect(wrapper.get('#header-navigation').classes()).toContain('justify-content-lg-center')
    const drawer = wrapper.get('#mobile-menu-drawer')
    expect(drawer.attributes('open')).toBeUndefined()

    await sideToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('true')
    expect(drawer.attributes('open')).toBeDefined()
    expect(drawer.attributes('aria-label')).toBe('サイドメニュー')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--left')
    expect(drawer.get('#mobile-side-menu').text()).toContain('サイドメニューの内容')
    expect(drawer.find('#mobile-navigation').exists()).toBe(false)

    await navToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    expect(drawer.attributes('aria-label')).toBe('ナビゲーションメニュー')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--right')
    expect(drawer.find('#mobile-side-menu').exists()).toBe(false)
    expect(drawer.get('#mobile-navigation a[href="/info"]').text()).toBe('概要')
    expect(drawer.find('#mobile-navigation a[href="/"]').exists()).toBe(false)
    await drawer.get('.xplay-mobile-drawer__close').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(drawer.attributes('open')).toBeUndefined()
  })

  it('renders accordion child links inside the overlay and resets on reopening', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: {
        items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }],
      },
    })
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await navToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    const accordionToggle = drawer.get('button.accordion-button')
    const panel = drawer.get('[role="region"]')
    expect(accordionToggle.attributes('aria-expanded')).toBe('true')
    expect(panel.classes()).not.toContain('collapse')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
    expect(panel.get('a[href="/news"]').text()).toBe('お知らせ')
    expect(wrapper.get('#header-navigation').find('button.dropdown-toggle').exists()).toBe(true)

    await accordionToggle.trigger('click')
    expect(panel.attributes('style')).toContain('display: none')
    await accordionToggle.trigger('click')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')

    await drawer.get('.xplay-mobile-drawer__close').trigger('click')
    await navToggle.trigger('click')
    expect(drawer.get('button.accordion-button').attributes('aria-expanded')).toBe('true')
    await drawer.get('a[href="/news"]').trigger('click')
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    expect(drawer.attributes('open')).toBeUndefined()
  })

  it('closes on the backdrop, preserves the desktop nav and restores scroll state', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
    })
    const originalOverflow = document.body.style.overflow
    const toggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await toggle.trigger('click')
    expect(document.body.style.overflow).toBe('hidden')
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
    await wrapper.get('.xplay-mobile-drawer__scrim').trigger('click')
    expect(wrapper.get('#mobile-menu-drawer').attributes('open')).toBeUndefined()
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe(originalOverflow)
    wrapper.unmount()
  })
})

describe('Responsive sidebar placement', () => {
  it('keeps the body layout unchanged while exposing the shared sidebar in a mobile drawer', async () => {
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
    await wrapper.get('button[aria-label="サイドメニュー"]').trigger('click')
    expect(wrapper.get('#mobile-side-menu aside').attributes('aria-label')).toBe('サイドメニュー')
    expect(wrapper.get('main').text()).toContain('本文')
    expect(wrapper.get('#mobile-menu-drawer').attributes('open')).toBeDefined()
    await wrapper.get('.xplay-mobile-drawer__close').trigger('click')
  })
})
