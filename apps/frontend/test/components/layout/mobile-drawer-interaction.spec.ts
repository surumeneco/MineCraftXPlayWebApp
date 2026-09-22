import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

afterEach(() => vi.unstubAllGlobals())

describe('mobile drawer toggle and motion', () => {
  it('keeps the header hamburger operable and reverses motion on close', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const wrapper = await mountSuspended(HeaderMenu, {
      slots: { 'side-menu': '<a href="/side">サイドリンク</a>' },
    })
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    await sideToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    expect(sideToggle.classes()).toContain('xplay-hamburger--open')
    expect(sideToggle.text()).toContain('閉じる')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--left')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--visible')
    expect(sideToggle.element.closest('header')).not.toBeNull()
    await sideToggle.trigger('click')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
    expect(drawer.classes()).not.toContain('xplay-mobile-drawer--visible')
    expect(drawer.attributes('open')).toBeDefined()
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(sideToggle.classes()).not.toContain('xplay-hamburger--open')
    wrapper.unmount()
  })

  it('opens the right drawer from a closed state and on every subsequent opening', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '情報', children: [{ label: 'お知らせ', to: '/info/notice' }] }] },
    })
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    const drawer = wrapper.get('#mobile-menu-drawer')
    // Pre-render the navigation before the first opening instead of mounting expanded accordions during entry.
    expect(drawer.get('#mobile-navigation').attributes('style')).toContain('display: none')
    for (let count = 0; count < 2; count++) {
      await navToggle.trigger('click')
      expect(drawer.attributes('open')).toBeDefined()
      expect(drawer.classes()).toContain('xplay-mobile-drawer--visible')
      expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--right')
      expect(drawer.get('button.accordion-button').attributes('aria-expanded')).toBe('true')
      await navToggle.trigger('click')
      expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
      expect(drawer.classes()).not.toContain('xplay-mobile-drawer--visible')
      await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    }
    wrapper.unmount()
  })

  it('switches from the left to right drawer directly and restores body scrolling', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const originalOverflow = document.body.style.overflow
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
    })
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await sideToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--left')
    await navToggle.trigger('click')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--visible')
    const panel = drawer.get('.xplay-mobile-drawer__panel')
    expect(panel.classes()).toContain('xplay-mobile-drawer__panel--right')
    expect(document.body.style.overflow).toBe('hidden')
    await drawer.get('.xplay-mobile-drawer__scrim').trigger('click')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(document.body.style.overflow).toBe(originalOverflow)
    wrapper.unmount()
  })

  it('closes without animation when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const wrapper = await mountSuspended(HeaderMenu)
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    await sideToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    await sideToggle.trigger('click')
    expect(drawer.attributes('open')).toBeUndefined()
    expect(drawer.classes()).not.toContain('xplay-mobile-drawer--closing')
    wrapper.unmount()
  })
})
