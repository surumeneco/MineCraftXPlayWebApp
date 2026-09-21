import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import HeaderMenu from '../../../app/components/layout/HeaderMenu.vue'

afterEach(() => vi.unstubAllGlobals())

const headerRect = (height: number) => ({
  left: 0, top: 0, right: 375, bottom: height,
  width: 375, height, x: 0, y: 0, toJSON: () => ({}),
})

describe('mobile drawer header visibility', () => {
  it('positions both drawers below measured header, updates on resize and keeps header controls clickable', async () => {
    vi.stubGlobal('innerWidth', 375)
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const wrapper = await mountSuspended(HeaderMenu, {
      props: { items: [{ label: '情報', to: '/info' }] },
      slots: { 'side-menu': '<a href="/side">サイドリンク</a>' },
    })
    const header = wrapper.get('header')
    const getRect = vi.spyOn(header.element, 'getBoundingClientRect').mockReturnValue(headerRect(88))
    const drawer = wrapper.get('#mobile-menu-drawer')
    const sideToggle = wrapper.get('button[aria-label="サイドメニュー"]')
    const navToggle = wrapper.get('button[aria-label="ナビゲーションメニュー"]')
    await sideToggle.trigger('click')
    expect(drawer.attributes('style')).toContain('--xplay-header-bottom: 88px')
    expect(drawer.attributes('open')).toBeDefined()
    expect(header.get('a.xplay-site-logo').text()).toBe('もふもふ広場')
    getRect.mockReturnValue(headerRect(102))
    window.dispatchEvent(new Event('resize'))
    await wrapper.vm.$nextTick()
    expect(drawer.attributes('style')).toContain('--xplay-header-bottom: 102px')
    await navToggle.trigger('click')
    expect(drawer.attributes('style')).toContain('--xplay-header-bottom: 102px')
    expect(drawer.get('.xplay-mobile-drawer__panel').classes()).toContain('xplay-mobile-drawer__panel--right')
    expect(sideToggle.attributes('aria-expanded')).toBe('false')
    expect(navToggle.attributes('aria-expanded')).toBe('true')
    await navToggle.trigger('click')
    expect(drawer.attributes('open')).toBeUndefined()
    wrapper.unmount()
  })
})
