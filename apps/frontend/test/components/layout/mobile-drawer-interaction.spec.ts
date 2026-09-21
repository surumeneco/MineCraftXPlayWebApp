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
    expect(sideToggle.element.closest('header')).not.toBeNull()
    await sideToggle.trigger('click')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
    expect(drawer.attributes('open')).toBeDefined()
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(sideToggle.classes()).not.toContain('xplay-hamburger--open')
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
