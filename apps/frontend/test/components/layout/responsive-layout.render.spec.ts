import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'
import Layout from '../../../app/layouts/layout.vue'

describe('Responsive header menus', () => {
  it('keeps the desktop navigation separate and switches left/right drawers from the header', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
      slots: { 'side-menu': '<p>サイドメニューの内容</p>' },
    })
    expect(wrapper.get('header').classes()).toEqual(expect.arrayContaining(['navbar', 'navbar-expand-lg', 'sticky-top']))
    expect(wrapper.get('a.xplay-site-logo').text()).toBe('もふもふ広場')
    expect(wrapper.get('a.xplay-site-logo').attributes('href')).toBe('/')
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    expect(sideToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(navToggle.attributes('aria-controls')).toBe('mobile-menu-drawer')
    expect(sideToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(navToggle.element.closest('.col')?.classList.contains('d-lg-none')).toBe(true)
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
    expect(wrapper.get('#header-navigation').classes()).toContain('justify-content-lg-center')
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

  it('renders navigation accordions collapsed and preserves their expansion across reopening', async () => {
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/news' }] }] },
    })
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await navToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    const accordionToggle = drawer.get('button.accordion-button')
    const panel = drawer.get('[role="region"]')
    expect(accordionToggle.attributes('aria-expanded')).toBe('false')
    expect(panel.classes()).not.toContain('collapse')
    expect(panel.attributes('style')).toContain('display: none')
    expect(panel.get('a[href="/news"]').text()).toBe('お知らせ')
    expect(wrapper.get('#header-navigation').find('button.dropdown-toggle').exists()).toBe(true)
    await accordionToggle.trigger('click')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
    await navToggle.trigger('click')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    await navToggle.trigger('click')
    expect(drawer.get('button.accordion-button').attributes('aria-expanded')).toBe('true')
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
    expect(wrapper.get('#header-navigation').classes()).toContain('d-lg-flex')
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
    expect(wrapper.get('main').classes()).toEqual(expect.arrayContaining(['col-12', 'col-lg-9']))
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
