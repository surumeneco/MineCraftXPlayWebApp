import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Responsive header menus', () => {
  it('switches to the hamburger only when the intrinsic navigation fits between logo and account', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '長いナビゲーション', to: '/info' }] },
    })
    const row = wrapper.get('.xplay-header-row').element as HTMLElement
    const brand = wrapper.get('.xplay-header-brand').element as HTMLElement
    const account = wrapper.get('.account-menu').element as HTMLElement
    const nav = wrapper.get('#header-navigation').element as HTMLElement
    const rect = (width: number) => ({ width, height: 50, top: 0, bottom: 50, left: 0, right: width, x: 0, y: 0, toJSON: () => ({}) })
    const rowWidth = vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(rect(1100))
    vi.spyOn(brand, 'getBoundingClientRect').mockReturnValue(rect(180))
    vi.spyOn(account, 'getBoundingClientRect').mockReturnValue(rect(60))
    Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: 680 })
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.xplay-header-row').classes()).toContain('xplay-header-row--desktop')
    expect(wrapper.get('.xplay-header-side-toggle').attributes('style')).toContain('display: none')
    rowWidth.mockReturnValue(rect(800))
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.xplay-header-row').classes()).not.toContain('xplay-header-row--desktop')
    expect(wrapper.get('#header-navigation').classes()).toContain('xplay-desktop-navigation--hidden')
    wrapper.unmount()
  })

  it('measures top-level width independently of expanded dropdown overflow', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '申請管理', children: [{ label: '領地申請', to: '/admin/territories' }] }] },
    })
    const rect = (width: number) => ({
      width, height: 50, top: 0, bottom: 50, left: 0, right: width,
      x: 0, y: 0, toJSON: () => ({}),
    })
    vi.spyOn(wrapper.get('.xplay-header-row').element, 'getBoundingClientRect').mockReturnValue(rect(1100))
    vi.spyOn(wrapper.get('.xplay-header-brand').element, 'getBoundingClientRect').mockReturnValue(rect(180))
    vi.spyOn(wrapper.get('.account-menu').element, 'getBoundingClientRect').mockReturnValue(rect(60))
    const nav = wrapper.get('#header-navigation')
    const topLevel = nav.get('ul.navbar-nav')
    vi.spyOn(topLevel.element, 'getBoundingClientRect').mockReturnValue(rect(500))
    Object.defineProperty(nav.element, 'scrollWidth', { configurable: true, value: 1200 })
    await nav.get('.dropdown').trigger('mouseenter')
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.xplay-header-row').classes()).toContain('xplay-header-row--desktop')
    wrapper.unmount()
  })

  it('keeps the desktop navigation separate and switches left/right drawers from the header', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
      slots: { 'side-menu': '<p>サイドメニューの内容</p>' },
    })
    expect(wrapper.get('header').classes()).toEqual(expect.arrayContaining(['navbar', 'sticky-top']))
    expect(wrapper.get('a.xplay-site-logo').text()).toBe('もふもふ広場')
    expect(wrapper.get('a.xplay-site-logo').attributes('href')).toBe('/')
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    expect(sideToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(navToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(sideToggle.element.closest('.xplay-header-side-toggle')).not.toBeNull()
    expect(navToggle.element.closest('.xplay-header-nav-toggle')).not.toBeNull()
    expect(wrapper.get('#header-navigation').classes()).toContain('xplay-desktop-navigation')
    expect(wrapper.get('#header-navigation').classes()).toContain('xplay-desktop-navigation--hidden')
    const drawer = wrapper.get('#mobile-menu-drawer')
    expect(drawer.attributes('open')).toBeUndefined()
    await sideToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('true')
    expect(drawer.attributes('open')).toBeDefined()
    expect(drawer.classes()).toContain('xplay-mobile-drawer--visible')
    expect(drawer.attributes('aria-label')).toBe('サイドメニュー')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--left')
    expect(drawer.get('#mobile-side-menu').text()).toContain('サイドメニューの内容')
    await navToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--visible')
    expect(drawer.attributes('aria-label')).toBe('ナビゲーションメニュー')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--right')
    expect(drawer.find('#mobile-side-menu').exists()).toBe(false)
    expect(drawer.get('#mobile-navigation a[href="/info"]').text()).toBe('概要')
    expect(drawer.find('#mobile-navigation a[href="/"]').exists()).toBe(false)
    await navToggle.trigger('click')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('renders navigation accordions expanded initially and preserves user collapse across reopening', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }] },
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
    expect(accordionToggle.attributes('aria-expanded')).toBe('false')
    expect(panel.attributes('style')).toContain('display: none')
    await navToggle.trigger('click')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    await navToggle.trigger('click')
    expect(drawer.get('button.accordion-button').attributes('aria-expanded')).toBe('false')
    await drawer.get('button.accordion-button').trigger('click')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
    await drawer.get('a[href="/news"]').trigger('click')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(navToggle.attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('closes on backdrop, preserves desktop navigation and restores scroll state', async () => {
    const wrapper = await mountSuspended(HeaderMenu, { props: { items: [{ label: '概要', to: '/info' }] } })
    const originalOverflow = document.body.style.overflow
    const toggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await toggle.trigger('click')
    expect(document.body.style.overflow).toBe('hidden')
    expect(wrapper.get('#header-navigation').classes()).toContain('xplay-desktop-navigation')
    await wrapper.get('.xplay-mobile-drawer__scrim').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('#mobile-menu-drawer').attributes('open')).toBeUndefined())
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe(originalOverflow)
    wrapper.unmount()
  })
})

describe('Responsive sidebar placement', () => {
  it('keeps body layout unchanged while exposing shared sidebar in mobile drawer', async () => {
    const wrapper = await mountSuspended(Layout, { slots: { default: '<p>本文</p>' } })
    expect(wrapper.get('.col-lg-3').classes()).toEqual(expect.arrayContaining(['d-none', 'd-lg-block']))
    expect(wrapper.get('main').classes()).toContain('col-12')
    expect(wrapper.get('main').classes()).toContain('col-lg-9')
    expect(wrapper.get('.col-lg-3 aside').attributes('aria-label')).toBe('サイドメニュー')
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    await sideToggle.trigger('click')
    expect(wrapper.get('#mobile-side-menu aside').attributes('aria-label')).toBe('サイドメニュー')
    expect(wrapper.get('main').text()).toContain('本文')
    expect(wrapper.get('#mobile-menu-drawer').attributes('open')).toBeDefined()
    await sideToggle.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('#mobile-menu-drawer').attributes('open')).toBeUndefined())
    wrapper.unmount()
  })
})
