import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

afterEach(() => vi.unstubAllGlobals())

const rectangle = (left: number, top: number) => ({
  left, top, right: left + 48, bottom: top + 48,
  width: 48, height: 48, x: left, y: top, toJSON: () => ({}),
})

describe('mobile drawer toggle and motion', () => {
  it('keeps the left close button at the opener position and plays reverse motion before closing', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const wrapper = await mountSuspended(HeaderMenu, {
      slots: { 'side-menu': '<a href="/side">サイドリンク</a>' },
    })
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    vi.spyOn(sideToggle.element, 'getBoundingClientRect').mockReturnValue(rectangle(12, 16))
    await sideToggle.trigger('click')

    const drawer = wrapper.get('#mobile-menu-drawer')
    expect(sideToggle.classes()).toContain('xplay-hamburger--open')
    expect(sideToggle.text()).toContain('閉じる')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--left')
    const close = drawer.get('button.xplay-mobile-drawer__toggle')
    expect(close.attributes('aria-label')).toBe('サイドメニューを閉じる')
    expect(close.attributes('style')).toContain('left: 12px')
    expect(close.attributes('style')).toContain('top: 16px')
    expect(close.attributes('style')).toContain('width: 48px')
    expect(close.attributes('style')).toContain('height: 48px')
    await close.trigger('click')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
    expect(drawer.attributes('open')).toBeDefined()
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(sideToggle.classes()).not.toContain('xplay-hamburger--open')
    wrapper.unmount()
  })

  it('slides navigation from the right, returns to the right, and restores body scrolling', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const originalOverflow = document.body.style.overflow
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '概要', to: '/info' }] },
    })
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    vi.spyOn(navToggle.element, 'getBoundingClientRect').mockReturnValue(rectangle(300, 16))
    await navToggle.trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    const panel = drawer.get('.xplay-mobile-drawer__panel')
    expect(panel.classes()).toContain('xplay-mobile-drawer__panel--right')
    expect(navToggle.classes()).toContain('xplay-hamburger--open')
    expect(drawer.get('button.xplay-mobile-drawer__toggle').attributes('style')).toContain('left: 300px')
    expect(drawer.get('button.xplay-mobile-drawer__toggle').attributes('aria-label')).toBe('ナビゲーションメニューを閉じる')
    expect(document.body.style.overflow).toBe('hidden')
    await drawer.get('.xplay-mobile-drawer__scrim').trigger('click')
    expect(drawer.classes()).toContain('xplay-mobile-drawer--closing')
    expect(panel.classes()).toContain('xplay-mobile-drawer__panel--right')
    await vi.waitFor(() => expect(drawer.attributes('open')).toBeUndefined())
    expect(document.body.style.overflow).toBe(originalOverflow)
    wrapper.unmount()
  })

  it('closes without animation when reduced motion is requested', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const wrapper = await mountSuspended(HeaderMenu)
    await wrapper.get('button[aria-label="サイドメニュー"]').trigger('click')
    const drawer = wrapper.get('#mobile-menu-drawer')
    await drawer.get('button.xplay-mobile-drawer__toggle').trigger('click')
    expect(drawer.attributes('open')).toBeUndefined()
    expect(drawer.classes()).not.toContain('xplay-mobile-drawer--closing')
    wrapper.unmount()
  })
})
